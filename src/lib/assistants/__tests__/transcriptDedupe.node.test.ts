import { describe, expect, it } from 'vitest';

import { transcriptMergeDedupeKey } from '@/lib/assistants/transcriptDedupe';

describe('transcriptMergeDedupeKey', () => {
  it('matches fanout copies that differ only by root-local contact ids', () => {
    const personal = {
      messageId: 12,
      medium: 'unify_message',
      timestamp: '2026-05-15T15:21:04.000Z',
      exchangeId: 44,
      content: 'On it - I will check and repair those tables now.',
      senderId: 10,
      receiverIds: [9],
    };
    const shared = {
      messageId: 12,
      medium: 'unify_message',
      timestamp: '2026-05-15T15:21:04.000Z',
      exchangeId: 44,
      content: 'On it - I will check and repair those tables now.',
      senderId: 77,
      receiverIds: [70],
    };

    expect(transcriptMergeDedupeKey(personal, 'personal-row')).toBe(
      transcriptMergeDedupeKey(shared, 'shared-row')
    );
  });

  it('falls back to the row id when transcript fields are missing', () => {
    expect(transcriptMergeDedupeKey(undefined, 'row-1')).toBe('fallback:row-1');
    expect(transcriptMergeDedupeKey({}, 99)).toBe('fallback:99');
  });
});
