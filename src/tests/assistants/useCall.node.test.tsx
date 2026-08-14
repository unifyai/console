/**
 * Unified call engine tests: sessions drive every call.
 *
 * Covers the invariants the legacy 1:1 engine encoded, retargeted onto the
 * session-based flow: an assistant call creates an assistant_dm session and
 * connects (dev mode short-circuits LiveKit), a ring answer answers the
 * session instead of creating one, hangup ends the session (there is no
 * client-side room deletion anymore), and a dropped agent is recovered by an
 * idempotent server-side redispatch through POST /calls/{id}/assistants.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Assistant } from '@/types/assistants/assistant';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    loading: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/hooks/Assistants/useCallSounds', () => ({
  useCallSounds: () => ({
    startRinging: vi.fn(),
    stopRinging: vi.fn(),
    setRingingMuted: vi.fn(),
    playHangup: vi.fn(),
  }),
}));

const useDesktopReadyMock = vi.fn((..._args: unknown[]) => ({
  isDesktopReady: false,
  eventLiveviewUrl: null,
  eventBindingId: null,
  eventLiveviewPassword: null,
}));

vi.mock('@/hooks/Assistants/useDesktopReady', () => ({
  useDesktopReady: (...args: unknown[]) => useDesktopReadyMock(...args),
}));

vi.mock('@/lib/client/assistant', () => ({
  fetchAssistantStatus: vi.fn(async () => null),
}));

vi.mock('@/components/Pages/Providers/EnvironmentProvider', () => ({
  useEnvironment: () => ({ isSelfHost: false }),
  useFeatures: () => ({ voiceCalls: true }),
}));

const getConnectionDetailsMock = vi.fn(async (_roomName: string) => ({
  serverUrl: '',
  roomName: 'unity_call_sess-1',
  token: '',
  mode: 'dev' as const,
}));

vi.mock('@/lib/assistants/humanCall', () => ({
  getHumanCallConnectionDetails: (roomName: string) => getConnectionDetailsMock(roomName),
}));

import { useCall } from '@/hooks/Assistants/useCall';
import { fetchAssistantStatus } from '@/lib/client/assistant';

type Handler = (...args: any[]) => void;

class FakeRoom {
  state = 'disconnected';
  remoteParticipants = new Map();
  handlers = new Map<string, Set<Handler>>();
  localParticipant = {
    setMicrophoneEnabled: vi.fn(async () => ({ mute: vi.fn(async () => undefined) })),
    setCameraEnabled: vi.fn(async () => undefined),
    setScreenShareEnabled: vi.fn(async () => undefined),
  };

  on(event: string, handler: Handler) {
    const handlers = this.handlers.get(event) ?? new Set<Handler>();
    handlers.add(handler);
    this.handlers.set(event, handlers);
    return this;
  }

  off(event: string, handler: Handler) {
    this.handlers.get(event)?.delete(handler);
    return this;
  }

  async connect() {
    this.state = 'connected';
  }

  async disconnect() {
    this.state = 'disconnected';
    for (const handler of this.handlers.get('disconnected') ?? []) {
      handler();
    }
  }
}

const assistant = {
  agentId: '42',
  userId: 'user-1',
  organizationId: null,
  name: 'T-W1N',
  isCoordinator: false,
} as unknown as Assistant;

const desktopAssistant = {
  ...assistant,
  desktopMode: 'ubuntu',
  managedDesktopStatus: 'active',
} as unknown as Assistant;

const desktopActions = {
  desktop: {
    getLiveviewUrl: vi.fn(),
    buildLiveviewUrl: vi.fn(),
    checkLiveviewHealth: vi.fn(),
    sendSystemEvent: vi.fn(),
  },
} as any;

function sessionPayload(overrides: Record<string, unknown> = {}) {
  return {
    call_id: 'sess-1',
    room_name: 'unity_call_sess-1',
    status: 'active',
    scope: 'assistant_dm',
    created_by_user_id: 'user-1',
    user_ids: ['user-1'],
    assistant_ids: [42],
    participants: [{ user_id: 'user-1', role: 'host', status: 'joined' }],
    roster: [],
    ...overrides,
  };
}

function mockFetch() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => sessionPayload(),
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

describe('useCall (unified engine)', () => {
  beforeEach(() => {
    getConnectionDetailsMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('starting an assistant call creates an assistant_dm session and activates', async () => {
    const { calls } = mockFetch();
    const room = new FakeRoom();
    const { result } = renderHook(() =>
      useCall(room as any, desktopActions, { orgId: null, currentUserId: 'user-1' })
    );

    await act(async () => {
      await result.current.connect(assistant, 'audio');
    });

    const createCall = calls.find((c) => c.url === '/api/calls');
    expect(createCall).toBeDefined();
    const body = JSON.parse(String(createCall!.init?.body));
    expect(body.kind).toBe('assistant_dm');
    expect(body.assistantId).toBe(42);

    expect(result.current.isConnected).toBe(true);
    expect(result.current.callPhase).toBe('active');
    expect(result.current.activeCall?.callId).toBe('sess-1');
    expect(result.current.activeCallAssistant?.agentId).toBe('42');
  });

  it('answering a ring answers the existing session instead of creating one', async () => {
    const { calls } = mockFetch();
    const room = new FakeRoom();
    const { result } = renderHook(() =>
      useCall(room as any, desktopActions, { orgId: null, currentUserId: 'user-1' })
    );

    await act(async () => {
      await result.current.connect(assistant, 'audio', {
        callSessionId: 'sess-1',
        openingConfig: { mode: 'opener', openerText: '', source: 'unify_meet_ring' },
        waitForAssistantReady: true,
      });
    });

    expect(calls.some((c) => c.url === '/api/calls/sess-1/answer')).toBe(true);
    expect(calls.some((c) => c.url === '/api/calls')).toBe(false);
    expect(result.current.isConnected).toBe(true);
  });

  it('hangup ends the session server-side (no client room deletion)', async () => {
    const { calls } = mockFetch();
    const room = new FakeRoom();
    const { result } = renderHook(() =>
      useCall(room as any, desktopActions, { orgId: null, currentUserId: 'user-1' })
    );

    await act(async () => {
      await result.current.connect(assistant, 'audio');
    });
    await act(async () => {
      await result.current.disconnect();
    });

    expect(calls.some((c) => c.url === '/api/calls/sess-1/end')).toBe(true);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.activeCallAssistant).toBeNull();
  });

  it('addAssistant posts the idempotent server-side dispatch', async () => {
    const { calls } = mockFetch();
    const room = new FakeRoom();
    const { result } = renderHook(() =>
      useCall(room as any, desktopActions, { orgId: null, currentUserId: 'user-1' })
    );

    await act(async () => {
      await result.current.connect(assistant, 'audio');
    });
    await act(async () => {
      await result.current.addAssistant(42);
    });

    const dispatchCall = calls.find((c) => c.url === '/api/calls/sess-1/assistants');
    expect(dispatchCall).toBeDefined();
    expect(JSON.parse(String(dispatchCall!.init?.body)).assistantId).toBe(42);
  });

  it('an assistant without a managed Computer reports no desktop and skips its polls', async () => {
    mockFetch();
    const room = new FakeRoom();
    const { result } = renderHook(() =>
      useCall(room as any, desktopActions, { orgId: null, currentUserId: 'user-1' })
    );

    await act(async () => {
      await result.current.connect(assistant, 'audio');
    });

    expect(result.current.isDesktopEnabled).toBe(false);
    expect(vi.mocked(fetchAssistantStatus)).not.toHaveBeenCalled();
    // No assistant id reaches useDesktopReady, so it never polls for a liveview.
    expect(useDesktopReadyMock).toHaveBeenCalled();
    expect(useDesktopReadyMock.mock.calls.every((call) => call[0] === undefined)).toBe(true);
  });

  it('an assistant with an active managed Computer reports a desktop and polls for it', async () => {
    mockFetch();
    const room = new FakeRoom();
    const { result } = renderHook(() =>
      useCall(room as any, desktopActions, { orgId: null, currentUserId: 'user-1' })
    );

    await act(async () => {
      await result.current.connect(desktopAssistant, 'audio');
    });

    expect(result.current.isDesktopEnabled).toBe(true);
    expect(vi.mocked(fetchAssistantStatus)).toHaveBeenCalledWith('42');
    expect(useDesktopReadyMock.mock.calls.some((call) => call[0] === '42')).toBe(true);
  });

  it('a remote ended frame tears the call down', async () => {
    mockFetch();
    const room = new FakeRoom();
    const { result } = renderHook(() =>
      useCall(room as any, desktopActions, { orgId: null, currentUserId: 'user-1' })
    );

    await act(async () => {
      await result.current.connect(assistant, 'audio');
    });
    const active = result.current.activeCall!;
    await act(async () => {
      await result.current.handleRemoteEnded({ ...active, status: 'ended' });
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.activeCall).toBeNull();
  });

  describe('a failed room-call start must not latch the engine', () => {
    /**
     * ``isConnecting`` gates the call button on every room surface, so an engine
     * stuck in 'ringing' disables team and group calling with a page reload as
     * the only way back. Two paths could latch it: a create request that never
     * settles (this path had no timeout, unlike the assistant one), and a
     * ``failCall`` that left the reset to a Disconnected event the room never
     * emitted because it had not reached 'connected'.
     */

    it('a rejected create request returns the engine to idle', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'boom' }),
      })) as unknown as typeof fetch;
      vi.stubGlobal('fetch', fetchMock);
      const room = new FakeRoom();
      const { result } = renderHook(() =>
        useCall(room as any, desktopActions, { orgId: null, currentUserId: 'user-1' })
      );

      await act(async () => {
        await result.current.startTeamCall(56);
      });

      expect(result.current.isConnecting).toBe(false);
      expect(result.current.activeCall).toBeNull();
    });

    it('a create request that never settles times out rather than hanging', async () => {
      (window as any)._TEST_CALL_DISPATCH_TIMEOUT = 40;
      const fetchMock = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
      vi.stubGlobal('fetch', fetchMock);
      const room = new FakeRoom();
      const { result } = renderHook(() =>
        useCall(room as any, desktopActions, { orgId: null, currentUserId: 'user-1' })
      );

      await act(async () => {
        await result.current.startGroupCall(9);
      });

      expect(result.current.isConnecting).toBe(false);
      delete (window as any)._TEST_CALL_DISPATCH_TIMEOUT;
    });

    it('resets even when the room never emits Disconnected', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'boom' }),
      })) as unknown as typeof fetch;
      vi.stubGlobal('fetch', fetchMock);
      // A room mid-connect: disconnect() resolves silently, no event follows.
      const room = new FakeRoom();
      room.state = 'connecting';
      room.disconnect = vi.fn(async () => {});
      const { result } = renderHook(() =>
        useCall(room as any, desktopActions, { orgId: null, currentUserId: 'user-1' })
      );

      await act(async () => {
        await result.current.startTeamCall(56);
      });

      expect(result.current.isConnecting).toBe(false);
      expect(result.current.activeCall).toBeNull();
    });
  });

  describe('assistant desktop share state', () => {
    /** Deliver one `agent_status` data message the way the runtime would. */
    function publish(room: FakeRoom, message: Record<string, unknown>) {
      const payload = new TextEncoder().encode(JSON.stringify(message));
      for (const handler of room.handlers.get('dataReceived') ?? []) {
        handler(payload, undefined, undefined, 'agent_status');
      }
    }

    async function connectedCall() {
      mockFetch();
      const room = new FakeRoom();
      const { result } = renderHook(() =>
        useCall(room as any, desktopActions, { orgId: null, currentUserId: 'user-1' })
      );
      await act(async () => {
        await result.current.connect(desktopAssistant, 'audio');
      });
      return { room, result };
    }

    it('tracks which assistants are presenting, keyed by agent id', async () => {
      const { room, result } = await connectedCall();
      expect(result.current.assistantSharesById).toEqual({});

      await act(async () => {
        publish(room, { type: 'assistant_screenshare', assistantId: '42', active: true });
      });
      expect(result.current.assistantSharesById).toEqual({ '42': true });

      // A second assistant on the same call presents its own desktop.
      await act(async () => {
        publish(room, { type: 'assistant_screenshare', assistantId: '77', active: true });
      });
      expect(result.current.assistantSharesById).toEqual({ '42': true, '77': true });

      // One stopping must not disturb the other.
      await act(async () => {
        publish(room, { type: 'assistant_screenshare', assistantId: '42', active: false });
      });
      expect(result.current.assistantSharesById).toEqual({ '77': true });
    });

    it('ignores a restated share and a message with no assistant id', async () => {
      const { room, result } = await connectedCall();
      await act(async () => {
        publish(room, { type: 'assistant_screenshare', assistantId: '42', active: true });
      });
      const first = result.current.assistantSharesById;

      // The runtime restates state for late joiners; an unchanged restatement
      // must not produce a new object, or every rejoin rerenders the stage.
      await act(async () => {
        publish(room, { type: 'assistant_screenshare', assistantId: '42', active: true });
      });
      expect(result.current.assistantSharesById).toBe(first);

      await act(async () => {
        publish(room, { type: 'assistant_screenshare', active: true });
      });
      expect(result.current.assistantSharesById).toEqual({ '42': true });
    });

    it('clears share state when the call ends', async () => {
      const { room, result } = await connectedCall();
      await act(async () => {
        publish(room, { type: 'assistant_screenshare', assistantId: '42', active: true });
      });
      expect(result.current.assistantSharesById).toEqual({ '42': true });

      await act(async () => {
        await result.current.leaveCall();
      });
      expect(result.current.assistantSharesById).toEqual({});
    });
  });
});
