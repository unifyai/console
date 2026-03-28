/**
 * Unit tests for useContactIdPrefetch hook and its utility functions.
 *
 * Tests cover:
 * - sessionStorage-backed contact ID cache (get/set, email scoping)
 * - Contact ID request deduplication (getOrFetchContactId)
 * - Transcript request deduplication (getOrFetchTranscripts)
 * - useContactIdPrefetch hook (prefetch lifecycle, write-if-absent, error resilience)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  getSessionContactId,
  setSessionContactId,
  getOrFetchContactId,
  getOrFetchTranscripts,
  useContactIdPrefetch,
} from '@/hooks/Assistants/useContactIdPrefetch';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { ChatMessage } from '@/types/assistants/chat';

// =============================================================================
// Helpers
// =============================================================================

const createMockAssistant = (overrides: Partial<Assistant> = {}): Assistant => ({
  agentId: 'assistant-1',
  userId: 'owner-1',
  organizationId: 1,
  firstName: 'Test',
  surname: 'Bot',
  age: 25,
  nationality: 'US',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  weeklyLimit: 1000,
  maxParallel: 5,
  voiceId: 'voice-1',
  voiceProvider: 'elevenlabs',
  profilePhoto: 'https://example.com/photo.jpg',
  profileVideo: null,
  signedProfilePhotoUrl: 'https://example.com/photo-signed.jpg',
  userFirstName: 'Owner',
  userLastName: 'User',
  about: null,
  phoneCountry: 'US',
  timezone: null,
  email: null,
  phone: null,
  assistantWhatsappNumber: null,
  userPhone: null,
  userWhatsappNumber: null,
  ...overrides,
});

const createMockChatActions = (
  overrides: Partial<AssistantActions['chat']> = {}
): Pick<AssistantActions, 'chat'> => ({
  chat: {
    getContactId: vi.fn(async () => 1),
    getTranscripts: vi.fn(async () => []),
    message: vi.fn(async () => ({ info: 'sent' })),
    getAssistantOwnerById: vi.fn(async () => null),
    ...overrides,
  },
});

const makeChatMessage = (id: string, role: 'user' | 'assistant' = 'assistant'): ChatMessage => ({
  id,
  role,
  content: `Message ${id}`,
  timestamp: new Date('2026-03-14T00:00:00Z'),
  attachments: [],
});

// =============================================================================
// SECTION 1: sessionStorage helpers
// =============================================================================
describe('sessionStorage contact ID helpers', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('returns undefined when nothing is cached', () => {
    expect(getSessionContactId('a-1', 'user@x.com')).toBeUndefined();
  });

  it('round-trips a contact ID', () => {
    setSessionContactId('a-1', 42, 'user@x.com');
    expect(getSessionContactId('a-1', 'user@x.com')).toBe(42);
  });

  it('scopes keys by email — different users never collide', () => {
    setSessionContactId('a-1', 1, 'alice@x.com');
    setSessionContactId('a-1', 2, 'bob@x.com');

    expect(getSessionContactId('a-1', 'alice@x.com')).toBe(1);
    expect(getSessionContactId('a-1', 'bob@x.com')).toBe(2);
  });

  it('scopes keys by assistantId', () => {
    setSessionContactId('a-1', 1, 'user@x.com');
    setSessionContactId('a-2', 5, 'user@x.com');

    expect(getSessionContactId('a-1', 'user@x.com')).toBe(1);
    expect(getSessionContactId('a-2', 'user@x.com')).toBe(5);
  });

  it('falls back to unscoped key when email is omitted', () => {
    setSessionContactId('a-1', 7);
    expect(getSessionContactId('a-1')).toBe(7);
    // Scoped lookup should NOT find the unscoped key
    expect(getSessionContactId('a-1', 'user@x.com')).toBeUndefined();
  });

  it('returns undefined for non-numeric cached values', () => {
    sessionStorage.setItem('assistant_contact_id:user@x.com:a-1', 'garbage');
    expect(getSessionContactId('a-1', 'user@x.com')).toBeUndefined();
  });
});

// =============================================================================
// SECTION 2: getOrFetchContactId — deduplication
// =============================================================================
describe('getOrFetchContactId', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('returns cached value from sessionStorage without calling the fetcher', async () => {
    setSessionContactId('a-1', 42, 'user@x.com');
    const fetcher = vi.fn();

    const result = await getOrFetchContactId(fetcher, 'user@x.com', 'owner-1', 'a-1');

    expect(result).toBe(42);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('calls the fetcher when nothing is cached and writes result to sessionStorage', async () => {
    const fetcher = vi.fn(async () => 3);

    const result = await getOrFetchContactId(fetcher, 'user@x.com', 'owner-1', 'a-1');

    expect(result).toBe(3);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(getSessionContactId('a-1', 'user@x.com')).toBe(3);
  });

  it('does not write null results to sessionStorage', async () => {
    const fetcher = vi.fn(async () => null);

    const result = await getOrFetchContactId(fetcher, 'user@x.com', 'owner-1', 'a-1');

    expect(result).toBeNull();
    expect(getSessionContactId('a-1', 'user@x.com')).toBeUndefined();
  });

  it('deduplicates concurrent calls — fetcher is called only once', async () => {
    let resolve!: (value: number | null) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<number | null>((r) => {
          resolve = r;
        })
    );

    // Fire two concurrent calls
    const p1 = getOrFetchContactId(fetcher, 'user@x.com', 'owner-1', 'a-1');
    const p2 = getOrFetchContactId(fetcher, 'user@x.com', 'owner-1', 'a-1');

    expect(fetcher).toHaveBeenCalledOnce();

    // Resolve and verify both get the same result
    resolve(10);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(10);
    expect(r2).toBe(10);
  });

  it('cleans up the dedup map after resolution — subsequent calls re-fetch', async () => {
    const fetcher = vi.fn(async () => 1);

    await getOrFetchContactId(fetcher, 'user@x.com', 'owner-1', 'a-1');
    expect(fetcher).toHaveBeenCalledOnce();

    // Clear sessionStorage to force a re-fetch
    sessionStorage.clear();
    await getOrFetchContactId(fetcher, 'user@x.com', 'owner-1', 'a-1');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('cleans up the dedup map even when the fetcher rejects', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('fail');
    });

    await expect(getOrFetchContactId(fetcher, 'user@x.com', 'owner-1', 'a-1')).rejects.toThrow(
      'fail'
    );

    // Should allow a fresh attempt
    const fetcher2 = vi.fn(async () => 5);
    sessionStorage.clear();
    const result = await getOrFetchContactId(fetcher2, 'user@x.com', 'owner-1', 'a-1');
    expect(result).toBe(5);
  });
});

// =============================================================================
// SECTION 3: getOrFetchTranscripts — deduplication
// =============================================================================
describe('getOrFetchTranscripts', () => {
  it('deduplicates concurrent calls — fetcher is called only once', async () => {
    let resolve!: (value: ChatMessage[]) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<ChatMessage[]>((r) => {
          resolve = r;
        })
    );

    const p1 = getOrFetchTranscripts(fetcher, 1, 'owner-1', 'a-1');
    const p2 = getOrFetchTranscripts(fetcher, 1, 'owner-1', 'a-1');

    expect(fetcher).toHaveBeenCalledOnce();

    const msgs = [makeChatMessage('1')];
    resolve(msgs);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(msgs);
    expect(r2).toBe(msgs); // Same reference — shared promise
  });

  it('uses different dedup keys for different contactIds', async () => {
    const fetcher = vi.fn(async () => []);

    await Promise.all([
      getOrFetchTranscripts(fetcher, 1, 'owner-1', 'a-1'),
      getOrFetchTranscripts(fetcher, 2, 'owner-1', 'a-1'),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('cleans up the dedup map after resolution', async () => {
    const fetcher = vi.fn(async () => []);

    await getOrFetchTranscripts(fetcher, 1, 'owner-1', 'a-1');
    await getOrFetchTranscripts(fetcher, 1, 'owner-1', 'a-1');

    // Called twice because the first resolved and was cleaned up
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('passes through error responses without caching', async () => {
    const fetcher = vi.fn(async () => ({ detail: 'not found' }));

    const result = await getOrFetchTranscripts(fetcher, 1, 'owner-1', 'a-1');

    expect(result).toEqual({ detail: 'not found' });
  });
});

// =============================================================================
// SECTION 4: useContactIdPrefetch hook
// =============================================================================
describe('useContactIdPrefetch', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  // Helper: mock a successful /api/logs contact ID response
  function mockContactIdResponse(contactId: number) {
    return new Response(
      JSON.stringify({
        logs: [{ id: 1, ts: '2026-01-01T00:00:00Z', entries: { contactId } }],
        count: 1,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Helper: mock a successful /api/logs transcripts response
  function mockTranscriptsResponse(
    messages: Array<{ id: number; senderId: number; content: string }>
  ) {
    return new Response(
      JSON.stringify({
        logs: messages.map((m) => ({
          id: m.id,
          ts: '2026-03-14T00:00:00Z',
          entries: {
            senderId: m.senderId,
            content: m.content,
            messageId: m.id,
            medium: 'unify_message',
            timestamp: '2026-03-14T00:00:00Z',
            attachments: [],
          },
        })),
        count: messages.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  it('does nothing when userEmail is null', () => {
    const actions = createMockChatActions();
    const assistants = [createMockAssistant()];

    renderHook(() => useContactIdPrefetch(assistants, actions, null));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does nothing when assistants list is empty', () => {
    const actions = createMockChatActions();

    renderHook(() => useContactIdPrefetch([], actions, 'user@x.com'));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches contact IDs for all assistants via direct fetch', async () => {
    fetchSpy.mockResolvedValue(mockContactIdResponse(1));

    const assistants = [
      createMockAssistant({ agentId: 'a-1', userId: 'o-1' }),
      createMockAssistant({ agentId: 'a-2', userId: 'o-2' }),
    ];
    const actions = createMockChatActions();

    renderHook(() => useContactIdPrefetch(assistants, actions, 'user@x.com'));

    await waitFor(() => {
      // Two contact ID fetches (one per assistant)
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    // Both should include /api/logs with Contacts context
    const urls = fetchSpy.mock.calls.map((c: any[]) => String(c[0]));
    expect(urls.every((u: string) => u.includes('/api/logs') && u.includes('Contacts'))).toBe(true);
  });

  it('writes resolved contact IDs to sessionStorage', async () => {
    fetchSpy.mockResolvedValue(mockContactIdResponse(5));

    const assistants = [createMockAssistant({ agentId: 'a-1' })];
    const actions = createMockChatActions();

    renderHook(() => useContactIdPrefetch(assistants, actions, 'user@x.com'));

    await waitFor(() => {
      expect(getSessionContactId('a-1', 'user@x.com')).toBe(5);
    });
  });

  it('skips contact ID fetch when already cached in sessionStorage', async () => {
    setSessionContactId('a-1', 42, 'user@x.com');

    const assistants = [createMockAssistant({ agentId: 'a-1' })];
    const actions = createMockChatActions();

    renderHook(() => useContactIdPrefetch(assistants, actions, 'user@x.com'));

    // Should NOT call fetch for the contact ID (already cached)
    // but WILL call fetch for transcripts
    await waitFor(() => {
      const urls = fetchSpy.mock.calls.map((c: any[]) => String(c[0]));
      // No Contacts fetch
      expect(urls.filter((u: string) => u.includes('Contacts'))).toHaveLength(0);
    });
  });

  it('fetches transcripts after resolving contact IDs and writes to chatHistories', async () => {
    // First call = contact ID, second call = transcripts
    fetchSpy.mockResolvedValueOnce(mockContactIdResponse(1)).mockResolvedValueOnce(
      mockTranscriptsResponse([
        { id: 100, senderId: 0, content: 'Hello!' },
        { id: 101, senderId: 1, content: 'Hi there' },
      ])
    );

    const assistants = [createMockAssistant({ agentId: 'a-1' })];
    const actions = createMockChatActions();
    const setChatHistories = vi.fn();

    renderHook(() => useContactIdPrefetch(assistants, actions, 'user@x.com', setChatHistories));

    await waitFor(() => {
      expect(setChatHistories).toHaveBeenCalled();
    });

    // Verify the updater function
    const updater = setChatHistories.mock.calls[0][0];
    const result = updater({});
    expect(result['a-1']).toHaveLength(2);
    // Transcripts are reversed (newest-first from API → chronological)
    expect(result['a-1'][0].content).toBe('Hi there');
    expect(result['a-1'][1].content).toBe('Hello!');
  });

  it('does not fetch transcripts when setChatHistories is not provided', async () => {
    fetchSpy.mockResolvedValue(mockContactIdResponse(1));

    const assistants = [createMockAssistant({ agentId: 'a-1' })];
    const actions = createMockChatActions();

    renderHook(
      () => useContactIdPrefetch(assistants, actions, 'user@x.com')
      // No setChatHistories argument
    );

    await waitFor(() => {
      expect(getSessionContactId('a-1', 'user@x.com')).toBe(1);
    });

    // Only the contact ID fetch, no transcript fetch
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain('Contacts');
  });

  it('write-if-absent: does not overwrite existing chatHistories', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockContactIdResponse(1))
      .mockResolvedValueOnce(
        mockTranscriptsResponse([{ id: 200, senderId: 0, content: 'Prefetched' }])
      );

    const assistants = [createMockAssistant({ agentId: 'a-1' })];
    const actions = createMockChatActions();
    const setChatHistories = vi.fn();

    renderHook(() => useContactIdPrefetch(assistants, actions, 'user@x.com', setChatHistories));

    await waitFor(() => {
      expect(setChatHistories).toHaveBeenCalled();
    });

    // Simulate: chatHistories already has data for a-1
    const updater = setChatHistories.mock.calls[0][0];
    const existingHistory = { 'a-1': [makeChatMessage('existing')] };
    const result = updater(existingHistory);

    // Should return the same object (no-op)
    expect(result).toBe(existingHistory);
  });

  it('does not re-prefetch the same assistant on re-render', async () => {
    fetchSpy.mockResolvedValue(mockContactIdResponse(1));

    const assistants = [createMockAssistant({ agentId: 'a-1' })];
    const actions = createMockChatActions();

    const { rerender } = renderHook(
      ({ assistants: a }) => useContactIdPrefetch(a, actions, 'user@x.com'),
      { initialProps: { assistants } }
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    // Re-render with the same assistants
    rerender({ assistants });

    // Should NOT fire another fetch
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('prefetches newly added assistants without re-fetching existing ones', async () => {
    fetchSpy.mockResolvedValue(mockContactIdResponse(1));

    const assistant1 = createMockAssistant({ agentId: 'a-1', userId: 'o-1' });
    const assistant2 = createMockAssistant({ agentId: 'a-2', userId: 'o-2' });
    const actions = createMockChatActions();

    const { rerender } = renderHook(
      ({ assistants: a }) => useContactIdPrefetch(a, actions, 'user@x.com'),
      { initialProps: { assistants: [assistant1] } }
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    // Add a second assistant
    rerender({ assistants: [assistant1, assistant2] });

    await waitFor(() => {
      // 1 original + 1 new = 2 total
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('silently ignores contact ID fetch failures', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));

    const assistants = [createMockAssistant({ agentId: 'a-1' })];
    const actions = createMockChatActions();
    const setChatHistories = vi.fn();

    // Should not throw
    renderHook(() => useContactIdPrefetch(assistants, actions, 'user@x.com', setChatHistories));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    // setChatHistories should never be called
    expect(setChatHistories).not.toHaveBeenCalled();
    // No sessionStorage entry
    expect(getSessionContactId('a-1', 'user@x.com')).toBeUndefined();
  });

  it('silently ignores transcript fetch failures but still caches the contact ID', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockContactIdResponse(3))
      .mockRejectedValueOnce(new Error('transcript fetch failed'));

    const assistants = [createMockAssistant({ agentId: 'a-1' })];
    const actions = createMockChatActions();
    const setChatHistories = vi.fn();

    renderHook(() => useContactIdPrefetch(assistants, actions, 'user@x.com', setChatHistories));

    await waitFor(() => {
      // Contact ID should still be cached even though transcripts failed
      expect(getSessionContactId('a-1', 'user@x.com')).toBe(3);
    });

    // setChatHistories should not be called (transcript fetch failed)
    expect(setChatHistories).not.toHaveBeenCalled();
  });

  it('skips transcript prefetch when contact ID resolves to null', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ logs: [], count: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const assistants = [createMockAssistant({ agentId: 'a-1' })];
    const actions = createMockChatActions();
    const setChatHistories = vi.fn();

    renderHook(() => useContactIdPrefetch(assistants, actions, 'user@x.com', setChatHistories));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    // Only the contact ID fetch, no transcript fetch
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain('Contacts');
    expect(setChatHistories).not.toHaveBeenCalled();
  });

  it('handles API error responses in transcripts gracefully', async () => {
    fetchSpy.mockResolvedValueOnce(mockContactIdResponse(1)).mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const assistants = [createMockAssistant({ agentId: 'a-1' })];
    const actions = createMockChatActions();
    const setChatHistories = vi.fn();

    renderHook(() => useContactIdPrefetch(assistants, actions, 'user@x.com', setChatHistories));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    // setChatHistories should not be called (error response)
    expect(setChatHistories).not.toHaveBeenCalled();
  });

  it('correctly maps transcript fields from API response', async () => {
    fetchSpy.mockResolvedValueOnce(mockContactIdResponse(1)).mockResolvedValueOnce(
      mockTranscriptsResponse([
        { id: 10, senderId: 0, content: 'Bot says hello' },
        { id: 11, senderId: 1, content: 'User replies' },
      ])
    );

    const assistants = [createMockAssistant({ agentId: 'a-1' })];
    const actions = createMockChatActions();
    const setChatHistories = vi.fn();

    renderHook(() => useContactIdPrefetch(assistants, actions, 'user@x.com', setChatHistories));

    await waitFor(() => {
      expect(setChatHistories).toHaveBeenCalled();
    });

    const updater = setChatHistories.mock.calls[0][0];
    const result = updater({});
    const msgs = result['a-1'] as ChatMessage[];

    // Reversed order (API returns newest-first)
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe('User replies');
    expect(msgs[0].id).toBe('11');
    expect(msgs[0].messageId).toBe(11);

    expect(msgs[1].role).toBe('assistant');
    expect(msgs[1].content).toBe('Bot says hello');
    expect(msgs[1].id).toBe('10');
  });

  it('uses correct filter expressions for contact ID and transcript queries', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockContactIdResponse(7))
      .mockResolvedValueOnce(mockTranscriptsResponse([]));

    const assistants = [createMockAssistant({ agentId: 'a-99', userId: 'o-55' })];
    const actions = createMockChatActions();
    const setChatHistories = vi.fn();

    renderHook(() => useContactIdPrefetch(assistants, actions, 'test@org.com', setChatHistories));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    // Contact ID query — URLSearchParams encodes spaces as `+`
    // decodeURIComponent doesn't decode `+`, so replace manually.
    const decodeUrl = (url: string) => decodeURIComponent(String(url)).replace(/\+/g, ' ');

    const contactUrl = decodeUrl(fetchSpy.mock.calls[0][0] as string);
    expect(contactUrl).toContain('context=All/Contacts');
    expect(contactUrl).toContain('email_address == "test@org.com"');
    expect(contactUrl).toContain("_assistant_id == 'a-99'");
    expect(contactUrl).toContain("_user_id == 'o-55'");

    // Transcript query
    const transcriptUrl = decodeUrl(fetchSpy.mock.calls[1][0] as string);
    expect(transcriptUrl).toContain('context=All/Transcripts');
    expect(transcriptUrl).toContain('sender_id == 7');
    expect(transcriptUrl).toContain("_assistant_id == 'a-99'");
  });
});
