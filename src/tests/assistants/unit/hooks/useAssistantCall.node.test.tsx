/**
 * Unit tests for src/hooks/Assistants/useAssistantCall.ts
 *
 * Tests the call hook logic for managing LiveKit call state.
 * Uses React Testing Library's renderHook with mocked LiveKit Room.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAssistantCall } from '@/hooks/Assistants/useAssistantCall';
import { RoomEvent } from 'livekit-client';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';

// Mock BroadcastChannel (not available in jsdom)
class MockBroadcastChannel {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();
}
(global as any).BroadcastChannel = MockBroadcastChannel;

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Factory for mock assistant
const createMockAssistant = (overrides: Partial<Assistant> = {}): Assistant => ({
  agentId: 'assistant-1',
  firstName: 'Jane',
  surname: 'Doe',
  userId: 'user-123',
  organizationId: null,
  age: 30,
  nationality: 'US',
  timezone: 'UTC',
  profilePhoto: null,
  profileVideo: null,
  about: null,
  voiceId: 'v1',
  voiceProvider: 'elevenlabs',
  email: null,
  phone: null,
  phoneCountry: null,
  userPhone: null,
  userWhatsappNumber: null,
  assistantWhatsappNumber: null,
  weeklyLimit: 50,
  maxParallel: null,
  signedProfilePhotoUrl: undefined,
  signedProfileVideoUrl: undefined,
  isUserDesktop: false,
  desktopMode: null,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  ...overrides,
});

// Factory for mock room
const createMockRoom = () => {
  const eventHandlers = new Map<RoomEvent, Function[]>();

  return {
    state: 'disconnected' as string,
    numParticipants: 1,
    get remoteParticipants() {
      const count = Math.max(0, this.numParticipants - 1);
      const map = new Map();
      for (let i = 0; i < count; i++) map.set(`remote-${i}`, { identity: `remote-${i}` });
      return map;
    },
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    localParticipant: {
      setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
      setCameraEnabled: vi.fn().mockResolvedValue(undefined),
    },
    on: vi.fn((event: RoomEvent, handler: Function) => {
      const handlers = eventHandlers.get(event) || [];
      handlers.push(handler);
      eventHandlers.set(event, handlers);
    }),
    off: vi.fn((event: RoomEvent, handler: Function) => {
      const handlers = eventHandlers.get(event) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    }),
    // Helper to trigger events in tests
    _triggerEvent: (event: RoomEvent, ...args: any[]) => {
      const handlers = eventHandlers.get(event) || [];
      handlers.forEach((h) => h(...args));
    },
  };
};

// Factory for mock assistant actions
const createMockAssistantActions = (): AssistantActions => ({
  assistant: {
    list: vi.fn(),
    status: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    check: vi.fn(),
  },
  chat: {
    getContactId: vi.fn(),
    getTranscripts: vi.fn(),
    message: vi.fn(),
    getAssistantOwnerById: vi.fn(),
  },
  call: {
    getConnectionDetails: vi.fn().mockResolvedValue({
      serverUrl: 'wss://livekit.example.com',
      roomName: 'test-room',
      token: 'test-token',
    }),
    dispatchToCall: vi.fn().mockResolvedValue({ info: 'dispatched' }),
    deleteRoom: vi.fn().mockResolvedValue({}),
  },
  voice: {
    list: vi.fn(),
    register: vi.fn(),
    delete: vi.fn(),
    clone: vi.fn(),
    generate: vi.fn(),
    preview: vi.fn(),
    design: vi.fn(),
  },
  contact: {
    listAllAssistantEmails: vi.fn(),
    listAvailablePhoneCountries: vi.fn(),
    listAvailableSocialPlatforms: vi.fn(),
    verifySocialAccount: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
    fetchContactCosts: vi.fn(),
  },
  photo: {
    upload: vi.fn(),
    uploadVideo: vi.fn(),
    download: vi.fn(),
    downloadPresetVideo: vi.fn(),
    generate: vi.fn(),
    edit: vi.fn(),
    animate: vi.fn(),
    getAnimation: vi.fn(),
    cancelAnimation: vi.fn(),
  },
  secret: {
    get: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  desktop: {
    getLiveviewUrl: vi.fn(),
    checkLiveviewHealth: vi.fn().mockResolvedValue(true),
    sendSystemEvent: vi.fn(),
    listUserDesktops: vi.fn(),
  },
  approval: {
    getProfile: vi.fn(),
    requestAccess: vi.fn(),
    claimToken: vi.fn(),
  },
  spending: {
    getSpend: vi.fn(),
    getLimit: vi.fn(),
    setLimit: vi.fn(),
  },
});

describe('useAssistantCall', () => {
  let mockRoom: ReturnType<typeof createMockRoom>;
  let mockActions: AssistantActions;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRoom = createMockRoom();
    mockActions = createMockAssistantActions();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Initial State', () => {
    it(
      'initializes with disconnected state',
      {
        meta: {
          alias: 'Call-InitialDisconnected',
          scenario: 'Hook initializes',
          behavior: 'isConnected is false',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        // Assert
        expect(result.current.isConnected).toBe(false);
        expect(result.current.isConnecting).toBe(false);
      }
    );

    it(
      'initializes with no active assistant',
      {
        meta: {
          alias: 'Call-NoActiveAssistant',
          scenario: 'Hook initializes',
          behavior: 'activeCallAssistant is null',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        // Assert
        expect(result.current.activeCallAssistant).toBeNull();
      }
    );

    it(
      'initializes with speaker unmuted',
      {
        meta: {
          alias: 'Call-SpeakerUnmuted',
          scenario: 'Hook initializes',
          behavior: 'isSpeakerMuted is false',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        // Assert
        expect(result.current.isSpeakerMuted).toBe(false);
      }
    );

    it(
      'initializes with remote control inactive',
      {
        meta: {
          alias: 'Call-RemoteControlOff',
          scenario: 'Hook initializes',
          behavior: 'isRemoteControlActive is false',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        // Assert
        expect(result.current.isRemoteControlActive).toBe(false);
        expect(result.current.liveviewUrl).toBeNull();
      }
    );
  });

  describe('Connect', () => {
    it(
      'sets connecting state when connect is called',
      {
        meta: {
          alias: 'Call-ConnectingState',
          scenario: 'User initiates call',
          behavior: 'isConnecting becomes true',
        },
      },
      async () => {
        // Arrange
        const assistant = createMockAssistant();

        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        act(() => {
          result.current.connect(assistant, 'video');
        });

        // Assert
        expect(result.current.isConnecting).toBe(true);
      }
    );

    it(
      'sets active assistant when connecting',
      {
        meta: {
          alias: 'Call-ActiveAssistant',
          scenario: 'User initiates call',
          behavior: 'activeCallAssistant is set',
        },
      },
      async () => {
        // Arrange
        const assistant = createMockAssistant({ firstName: 'TestAssistant' });

        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        act(() => {
          result.current.connect(assistant, 'audio');
        });

        // Assert
        expect(result.current.activeCallAssistant?.firstName).toBe('TestAssistant');
      }
    );

    it(
      'sets call type when connecting',
      {
        meta: {
          alias: 'Call-CallType',
          scenario: 'User initiates video call',
          behavior: 'callType is set to video',
        },
      },
      async () => {
        // Arrange
        const assistant = createMockAssistant();

        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        act(() => {
          result.current.connect(assistant, 'video');
        });

        // Assert
        expect(result.current.callType).toBe('video');
      }
    );

    it(
      'does not connect if room is not disconnected',
      {
        meta: {
          alias: 'Call-NoReconnect',
          scenario: 'Room is already connecting/connected',
          behavior: 'connect returns early',
        },
      },
      async () => {
        // Arrange
        mockRoom.state = 'connected';
        const assistant = createMockAssistant();

        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        await act(async () => {
          await result.current.connect(assistant, 'video');
        });

        // Assert - getConnectionDetails should not be called
        expect(mockActions.call.getConnectionDetails).not.toHaveBeenCalled();
      }
    );

    it(
      'calls getConnectionDetails with correct params',
      {
        meta: {
          alias: 'Call-ConnectionDetails',
          scenario: 'Connecting to call',
          behavior: 'Fetches connection details for assistant',
        },
      },
      async () => {
        // Arrange
        const assistant = createMockAssistant({
          agentId: 'agent-123',
          firstName: 'Jane',
          surname: 'Doe',
        });

        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        await act(async () => {
          await result.current.connect(assistant, 'video');
        });

        // Assert
        expect(mockActions.call.getConnectionDetails).toHaveBeenCalledWith('agent-123', 'JaneDoe');
      }
    );

    it(
      'dispatches assistant to call with deterministic room name',
      {
        meta: {
          alias: 'Call-Dispatch',
          scenario: 'User initiates call',
          behavior: 'Dispatches assistant with deterministic room name (unity_{id}_meet)',
        },
      },
      async () => {
        // Arrange
        const assistant = createMockAssistant({ agentId: 'agent-123' });

        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        await act(async () => {
          await result.current.connect(assistant, 'video');
        });

        // Assert — dispatch uses the deterministic room name, not the one from getConnectionDetails
        expect(mockActions.call.dispatchToCall).toHaveBeenCalledWith(
          'agent-123',
          'unity_agent-123_meet'
        );
      }
    );

    it(
      'connects room with serverUrl and token',
      {
        meta: {
          alias: 'Call-RoomConnect',
          scenario: 'Dispatch successful',
          behavior: 'Room.connect called with correct params',
        },
      },
      async () => {
        // Arrange
        const assistant = createMockAssistant();

        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        await act(async () => {
          await result.current.connect(assistant, 'video');
        });

        // Assert
        expect(mockRoom.connect).toHaveBeenCalledWith('wss://livekit.example.com', 'test-token');
      }
    );

    it(
      'enables microphone after connecting',
      {
        meta: {
          alias: 'Call-EnableMic',
          scenario: 'Room connected',
          behavior: 'Microphone is enabled',
        },
      },
      async () => {
        // Arrange
        const assistant = createMockAssistant();

        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        await act(async () => {
          await result.current.connect(assistant, 'audio');
        });

        // Assert
        expect(mockRoom.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
      }
    );

    it(
      'enables camera for video call',
      {
        meta: {
          alias: 'Call-EnableCamera',
          scenario: 'Video call started',
          behavior: 'Camera is enabled',
        },
      },
      async () => {
        // Arrange
        const assistant = createMockAssistant();

        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        await act(async () => {
          await result.current.connect(assistant, 'video');
        });

        // Assert
        expect(mockRoom.localParticipant.setCameraEnabled).toHaveBeenCalledWith(true);
      }
    );

    it(
      'disables camera for audio call',
      {
        meta: {
          alias: 'Call-DisableCameraAudio',
          scenario: 'Audio-only call started',
          behavior: 'Camera is disabled',
        },
      },
      async () => {
        // Arrange
        const assistant = createMockAssistant();

        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        await act(async () => {
          await result.current.connect(assistant, 'audio');
        });

        // Assert
        expect(mockRoom.localParticipant.setCameraEnabled).toHaveBeenCalledWith(false);
      }
    );
  });

  describe('Disconnect', () => {
    it(
      'disconnects room when disconnect is called',
      {
        meta: {
          alias: 'Call-Disconnect',
          scenario: 'User ends call',
          behavior: 'Room is disconnected',
        },
      },
      async () => {
        // Arrange
        mockRoom.state = 'connected';

        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        await act(async () => {
          await result.current.disconnect();
        });

        // Assert
        expect(mockRoom.disconnect).toHaveBeenCalled();
      }
    );
  });

  describe('Speaker Mute Toggle', () => {
    it(
      'toggles speaker mute state',
      {
        meta: {
          alias: 'Call-ToggleSpeaker',
          scenario: 'User toggles speaker',
          behavior: 'isSpeakerMuted toggles',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        expect(result.current.isSpeakerMuted).toBe(false);

        act(() => {
          result.current.toggleSpeakerMute();
        });

        expect(result.current.isSpeakerMuted).toBe(true);

        act(() => {
          result.current.toggleSpeakerMute();
        });

        expect(result.current.isSpeakerMuted).toBe(false);
      }
    );
  });

  describe('Room Deletion', () => {
    it(
      'proactively deletes stale room before connecting',
      {
        meta: {
          alias: 'Call-ProactiveDelete',
          scenario: 'User initiates a new call',
          behavior:
            'deleteRoom is called before getConnectionDetails to clear stale rooms from previous failed attempts',
        },
      },
      async () => {
        const assistant = createMockAssistant({ agentId: 'agent-42' });

        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        await act(async () => {
          await result.current.connect(assistant, 'audio');
        });

        expect(mockActions.call.deleteRoom).toHaveBeenCalledTimes(1);
        expect(mockActions.call.deleteRoom).toHaveBeenCalledWith('unity_agent-42_meet');
      }
    );

    it(
      'does not delete room on normal user disconnect',
      {
        meta: {
          alias: 'Call-NoDeleteOnDisconnect',
          scenario: 'User ends the call normally',
          behavior: 'deleteRoom is NOT called during disconnect',
        },
      },
      async () => {
        // Arrange
        const assistant = createMockAssistant({ agentId: 'agent-99' });

        // Act - connect first, then disconnect
        const { result } = renderHook(() => useAssistantCall(mockRoom as any, mockActions));

        await act(async () => {
          await result.current.connect(assistant, 'video');
        });

        // Clear mock to isolate disconnect behavior from stale-room cleanup during connect
        (mockActions.call.deleteRoom as any).mockClear();

        // The room state needs to be 'connected' for disconnect to call room.disconnect
        mockRoom.state = 'connected';

        await act(async () => {
          await result.current.disconnect();
        });

        // Assert - deleteRoom should NOT be called on normal disconnect
        expect(mockActions.call.deleteRoom).not.toHaveBeenCalled();
      }
    );
  });

  // Note: Error handling tests for connect() are complex due to retry logic
  // and room state management. These scenarios are better tested in integration
  // tests where the full call flow can be observed.
});
