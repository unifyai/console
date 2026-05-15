import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchTranscriptsDirect } from '@/hooks/Assistants/useContactIdPrefetch';
import { getTranscripts } from '@/lib/assistants/chat';
import { transcriptMergeDedupeKey } from '@/lib/assistants/transcriptDedupe';
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
    {
      targetScope: 'space',
      targetSpaceId: 7,
      selfContactId: 70,
      bossContactId: 77,
    },
  ],
  createdAt: '2026-05-01T10:00:00Z',
  updatedAt: '2026-05-01T10:00:00Z',
};

function log(id: number, content: string, senderId: number) {
  return {
    id,
    entries: {
      content,
      senderId,
      timestamp: `2026-05-01T10:0${id}:00Z`,
      messageId: id,
      attachments: [],
    },
  };
}

describe('contact-scoped root reads', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('queries each root with that root-local contact id', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://console.test');
      const context = url.searchParams.get('context');
      const filterExpr = url.searchParams.get('filterExpr') ?? '';
      const personalFanoutCopy = {
        id: 'personal-fanout',
        entries: {
          medium: 'unify_message',
          content: 'fanout duplicate row',
          senderId: 10,
          timestamp: '2026-05-01T10:01:00Z',
          messageId: 41,
          attachments: [],
        },
      };
      const sharedFanoutCopy = {
        id: 'shared-fanout',
        entries: {
          medium: 'unify_message',
          content: 'fanout duplicate row',
          senderId: 77,
          timestamp: '2026-05-01T10:01:00Z',
          messageId: 41,
          attachments: [],
        },
      };
      const sharedUniqueRow = {
        id: 'shared-unique',
        entries: {
          medium: 'unify_message',
          content: 'shared owner row',
          senderId: 77,
          timestamp: '2026-05-01T10:02:00Z',
          messageId: 42,
          attachments: [],
        },
      };
      const logs =
        context === 'user-1/42/Transcripts' && filterExpr.includes('sender_id == 10')
          ? [personalFanoutCopy]
          : context === 'Spaces/7/Transcripts' && filterExpr.includes('sender_id == 77')
            ? [sharedFanoutCopy, sharedUniqueRow]
            : [log(3, 'decoy shared personal-id row', 10)];

      return new Response(JSON.stringify({ logs }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchTranscriptsDirect(10, assistant, 10);

    expect('detail' in result).toBe(false);
    expect(result).toMatchObject([
      { content: 'shared owner row', role: 'user' },
      { content: 'fanout duplicate row', role: 'user' },
    ]);
    const transcriptRows = result as { content?: string }[];
    expect(transcriptRows.filter((row) => row.content === 'fanout duplicate row')).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('dedupes fanout copies in getTranscripts while keeping unique rows', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://console.test');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const context = url.searchParams.get('context');
      const filterExpr = url.searchParams.get('filterExpr') ?? '';

      const logs =
        context === 'user-1/42/Transcripts' && filterExpr.includes('sender_id == 10')
          ? [
              {
                id: 'personal-fanout',
                entries: {
                  medium: 'unify_message',
                  content: 'fanout duplicate row',
                  senderId: 10,
                  timestamp: '2026-05-01T10:01:00Z',
                  messageId: 41,
                  attachments: [],
                },
              },
            ]
          : context === 'Spaces/7/Transcripts' && filterExpr.includes('sender_id == 77')
            ? [
                {
                  id: 'shared-fanout',
                  entries: {
                    medium: 'unify_message',
                    content: 'fanout duplicate row',
                    senderId: 77,
                    timestamp: '2026-05-01T10:01:00Z',
                    messageId: 41,
                    attachments: [],
                  },
                },
                {
                  id: 'shared-unique',
                  entries: {
                    medium: 'unify_message',
                    content: 'shared unique row',
                    senderId: 77,
                    timestamp: '2026-05-01T10:02:00Z',
                    messageId: 42,
                    attachments: [],
                  },
                },
              ]
            : [];

      return new Response(JSON.stringify({ logs }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const action = await getTranscripts('test-key');
    const result = await action(10, assistant);

    expect('detail' in result).toBe(false);
    expect(result).toMatchObject([
      { content: 'shared unique row' },
      { content: 'fanout duplicate row', sourceContext: 'user-1/42/Transcripts' },
    ]);
    const transcriptRows = result as { content?: string }[];
    expect(transcriptRows.filter((row) => row.content === 'fanout duplicate row')).toHaveLength(1);
  });

  it('respects merge-key exclusions when a boundary row resolves to another root', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://console.test');
    const sharedBoundary = {
      medium: 'unify_message',
      content: 'already visible boundary row',
      senderId: 77,
      timestamp: '2026-05-01T10:00:00Z',
      messageId: 50,
      attachments: [],
    };
    const excludedMergeKey = transcriptMergeDedupeKey(
      { ...sharedBoundary, senderId: 10, receiverIds: [9] },
      'personal-boundary'
    );
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const context = url.searchParams.get('context');
      const filterExpr = url.searchParams.get('filterExpr') ?? '';

      expect(filterExpr).toContain('timestamp <= "2026-05-01T10:00:00.000Z"');

      const logs =
        context === 'user-1/42/Transcripts'
          ? []
          : [
              {
                id: 'shared-boundary',
                entries: {
                  ...sharedBoundary,
                },
              },
            ];

      return new Response(JSON.stringify({ logs }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const action = await getTranscripts('test-key');
    const result = await action(10, assistant, {
      timestamp: '2026-05-01T10:00:00.000Z',
      excludedKeys: [excludedMergeKey],
    });

    expect('detail' in result).toBe(false);
    expect(result).toEqual([]);
  });

  it('keeps same-timestamp boundary rows eligible when loading more', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://console.test');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const context = url.searchParams.get('context');
      const filterExpr = url.searchParams.get('filterExpr') ?? '';

      expect(filterExpr).toContain('timestamp <= "2026-05-01T10:00:00.000Z"');

      const logs =
        context === 'user-1/42/Transcripts'
          ? [
              {
                id: 'personal-boundary',
                entries: {
                  content: 'already visible',
                  senderId: 10,
                  timestamp: '2026-05-01T10:00:00Z',
                  messageId: 50,
                  attachments: [],
                },
              },
              {
                id: 'personal-same-timestamp',
                entries: {
                  content: 'same timestamp next page',
                  senderId: 10,
                  timestamp: '2026-05-01T10:00:00Z',
                  messageId: 49,
                  attachments: [],
                },
              },
            ]
          : [
              {
                id: 'shared-same-timestamp',
                entries: {
                  content: 'shared same timestamp next page',
                  senderId: 77,
                  timestamp: '2026-05-01T10:00:00Z',
                  messageId: 48,
                  attachments: [],
                },
              },
            ];

      return new Response(JSON.stringify({ logs }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const action = await getTranscripts('test-key');
    const result = await action(10, assistant, {
      timestamp: '2026-05-01T10:00:00.000Z',
      excludedKeys: ['user-1/42/Transcripts:50'],
    });

    expect('detail' in result).toBe(false);
    expect(result).toMatchObject([
      {
        content: 'same timestamp next page',
        sourceContext: 'user-1/42/Transcripts',
      },
      {
        content: 'shared same timestamp next page',
        sourceContext: 'Spaces/7/Transcripts',
      },
    ]);
  });
});
