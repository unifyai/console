import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CanvasFrame } from '@/components/Canvas/CanvasFrame';

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));

/**
 * The parent half of the canvas frame protocol, in a real browser.
 *
 * These run here rather than under jsdom because the protocol rests on two
 * platform features jsdom does not implement: transferring a `MessagePort`
 * through `postMessage`, and reporting a real `event.source`. A jsdom version
 * of these tests would pass against a stub and prove nothing.
 *
 * The assertions are about containment, not rendering. A canvas carries
 * assistant-authored code, so what matters is that naming an undeclared alias
 * or action gets it nothing, and that a message arriving anywhere other than
 * the transferred port is ignored.
 */

/**
 * Stand-in for the sandboxed child.
 *
 * The real host is cross-origin and cannot be loaded in a unit test, so this
 * plays the child's side of the handshake against the production parent: send
 * `canvas/hello`, capture the transferred port, then speak only over it.
 */
function playChild(iframe: HTMLIFrameElement) {
  const received: any[] = [];
  let port: MessagePort | null = null;

  // The parent identifies the child by `event.source`, so the hello has to look
  // like it came from the frame's content window.
  Object.defineProperty(iframe, 'contentWindow', { configurable: true, value: window });

  const initPromise = new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('parent never sent canvas/init')), 8000);
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'canvas/init') return;
      clearTimeout(timer);
      port = event.ports[0] ?? null;
      if (port) {
        port.onmessage = (portEvent: MessageEvent) => received.push(portEvent.data);
        port.start();
      }
      window.removeEventListener('message', onMessage);
      resolve(event.data);
    };
    window.addEventListener('message', onMessage);
  });

  window.postMessage({ type: 'canvas/hello', protocol: 1 }, '*');

  return {
    initPromise,
    received,
    hasPort: () => port !== null,
    send: (message: unknown) => port?.postMessage(message),
  };
}

describe('CanvasFrame handshake', () => {
  it('replies to the child hello with init and a transferred port', async () => {
    const { container } = render(
      <CanvasFrame source="export default () => null" props={{ a: 1 }} aliases={['tasks']} />
    );
    const child = playChild(container.querySelector('iframe')!);
    const init = await child.initPromise;

    expect(init.type).toBe('canvas/init');
    expect(init.source).toBe('export default () => null');
    expect(init.props).toEqual({ a: 1 });
    expect(init.aliases).toEqual(['tasks']);
    // Per-mount nonce, so a stale frame cannot rejoin a newer session.
    expect(typeof init.channel).toBe('string');
    expect(init.channel.length).toBeGreaterThan(0);
    expect(child.hasPort()).toBe(true);
  });

  it('answers declared aliases and refuses everything else', async () => {
    const onRequestData = vi.fn(async () => ({ rows: [{ id: 1 }], truncated: false }));
    const { container } = render(
      <CanvasFrame
        source="export default () => null"
        aliases={['tasks']}
        onRequestData={onRequestData}
      />
    );
    const child = playChild(container.querySelector('iframe')!);
    await child.initPromise;

    child.send({ type: 'canvas/data/request', alias: 'tasks' });
    await waitFor(() =>
      expect(child.received).toContainEqual(
        expect.objectContaining({ type: 'canvas/data/result', alias: 'tasks' })
      )
    );

    // The control that stops a canvas reading past the bindings on its record.
    child.send({ type: 'canvas/data/request', alias: 'secrets' });
    await waitFor(() =>
      expect(child.received).toContainEqual(
        expect.objectContaining({ type: 'canvas/data/error', alias: 'secrets' })
      )
    );
    expect(onRequestData).toHaveBeenCalledTimes(1);
    expect(onRequestData).toHaveBeenCalledWith('tasks');
  });

  it('refuses an action the canvas record does not declare', async () => {
    const onInvokeAction = vi.fn(async () => 'inv-1');
    const { container } = render(
      <CanvasFrame
        source="export default () => null"
        actions={[
          { name: 'refresh', label: 'Refresh', requiresConfirmation: false, destructive: false },
        ]}
        onInvokeAction={onInvokeAction}
      />
    );
    const child = playChild(container.querySelector('iframe')!);
    await child.initPromise;

    child.send({ type: 'canvas/action/invoke', requestId: 'r1', actionName: 'refresh', args: {} });
    await waitFor(() =>
      expect(child.received).toContainEqual(
        expect.objectContaining({ type: 'canvas/action/accepted', requestId: 'r1' })
      )
    );

    child.send({
      type: 'canvas/action/invoke',
      requestId: 'r2',
      actionName: 'wire_money',
      args: {},
    });
    await waitFor(() =>
      expect(child.received).toContainEqual(
        expect.objectContaining({ type: 'canvas/action/denied', requestId: 'r2' })
      )
    );
    expect(onInvokeAction).toHaveBeenCalledTimes(1);
    expect(onInvokeAction).not.toHaveBeenCalledWith('wire_money', expect.anything());
  });

  it('clamps the height a canvas can demand', async () => {
    const { container } = render(<CanvasFrame source="export default () => null" />);
    const iframe = container.querySelector('iframe')!;
    const child = playChild(iframe);
    await child.initPromise;

    child.send({ type: 'canvas/resize', height: 5_000_000 });
    await waitFor(() => expect(parseInt(iframe.style.height, 10)).toBeLessThanOrEqual(20000));
    expect(parseInt(iframe.style.height, 10)).toBeGreaterThan(0);
  });

  it('delivers each invocation update once, and only after the canvas is ready', async () => {
    // The parent resolves an action as soon as it is *accepted*, so without these
    // the canvas never learns how the run ended and its control stays working
    // forever. Delivering twice is the other failure: a canvas counting its own
    // results would double every one.
    const { container, rerender } = render(
      <CanvasFrame source="export default () => null" invocationEvents={[]} />
    );
    const child = playChild(container.querySelector('iframe')!);
    await child.initPromise;

    child.send({ type: 'canvas/ready' });

    rerender(
      <CanvasFrame
        source="export default () => null"
        invocationEvents={[{ invocationId: 0, status: 'succeeded' }]}
      />
    );

    await waitFor(() =>
      expect(child.received).toContainEqual(
        // Auto-counted ids are 0-based, so the first run of a canvas is id "0".
        expect.objectContaining({ type: 'canvas/action/result', invocationId: '0', ok: true })
      )
    );

    // Re-render with the same list: nothing further may be posted.
    rerender(
      <CanvasFrame
        source="export default () => null"
        invocationEvents={[{ invocationId: 0, status: 'succeeded' }]}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(
      child.received.filter((message) => message.type === 'canvas/action/result')
    ).toHaveLength(1);

    // A second event appends rather than replacing, so only the new one goes out.
    rerender(
      <CanvasFrame
        source="export default () => null"
        invocationEvents={[
          { invocationId: 0, status: 'succeeded' },
          { invocationId: 1, status: 'failed', error: 'recipients: too long' },
        ]}
      />
    );
    await waitFor(() =>
      expect(child.received).toContainEqual(
        expect.objectContaining({
          type: 'canvas/action/result',
          invocationId: '1',
          ok: false,
          error: 'recipients: too long',
        })
      )
    );
    expect(
      child.received.filter((message) => message.type === 'canvas/action/result')
    ).toHaveLength(2);
  });

  it('reports a non-terminal invocation as progress, not a result', async () => {
    const { container, rerender } = render(
      <CanvasFrame source="export default () => null" invocationEvents={[]} />
    );
    const child = playChild(container.querySelector('iframe')!);
    await child.initPromise;
    child.send({ type: 'canvas/ready' });

    rerender(
      <CanvasFrame
        source="export default () => null"
        invocationEvents={[{ invocationId: 2, status: 'requested' }]}
      />
    );

    await waitFor(() =>
      expect(child.received).toContainEqual(
        // 'requested' is the protocol's 'pending'. Sending a result here would
        // settle a run that has not started.
        expect.objectContaining({
          type: 'canvas/action/progress',
          invocationId: '2',
          status: 'pending',
        })
      )
    );
    expect(child.received.some((message) => message.type === 'canvas/action/result')).toBe(false);
  });

  it('ignores protocol messages that did not arrive on the transferred port', async () => {
    const onRequestData = vi.fn(async () => ({ rows: [], truncated: false }));
    const { container } = render(
      <CanvasFrame
        source="export default () => null"
        aliases={['tasks']}
        onRequestData={onRequestData}
      />
    );
    const child = playChild(container.querySelector('iframe')!);
    await child.initPromise;

    // Identical payload, wrong channel. Holding the port is the credential, so
    // a plain window message must not be actioned.
    window.postMessage({ type: 'canvas/data/request', alias: 'tasks' }, '*');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(onRequestData).not.toHaveBeenCalled();
  });
});
