import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSortingParam, fetchMemoryContext } from '@/lib/client/memory';
import type { Assistant } from '@/types/assistants/assistant';

const assistant: Assistant = {
  agentId: '42',
  userId: 'user-1',
  organizationId: null,
  firstName: 'Ava',
  surname: 'Repairs',
  jobTitle: null,
  profilePhoto: null,
  profileVideo: null,
  age: null,
  nationality: null,
  about: null,
  phoneCountry: null,
  timezone: null,
  voiceId: null,
  voiceProvider: null,
  email: null,
  phone: null,
  assistantWhatsappNumber: null,
  assistantDiscordBotId: null,
  userPhone: null,
  userWhatsappNumber: null,
  userDiscordId: null,
  weeklyLimit: null,
  maxParallel: null,
  spaceIds: [7],
  selfContactId: 9,
  bossContactId: 10,
  contactIdentityRoots: [
    {
      targetScope: 'personal',
      targetSpaceId: null,
      selfContactId: 9,
      bossContactId: 10,
    },
  ],
  createdAt: '2026-05-01T10:00:00Z',
  updatedAt: '2026-05-01T10:00:00Z',
};

describe('fetchMemoryContext merged pagination', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sorts and slices once after fetching readable roots', async () => {
    const seenUrls: URL[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'https://console.test');
        seenUrls.push(url);
        const context = url.searchParams.get('context');
        const logs =
          context === 'user-1/42/Transcripts'
            ? [
                { entries: { content: 'personal newest', timestamp: '2026-05-01T12:00:00Z' } },
                { entries: { content: 'personal oldest', timestamp: '2026-05-01T10:00:00Z' } },
              ]
            : [{ entries: { content: 'shared middle', timestamp: '2026-05-01T11:00:00Z' } }];

        return new Response(JSON.stringify({ logs, count: logs.length }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      })
    );

    const data = await fetchMemoryContext(assistant, 'Transcripts', {
      limit: 2,
      sorting: buildSortingParam('timestamp', 'desc'),
    });

    expect(data.rows.map((row) => (row as { content: string }).content)).toEqual([
      'personal newest',
      'shared middle',
    ]);
    expect(seenUrls.every((url) => !url.searchParams.has('offset'))).toBe(true);
  });
});
