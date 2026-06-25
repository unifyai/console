import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomEvent } from 'livekit-client';
import { useAssistantCall } from '@/hooks/Assistants/useAssistantCall';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';

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

vi.mock('@/hooks/Assistants/useDesktopReady', () => ({
  useDesktopReady: () => ({
    isDesktopReady: false,
    eventLiveviewUrl: null,
  }),
}));

type Handler = (...args: any[]) => void;

class FakeRoom {
  state = 'disconnected';
  remoteParticipants = new Map();
  disconnectCalls = 0;
  handlers = new Map<string, Set<Handler>>();
  localParticipant = {
    setMicrophoneEnabled: vi.fn(async () => ({ mute: vi.fn(async () => undefined) })),
    setCameraEnabled: vi.fn(async () => undefined),
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

  emit(event: string, ...args: any[]) {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(...args);
    }
  }

  async connect() {
    this.state = 'connected';
  }

  async disconnect() {
    this.disconnectCalls += 1;
    this.state = 'disconnected';
    this.emit(RoomEvent.Disconnected);
  }
}

const assistant = {
  agentId: '1',
  userId: 'user-1',
  organizationId: null,
  name: 'T-W1N',
  isCoordinator: true,
} as unknown as Assistant;

function makeActions() {
  return {
    call: {
      getConnectionDetails: vi.fn(async () => ({
        serverUrl: 'wss://livekit.example',
        token: 'token',
        roomName: 'unity_1_meet',
      })),
      dispatchToCall: vi.fn(async () => ({})),
      deleteRoom: vi.fn(async () => ({})),
    },
    desktop: {
      getLiveviewUrl: vi.fn(),
      buildLiveviewUrl: vi.fn(),
      checkLiveviewHealth: vi.fn(),
      sendSystemEvent: vi.fn(),
    },
  } as unknown as Pick<AssistantActions, 'call' | 'desktop'>;
}

describe('useAssistantCall', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('dispatches with a stable call session id and does not delete the room on connect', async () => {
    const room = new FakeRoom();
    const actions = makeActions();
    const { result } = renderHook(() => useAssistantCall(room as any, actions));

    await act(async () => {
      await result.current.connect(assistant, 'audio');
    });

    expect(actions.call.deleteRoom).not.toHaveBeenCalled();
    expect(actions.call.dispatchToCall).toHaveBeenCalledWith(
      '1',
      'unity_1_meet',
      undefined,
      expect.stringMatching(/^meet-1-/)
    );
    expect(result.current.isWaitingForAssistant).toBe(true);
  });

  it('redispatches in-room on assistant disconnect without deleting or disconnecting the user', async () => {
    const room = new FakeRoom();
    const actions = makeActions();
    const { result } = renderHook(() => useAssistantCall(room as any, actions));

    await act(async () => {
      await result.current.connect(assistant, 'audio');
    });
    vi.clearAllMocks();

    act(() => {
      room.emit(RoomEvent.ParticipantDisconnected);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(actions.call.dispatchToCall).toHaveBeenCalledTimes(1);
    expect(actions.call.deleteRoom).not.toHaveBeenCalled();
    expect(room.disconnectCalls).toBe(0);

    expect(actions.call.deleteRoom).not.toHaveBeenCalled();
    expect(room.disconnectCalls).toBe(0);
  });

  it('surfaces redispatch failure without deleting or disconnecting the room', async () => {
    const room = new FakeRoom();
    const actions = makeActions();
    vi.mocked(actions.call.dispatchToCall)
      .mockResolvedValueOnce({})
      .mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAssistantCall(room as any, actions));

    await act(async () => {
      await result.current.connect(assistant, 'audio');
    });
    vi.mocked(actions.call.dispatchToCall).mockClear();

    act(() => {
      room.emit(RoomEvent.ParticipantDisconnected);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(actions.call.deleteRoom).not.toHaveBeenCalled();
    expect(room.disconnectCalls).toBe(0);
    expect(result.current.connectionError).toContain('had trouble rejoining');
  });

  it('deletes the room only after explicit hangup disconnects the browser room', async () => {
    const room = new FakeRoom();
    const actions = makeActions();
    const { result } = renderHook(() => useAssistantCall(room as any, actions));

    await act(async () => {
      await result.current.connect(assistant, 'audio');
    });

    expect(actions.call.deleteRoom).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.disconnect();
    });

    expect(room.disconnectCalls).toBe(1);
    expect(actions.call.deleteRoom).toHaveBeenCalledWith('unity_1_meet');
  });
});
