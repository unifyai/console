import { describe, expect, it } from 'vitest';
import {
  consoleScriptFrame,
  encodeConsoleScriptSse,
} from '@/lib/assistants/console-script-stream-frame';

/**
 * Off a Unify Meet there is no room the console is a participant in — a phone
 * call's room is the SIP leg, a text thread has none — so the moves arrive on
 * the assistant's event stream instead. Presence is what gates the feature, not
 * the medium, so this path carries most of its real use.
 */
describe('console script frames', () => {
  const payload = {
    thread: 'unity_system_event',
    event: {
      event_type: 'console_script',
      steps: [{ target: 'section:integrations' }, { target: 'leaf:contact:42' }],
    },
  };

  it('decodes a script published by the runtime', () => {
    const frame = consoleScriptFrame(payload);
    expect(frame?.type).toBe('ConsoleScript');
    expect(frame?.data.steps).toEqual([
      { target: 'section:integrations' },
      { target: 'leaf:contact:42' },
    ]);
  });

  it('encodes it as an SSE frame', () => {
    const sse = encodeConsoleScriptSse(payload);
    expect(sse).toMatch(/^data: /);
    expect(sse).toMatch(/\n\n$/);
    expect(JSON.parse(sse!.slice(6))).toMatchObject({ type: 'ConsoleScript' });
  });

  it.each([
    ['a different system event', { thread: 'unity_system_event', event: { event_type: 'ping' } }],
    ['a non-system thread', { thread: 'action_event', event: { event_type: 'console_script' } }],
    [
      'a script with no steps',
      { thread: 'unity_system_event', event: { event_type: 'console_script', steps: [] } },
    ],
    [
      'steps that are not a list',
      { thread: 'unity_system_event', event: { event_type: 'console_script', steps: 'nope' } },
    ],
    ['an empty payload', {}],
  ])('ignores %s', (_label, other) => {
    expect(consoleScriptFrame(other as Record<string, unknown>)).toBeNull();
    expect(encodeConsoleScriptSse(other as Record<string, unknown>)).toBeNull();
  });

  it('drops malformed steps but keeps the usable ones', () => {
    const frame = consoleScriptFrame({
      thread: 'unity_system_event',
      event: {
        event_type: 'console_script',
        steps: [{ target: 'section:tasks' }, { target: 42 }, {}, { target: '  ' }],
      },
    });
    expect(frame?.data.steps).toEqual([{ target: 'section:tasks' }]);
  });

  it('reads the snake_case the runtime actually publishes', () => {
    // Orchestra and the runtime speak snake_case; a frame that only decoded
    // camelCase would silently never match.
    const frame = consoleScriptFrame({
      thread: 'unity_system_event',
      event: { event_type: 'console_script', steps: [{ target: 'section:chat' }] },
    });
    expect(frame).not.toBeNull();
  });
});
