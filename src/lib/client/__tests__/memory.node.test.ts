import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSortingParam, fetchKnowledgeTables, fetchMemoryContext } from '@/lib/client/memory';
import type { Assistant } from '@/types/assistants/assistant';

const assistant: Assistant = {
  agentId: '42',
  userId: 'user-1',
  organizationId: null,
  isCoordinator: false,
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
                {
                  entries: {
                    content: 'personal newest',
                    timestamp: '2026-05-01T12:00:00Z',
                  },
                },
                {
                  entries: {
                    content: 'personal oldest',
                    timestamp: '2026-05-01T10:00:00Z',
                  },
                },
              ]
            : [
                {
                  entries: {
                    content: 'shared middle',
                    timestamp: '2026-05-01T11:00:00Z',
                  },
                },
              ];

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

  it('dedupes transcript fanout copies across roots', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'https://console.test');
        const context = url.searchParams.get('context');
        const logs =
          context === 'user-1/42/Transcripts'
            ? [
                {
                  entries: {
                    content: 'fanout duplicate',
                    medium: 'unify_message',
                    senderId: 10,
                    receiverIds: [9],
                    messageId: 41,
                    timestamp: '2026-05-01T10:01:00Z',
                  },
                },
              ]
            : [
                {
                  entries: {
                    content: 'fanout duplicate',
                    medium: 'unify_message',
                    senderId: 77,
                    receiverIds: [70],
                    messageId: 41,
                    timestamp: '2026-05-01T10:01:00Z',
                  },
                },
                {
                  entries: {
                    content: 'shared unique',
                    medium: 'unify_message',
                    senderId: 77,
                    receiverIds: [70],
                    messageId: 42,
                    timestamp: '2026-05-01T10:02:00Z',
                  },
                },
              ];

        return new Response(JSON.stringify({ logs, count: logs.length }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      })
    );

    const data = await fetchMemoryContext(assistant, 'Transcripts', {
      limit: 10,
      sorting: buildSortingParam('timestamp', 'desc'),
    });

    expect(data.rows.map((row) => (row as { content: string }).content)).toEqual([
      'shared unique',
      'fanout duplicate',
    ]);
    expect(
      data.rows.filter((row) => (row as { content: string }).content === 'fanout duplicate')
    ).toHaveLength(1);
  });

  it('marks transcript pages as exhausted after dedupe collapses all root rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'https://console.test');
        const context = url.searchParams.get('context');
        const senderId = context === 'user-1/42/Transcripts' ? 10 : 77;
        const receiverIds = context === 'user-1/42/Transcripts' ? [9] : [70];
        const logs = [
          {
            entries: {
              content: 'single logical row',
              medium: 'unify_message',
              senderId,
              receiverIds,
              messageId: 80,
              timestamp: '2026-05-01T10:01:00Z',
            },
          },
        ];
        return new Response(JSON.stringify({ logs, count: 1 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      })
    );

    const data = await fetchMemoryContext(assistant, 'Transcripts', {
      limit: 1,
      sorting: buildSortingParam('timestamp', 'desc'),
    });

    expect(data.rows).toHaveLength(1);
    expect(data.hasMore).toBe(false);
  });

  it('fetches only the selected personal root', async () => {
    const seenContexts: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'https://console.test');
        seenContexts.push(url.searchParams.get('context') ?? '');

        return new Response(JSON.stringify({ logs: [], count: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      })
    );

    await fetchMemoryContext(assistant, 'Contacts', {
      root: { kind: 'personal' },
    });

    expect(seenContexts).toEqual(['user-1/42/Contacts']);
  });

  it('fetches only the selected space root', async () => {
    const seenContexts: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'https://console.test');
        seenContexts.push(url.searchParams.get('context') ?? '');

        return new Response(JSON.stringify({ logs: [], count: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      })
    );

    await fetchMemoryContext(assistant, 'Contacts', {
      root: { kind: 'space', spaceId: 7 },
    });

    expect(seenContexts).toEqual(['Spaces/7/Contacts']);
  });

  it('discovers Knowledge tables only under the selected root', async () => {
    const seenLogContexts: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'https://console.test');

        if (url.pathname === '/api/context/Assistants') {
          return new Response(
            JSON.stringify([
              { name: 'user-1/42/Knowledge/PersonalNotes' },
              { name: 'Spaces/7/Knowledge/SharedRunbook' },
            ]),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          );
        }

        seenLogContexts.push(url.searchParams.get('context') ?? '');
        return new Response(
          JSON.stringify({
            logs: [{ entries: { title: 'shared row' } }],
            count: 1,
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        );
      })
    );

    const data = await fetchKnowledgeTables(assistant, {
      kind: 'space',
      spaceId: 7,
    });

    expect(seenLogContexts).toEqual(['Spaces/7/Knowledge/SharedRunbook']);
    expect(data.rows).toEqual([expect.objectContaining({ title: 'shared row' })]);
    expect(data.rows[0]?.['_table']).toBe('SharedRunbook');
  });
});
