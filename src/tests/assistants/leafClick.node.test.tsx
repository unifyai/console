import { afterEach, describe, expect, it, vi } from 'vitest';
import { clickLeafTarget, waitForTestId } from '@/lib/agent-guidance/leafClick';

function addButton(testId: string, attrs: Record<string, string> = {}): HTMLButtonElement {
  const button = document.createElement('button');
  button.setAttribute('data-testid', testId);
  for (const [key, value] of Object.entries(attrs)) button.setAttribute(key, value);
  document.body.appendChild(button);
  return button;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

/**
 * A leaf control only exists once the move before it has landed and rendered,
 * so resolution happens when the step is due rather than when it is planned.
 */
describe('clicking a leaf control', () => {
  it('clicks a control that is already there', async () => {
    const button = addButton('integration-card-github');
    const onClick = vi.fn();
    button.addEventListener('click', onClick);

    await expect(clickLeafTarget('integration-card-github')).resolves.toBe('clicked');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('waits for a control that appears after the navigation lands', async () => {
    const onClick = vi.fn();
    const pending = clickLeafTarget('integration-card-notion', { timeoutMs: 1000 });

    // The section renders a beat later, as it would after a route change.
    await new Promise((resolve) => setTimeout(resolve, 20));
    addButton('integration-card-notion').addEventListener('click', onClick);

    await expect(pending).resolves.toBe('clicked');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reports a control that never appears rather than passing silently', async () => {
    // A removed control must fail loudly: the alternative is narrating a click
    // that did not happen.
    await expect(clickLeafTarget('integration-card-gone', { timeoutMs: 50 })).resolves.toBe(
      'not-found'
    );
  });

  it('refuses a disabled control', async () => {
    const button = addButton('integrations-add-new-trigger', { disabled: '' });
    const onClick = vi.fn();
    button.addEventListener('click', onClick);

    await expect(clickLeafTarget('integrations-add-new-trigger')).resolves.toBe('not-interactive');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('refuses an aria-disabled control', async () => {
    const button = addButton('integrations-add-new-trigger', { 'aria-disabled': 'true' });
    const onClick = vi.fn();
    button.addEventListener('click', onClick);

    await expect(clickLeafTarget('integrations-add-new-trigger')).resolves.toBe('not-interactive');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('highlights the control it presses', async () => {
    addButton('integration-card-github');
    const highlight = vi.fn();

    await clickLeafTarget('integration-card-github', { highlight });

    expect(highlight).toHaveBeenCalledWith('integration-card-github');
  });

  it('resolves immediately when the control already exists', async () => {
    addButton('integration-card-github');
    await expect(waitForTestId('integration-card-github', 5000)).resolves.toBeInstanceOf(
      HTMLElement
    );
  });

  it('gives up rather than waiting forever', async () => {
    const started = Date.now();
    await expect(waitForTestId('never-appears', 40)).resolves.toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
