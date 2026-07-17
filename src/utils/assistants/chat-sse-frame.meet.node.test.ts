/* eslint-disable @typescript-eslint/naming-convention -- snake_case mirrors the Pub/Sub wire payload */
import { describe, it, expect } from 'vitest';
import { parseChatSseFrame } from '@/utils/assistants/chat-sse-frame';

const baseOpts = {
  myContactId: 1,
  sourceContext: undefined,
  rootKey: 'root',
  cutoffMs: 0,
};

describe('parseChatSseFrame — call session frames', () => {
  it('parses an assistant ring (call_incoming) with its session event', () => {
    const raw = JSON.stringify({
      thread: 'call_incoming',
      event: {
        call_id: 'sess-ring-1',
        scope: 'assistant_dm',
        created_by_assistant_id: 42,
        status: 'ringing',
      },
    });

    const frame = parseChatSseFrame(raw, baseOpts);

    expect(frame.kind).toBe('call-frame');
    if (frame.kind === 'call-frame') {
      expect(frame.action).toBe('incoming');
      expect(frame.eventData.call_id).toBe('sess-ring-1');
      expect(frame.eventData.created_by_assistant_id).toBe(42);
    }
  });

  it('parses lifecycle updates (answered/ended/declined)', () => {
    for (const action of ['answered', 'ended', 'declined'] as const) {
      const raw = JSON.stringify({
        thread: `call_${action}`,
        event: { call_id: 'sess-ring-1', scope: 'assistant_dm', status: 'ended' },
      });
      const frame = parseChatSseFrame(raw, baseOpts);
      expect(frame.kind).toBe('call-frame');
      if (frame.kind === 'call-frame') {
        expect(frame.action).toBe(action);
      }
    }
  });

  it('bypasses the transcript cutoff (idempotent lifecycle signal)', () => {
    const raw = JSON.stringify({
      thread: 'call_incoming',
      publishTime: new Date(0).toISOString(),
      event: { call_id: 'x', scope: 'assistant_dm', created_by_assistant_id: 1 },
    });

    const frame = parseChatSseFrame(raw, { ...baseOpts, cutoffMs: Date.now() });

    expect(frame.kind).toBe('call-frame');
  });

  it('ignores unknown call actions', () => {
    const raw = JSON.stringify({
      thread: 'call_participant_joined_bogus_extra',
      event: { call_id: 'x' },
    });

    const frame = parseChatSseFrame(raw, baseOpts);

    expect(frame.kind).toBe('ignored');
  });
});
