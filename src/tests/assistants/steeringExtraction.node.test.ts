/**
 * The runtime moved from per-call minted steering tools (`stop_<fn>_<id>`,
 * `pause_<fn>_<id>`, …) to a single static `steer(call_id, action, …)`
 * dispatcher. Live Actions must keep grouping both shapes under their
 * target row, and must never crash rendering on a malformed `steer` call —
 * a bad tool-call payload from the model is a live-transcript reality, not
 * an edge case.
 */
import { describe, expect, it } from 'vitest';
import {
  extractSteeringTarget,
  extractSteeringAction,
  extractLifecycleAnnouncement,
} from '@/lib/assistants/event-filters';

const STEER_ACTIONS = ['stop', 'pause', 'resume', 'interject', 'clarify', 'call', 'ask'] as const;

describe('extractSteeringTarget — legacy minted names', () => {
  it.each([
    ['stop_execute_code_cPPmyQGz', 'cPPmyQGz'],
    ['pause_execute_code_cPPmyQGz', 'cPPmyQGz'],
    ['resume_execute_code_cPPmyQGz', 'cPPmyQGz'],
    ['interject_execute_code_cPPmyQGz', 'cPPmyQGz'],
    ['stop_ask_xyz789', 'xyz789'],
  ])('parses %s to target %s', (name, expected) => {
    expect(extractSteeringTarget({ name })).toBe(expected);
  });

  it('is case-insensitive on the prefix', () => {
    expect(extractSteeringTarget({ name: 'STOP_execute_code_abc' })).toBe('abc');
  });

  it('refuses a name that is only a bare prefix with no target segment', () => {
    expect(extractSteeringTarget({ name: 'stop_x' })).toBeNull();
  });

  it('refuses ordinary, non-steering tool names', () => {
    expect(extractSteeringTarget({ name: 'execute_code' })).toBeNull();
    expect(extractSteeringTarget({ name: 'send_notification' })).toBeNull();
  });
});

describe('extractSteeringTarget — steer() dispatcher', () => {
  it.each(STEER_ACTIONS)('reads call_id out of a %s call regardless of action', (action) => {
    const args = JSON.stringify({ call_id: 'call_abc123', action });
    expect(extractSteeringTarget({ name: 'steer', arguments: args })).toBe('call_abc123');
  });

  it('is case-insensitive on the tool name', () => {
    const args = JSON.stringify({ call_id: 'call_abc123', action: 'stop' });
    expect(extractSteeringTarget({ name: 'STEER', arguments: args })).toBe('call_abc123');
  });

  it('returns the full call_id, not a truncated suffix', () => {
    const args = JSON.stringify({ call_id: 'a-very-long-full-tool-call-id-0001', action: 'pause' });
    expect(extractSteeringTarget({ name: 'steer', arguments: args })).toBe(
      'a-very-long-full-tool-call-id-0001'
    );
  });
});

describe('extractSteeringTarget — malformed steer() arguments never crash rendering', () => {
  it('returns null for non-JSON arguments', () => {
    expect(extractSteeringTarget({ name: 'steer', arguments: 'not json' })).toBeNull();
  });

  it('returns null when arguments are missing entirely', () => {
    expect(extractSteeringTarget({ name: 'steer' })).toBeNull();
  });

  it('returns null when call_id is absent', () => {
    expect(
      extractSteeringTarget({ name: 'steer', arguments: JSON.stringify({ action: 'stop' }) })
    ).toBeNull();
  });

  it('returns null when call_id is not a string', () => {
    expect(
      extractSteeringTarget({
        name: 'steer',
        arguments: JSON.stringify({ call_id: 42, action: 'stop' }),
      })
    ).toBeNull();
  });

  it('returns null when arguments is a JSON array instead of an object', () => {
    expect(extractSteeringTarget({ name: 'steer', arguments: '[]' })).toBeNull();
  });
});

describe('extractSteeringAction', () => {
  it.each(STEER_ACTIONS)('reads the %s action out of steer() arguments', (action) => {
    const args = JSON.stringify({ call_id: 'call_abc123', action });
    expect(extractSteeringAction({ name: 'steer', arguments: args })).toBe(action);
  });

  it.each([
    ['stop_execute_code_abc', 'stop'],
    ['pause_execute_code_abc', 'pause'],
    ['resume_execute_code_abc', 'resume'],
    ['interject_execute_code_abc', 'interject'],
  ])('derives the action from the legacy prefix of %s', (name, expected) => {
    expect(extractSteeringAction({ name })).toBe(expected);
  });

  it('returns null for an unrecognized action value', () => {
    const args = JSON.stringify({ call_id: 'call_abc123', action: 'teleport' });
    expect(extractSteeringAction({ name: 'steer', arguments: args })).toBeNull();
  });

  it('returns null for malformed arguments', () => {
    expect(extractSteeringAction({ name: 'steer', arguments: 'not json' })).toBeNull();
    expect(extractSteeringAction({ name: 'steer' })).toBeNull();
  });

  it('returns null for non-steering tool names', () => {
    expect(extractSteeringAction({ name: 'execute_code' })).toBeNull();
  });
});

describe('extractLifecycleAnnouncement', () => {
  it.each([
    ['[steerable call_123]', 'steerable', 'call_123', null],
    [
      '[askable call_456] Would you like to proceed?',
      'askable',
      'call_456',
      'Would you like to proceed?',
    ],
    ['[progress call_789] 42%', 'progress', 'call_789', '42%'],
    [
      '[clarification call_abc] What should I do next?',
      'clarification',
      'call_abc',
      'What should I do next?',
    ],
  ] as const)('parses %s', (content, tag, callId, detail) => {
    expect(extractLifecycleAnnouncement(content)).toEqual({ tag, callId, detail });
  });

  it('returns null for ordinary user speech', () => {
    expect(extractLifecycleAnnouncement('please cancel the meeting')).toBeNull();
  });

  it('returns null for null/undefined content', () => {
    expect(extractLifecycleAnnouncement(null)).toBeNull();
    expect(extractLifecycleAnnouncement(undefined)).toBeNull();
  });

  it('returns null for an unrecognized tag', () => {
    expect(extractLifecycleAnnouncement('[unknown call_123] hello')).toBeNull();
  });
});
