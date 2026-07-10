/* eslint-disable @typescript-eslint/naming-convention -- snake_case mirrors the Pub/Sub wire payload */
import { describe, it, expect } from 'vitest';
import { parseChatSseFrame } from '@/utils/assistants/chat-sse-frame';

const baseOpts = {
  myContactId: 1,
  sourceContext: undefined,
  rootKey: 'root',
  cutoffMs: 0,
};

describe('parseChatSseFrame — unify_meet_incoming', () => {
  it('parses a meet-incoming ring frame with its event data', () => {
    const raw = JSON.stringify({
      thread: 'unify_meet_incoming',
      event: { call_session_id: 'meet-ring-1', reason: 'Continuing onboarding', contact_id: 1 },
    });

    const frame = parseChatSseFrame(raw, baseOpts);

    expect(frame.kind).toBe('meet-incoming');
    if (frame.kind === 'meet-incoming') {
      expect(frame.ackId).toBeUndefined();
      expect(frame.eventData.call_session_id).toBe('meet-ring-1');
      expect(frame.eventData.reason).toBe('Continuing onboarding');
    }
  });

  it('bypasses the transcript cutoff (it is an idempotent lifecycle signal)', () => {
    const raw = JSON.stringify({
      thread: 'unify_meet_incoming',
      publishTime: new Date(0).toISOString(),
      event: { call_session_id: 'x', contact_id: 1 },
    });

    const frame = parseChatSseFrame(raw, { ...baseOpts, cutoffMs: Date.now() });

    expect(frame.kind).toBe('meet-incoming');
  });

  it('still respects the per-contact filter', () => {
    const raw = JSON.stringify({
      thread: 'unify_meet_incoming',
      event: { call_session_id: 'x', contact_id: 2 },
    });

    const frame = parseChatSseFrame(raw, baseOpts);

    expect(frame.kind).toBe('filtered');
  });
});
