import { describe, expect, it } from 'vitest';

import { parseChatSseFrame } from '@/utils/assistants/chat-sse-frame';

describe('parseChatSseFrame', () => {
  it('records the contact subscription used to accept and ack a frame', () => {
    const frame = parseChatSseFrame(
      JSON.stringify({
        id: 'msg-1',
        __ackId: 'ack-1',
        publishTime: '2026-05-01T10:00:00Z',
        thread: 'unify_message_outbound',
        event: {
          ['contact_id']: 77,
          content: 'hello from a shared root',
        },
      }),
      { myContactId: 77, rootKey: 'space-7', sourceContext: 'Spaces/7/Transcripts', cutoffMs: 0 }
    );

    expect(frame).toMatchObject({
      kind: 'chat',
      parsed: {
        contactId: 77,
        rootKey: 'space-7',
        sourceContext: 'Spaces/7/Transcripts',
        message: {
          id: 'msg-1',
          content: 'hello from a shared root',
          sourceContext: 'Spaces/7/Transcripts',
          __ackId: 'ack-1',
        },
      },
    });
  });

  it('filters frames delivered to a different contact subscription', () => {
    const frame = parseChatSseFrame(
      JSON.stringify({
        id: 'msg-1',
        __ackId: 'ack-1',
        publishTime: '2026-05-01T10:00:00Z',
        thread: 'unify_message_outbound',
        event: {
          ['contact_id']: 77,
          content: 'hello from a shared root',
        },
      }),
      { myContactId: 10, rootKey: 'personal', cutoffMs: 0 }
    );

    expect(frame).toMatchObject({
      kind: 'filtered',
      reason: 'contact',
      ackId: 'ack-1',
      details: {
        msgContact: 77,
        myContact: 10,
      },
    });
  });

  it('filters frames tagged for a different source context', () => {
    const frame = parseChatSseFrame(
      JSON.stringify({
        id: 'msg-1',
        __ackId: 'ack-1',
        publishTime: '2026-05-01T10:00:00Z',
        thread: 'unify_message_outbound',
        event: {
          ['contact_id']: 77,
          sourceContext: 'Spaces/9/Transcripts',
          content: 'hello from a different root',
        },
      }),
      { myContactId: 77, rootKey: 'space-7', sourceContext: 'Spaces/7/Transcripts', cutoffMs: 0 }
    );

    expect(frame).toMatchObject({
      kind: 'filtered',
      reason: 'root',
      ackId: 'ack-1',
      details: {
        msgSourceContext: 'Spaces/9/Transcripts',
        mySourceContext: 'Spaces/7/Transcripts',
      },
    });
  });
});
