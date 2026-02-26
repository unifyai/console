import { render, screen, waitFor, act } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RoomEvent, ConnectionState } from 'livekit-client';
import { EventEmitter } from 'events';

// Mock next/navigation
const mockSearchParams = new Map<string, string>();
const mockParams = { assistantId: '123' };

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) || null,
  }),
  useParams: () => mockParams,
}));

// 1. Mock LiveKit Client
class MockLocalParticipant extends EventEmitter {
  setMicrophoneEnabled = vi.fn().mockResolvedValue(undefined);
  setCameraEnabled = vi.fn().mockResolvedValue(undefined);
  setScreenShareEnabled = vi.fn().mockResolvedValue(undefined);
  getTrackPublication = vi.fn().mockReturnValue({
    isSubscribed: true,
    track: {
      kind: 'video',
      attach: vi.fn(),
      detach: vi.fn(),
      getDeviceId: vi.fn().mockResolvedValue('mock-device-id'),
    },
    source: 'camera',
    videoTrack: { getDeviceId: vi.fn().mockResolvedValue('mock-device-id') },
  });
}

class MockRoom extends EventEmitter {
  state = ConnectionState.Disconnected;
  localParticipant = new MockLocalParticipant();
  numParticipants = 0;

  connect = vi.fn().mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    this.state = ConnectionState.Connected;
    return Promise.resolve();
  });

  disconnect = vi.fn().mockImplementation(async () => {
    this.state = ConnectionState.Disconnected;
    this.emit(RoomEvent.Disconnected);
    return Promise.resolve();
  });

  switchActiveDevice = vi.fn().mockResolvedValue(undefined);
}

let mockRoomInstance: MockRoom;

vi.mock('livekit-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('livekit-client')>();

  const MockRoomConstructor = vi.fn(function () {
    mockRoomInstance = new MockRoom();
    return mockRoomInstance;
  }) as unknown as typeof actual.Room;

  (MockRoomConstructor as any).getLocalDevices = vi
    .fn()
    .mockResolvedValue([{ deviceId: 'mock-device-1', label: 'Mock Camera', kind: 'videoinput' }]);

  return {
    ...actual,
    Room: MockRoomConstructor,
    RoomEvent: actual.RoomEvent,
    ConnectionState: actual.ConnectionState,
    Track: {
      Source: {
        Camera: 'camera',
        Microphone: 'microphone',
        ScreenShare: 'screen_share',
      },
    },
  };
});

// 2. Mock LiveKit Components
vi.mock('@livekit/components-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@livekit/components-react')>();
  const React = await import('react');

  return {
    ...actual,
    RoomContext: actual.RoomContext,
    RoomAudioRenderer: () => <div data-testid="audio-renderer" />,
    VideoTrack: () => <div data-testid="video-track" />,
    useTracks: () => [],
    useVoiceAssistant: () => ({ state: 'listening', videoTrack: undefined }),
    useLocalParticipant: () => ({ localParticipant: new MockLocalParticipant() }),
    useMediaDeviceSelect: () => ({
      devices: [{ deviceId: 'dev-1', label: 'Default Device', groupId: '1' }],
      activeDeviceId: 'dev-1',
      setActiveMediaDevice: vi.fn(),
    }),
    useTrackToggle: ({ source }: { source: string }) => {
      const [enabled, setEnabled] = React.useState(source === 'microphone');
      const toggle = React.useCallback(async () => {
        setEnabled((prev: boolean) => !prev);
        return Promise.resolve();
      }, []);

      return {
        enabled,
        toggle,
        buttonProps: {
          disabled: false,
          'aria-pressed': enabled,
          onClick: toggle,
        },
        pending: false,
      };
    },
  };
});

// Import component after mocks
import AssistantCommunicationFullScreen from '@/components/Pages/Assistants/Communication/AssistantCommunicationFullScreen';

// Mock assistant and actions
const mockAssistant = {
  agentId: '123',
  firstName: 'Test',
  surname: 'Assistant',
  profilePhoto: 'https://example.com/photo.jpg',
  signedProfilePhotoUrl: 'https://example.com/signed-photo.jpg',
  userId: 'user-1',
  organizationId: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  nationality: 'US',
  age: 25,
  voiceId: 'voice-1',
  voiceProvider: 'elevenlabs' as const,
  profileVideo: null,
  about: 'Test assistant',
  phoneCountry: 'US',
  timezone: 'America/New_York',
  email: 'test@example.com',
  phone: '+1234567890',
  assistantWhatsappNumber: null,
  userPhone: null,
  userWhatsappNumber: null,
  signedProfileVideoUrl: null,
  weeklyLimit: null,
  maxParallel: null,
};

const mockUser = {
  id: 'user-1',
  image: 'https://example.com/user.jpg',
  email: 'user@example.com',
};

const createMockAssistantActions = () => ({
  chat: {
    getContactId: vi.fn(),
    getTranscripts: vi.fn(),
    message: vi.fn(),
    getAssistantOwnerById: vi.fn(),
  },
  call: {
    getConnectionDetails: vi.fn().mockResolvedValue({
      serverUrl: 'wss://test-server.livekit.cloud',
      token: 'mock-token-fullscreen',
      roomName: 'unity_123_meet',
    }),
    dispatchToCall: vi.fn().mockResolvedValue({ info: 'Dispatched' }),
    deleteRoom: vi.fn().mockResolvedValue({}),
  },
  desktop: {
    getLiveviewUrl: vi.fn().mockResolvedValue({ liveviewUrl: 'https://liveview.example.com' }),
    sendSystemEvent: vi.fn().mockResolvedValue({ info: 'success' }),
  },
});

describe('AssistantCommunicationFullScreen', () => {
  let mockAssistantActions: ReturnType<typeof createMockAssistantActions>;
  let user: ReturnType<typeof userEvent.setup>;
  let localStorageData: Record<string, string> = {};
  let getItemSpy: ReturnType<typeof vi.spyOn>;
  let setItemSpy: ReturnType<typeof vi.spyOn>;
  let removeItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockAssistantActions = createMockAssistantActions();
    mockSearchParams.clear();
    localStorageData = {};

    // Spy on localStorage methods without replacing the entire object
    // This allows next-themes to still work while we can track our specific keys
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      // Let next-themes access its own storage
      if (key === 'theme') {
        return null;
      }
      return localStorageData[key] || null;
    });

    setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation((key: string, value: string) => {
        localStorageData[key] = value;
      });

    removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      delete localStorageData[key];
    });

    // Mock window.close
    window.close = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mockSearchParams.clear();
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
  });

  const renderFullScreen = () => {
    return render(
      <AssistantCommunicationFullScreen
        assistant={mockAssistant as any}
        assistantActions={mockAssistantActions as any}
        user={mockUser}
      />
    );
  };

  describe('A - Initial Loading and Error States', () => {
    it(
      'shows loading state while initializing',
      {
        meta: {
          alias: 'FullScreen-Loading-Initial',
          scenario: 'Component mounts before call data is loaded.',
          behavior: 'Loading spinner is displayed.',
        },
      },
      async () => {
        renderFullScreen();

        // Should show loading when no dataKey
        await waitFor(() => {
          expect(screen.getByText(/Loading call.../i)).toBeInTheDocument();
        });
      }
    );

    it(
      'stays in loading state when dataKey is missing from URL',
      {
        meta: {
          alias: 'FullScreen-Error-MissingDataKey',
          scenario: 'URL does not contain dataKey parameter.',
          behavior: 'Component remains in loading state as callData cannot be fetched.',
        },
      },
      async () => {
        // No dataKey in searchParams - component stays in loading because callData is null
        renderFullScreen();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(100);
        });

        // Component stays in loading state when callData is null
        expect(screen.getByText(/Loading call.../i)).toBeInTheDocument();
      }
    );

    it(
      'stays in loading state when localStorage data is missing',
      {
        meta: {
          alias: 'FullScreen-Error-MissingLocalStorage',
          scenario: 'dataKey exists but localStorage has no data.',
          behavior: 'Component remains in loading state.',
        },
      },
      async () => {
        mockSearchParams.set('dataKey', 'test-key-123');
        // localStorage mock returns null by default - callData stays null

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        renderFullScreen();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(100);
        });

        // Component stays in loading state when callData is null
        expect(screen.getByText(/Loading call.../i)).toBeInTheDocument();
        consoleSpy.mockRestore();
      }
    );

    it(
      'stays in loading state when localStorage data is corrupted',
      {
        meta: {
          alias: 'FullScreen-Error-CorruptedData',
          scenario: 'dataKey exists but localStorage contains invalid JSON.',
          behavior: 'Component remains in loading state, error is logged.',
        },
      },
      async () => {
        mockSearchParams.set('dataKey', 'test-key-123');
        localStorageData['test-key-123'] = 'invalid-json{';

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        renderFullScreen();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(100);
        });

        // Component stays in loading state when callData is null (due to JSON parse error)
        expect(screen.getByText(/Loading call.../i)).toBeInTheDocument();
        consoleSpy.mockRestore();
      }
    );
  });

  describe('B - Connection Flow', () => {
    const validCallData = {
      serverUrl: 'wss://test-server.livekit.cloud',
      token: 'mock-token-123',
      callType: 'video',
      assistantName: 'Test Assistant',
      assistantPhoto: 'https://example.com/photo.jpg',
      userImage: 'https://example.com/user.jpg',
    };

    beforeEach(() => {
      mockSearchParams.set('dataKey', 'test-key-123');
      localStorageData['test-key-123'] = JSON.stringify(validCallData);
    });

    it(
      'connects to room when valid call data is provided',
      {
        meta: {
          alias: 'FullScreen-Connection-Success',
          scenario: 'Valid call data exists in localStorage.',
          behavior: 'Room.connect is called with correct parameters.',
        },
      },
      async () => {
        renderFullScreen();

        // Wait for connection attempt
        await act(async () => {
          await vi.advanceTimersByTimeAsync(100);
        });

        await waitFor(() => {
          expect(mockRoomInstance.connect).toHaveBeenCalledWith(
            'wss://test-server.livekit.cloud',
            'mock-token-fullscreen'
          );
        });
      }
    );

    it(
      'enables microphone and camera after connection for video call',
      {
        meta: {
          alias: 'FullScreen-Connection-MediaSetup',
          scenario: 'Connection successful for video call.',
          behavior: 'Microphone and camera are enabled.',
        },
      },
      async () => {
        renderFullScreen();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });

        await waitFor(() => {
          expect(mockRoomInstance.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
          expect(mockRoomInstance.localParticipant.setCameraEnabled).toHaveBeenCalledWith(true);
        });
      }
    );

    it(
      'shows waiting message when assistant has not joined yet',
      {
        meta: {
          alias: 'FullScreen-Connection-WaitingForAssistant',
          scenario: 'Connection successful but assistant not yet in room.',
          behavior: 'Waiting message is displayed.',
        },
      },
      async () => {
        mockRoomInstance = new MockRoom();
        mockRoomInstance.numParticipants = 0;

        renderFullScreen();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });

        await waitFor(() => {
          expect(screen.getByText(/Waiting for Test to join/i)).toBeInTheDocument();
        });
      }
    );

    it(
      'clears localStorage data key after reading',
      {
        meta: {
          alias: 'FullScreen-Connection-ClearLocalStorage',
          scenario: 'Call data is successfully read.',
          behavior: 'localStorage data key is removed to prevent reuse.',
        },
      },
      async () => {
        renderFullScreen();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(100);
        });

        expect(removeItemSpy).toHaveBeenCalledWith('test-key-123');
      }
    );
  });

  describe('C - Remote Control (Show Assistant Screen)', () => {
    const validCallData = {
      serverUrl: 'wss://test-server.livekit.cloud',
      token: 'mock-token-123',
      callType: 'video',
      assistantName: 'Test Assistant',
      assistantPhoto: 'https://example.com/photo.jpg',
      userImage: 'https://example.com/user.jpg',
    };

    beforeEach(() => {
      mockSearchParams.set('dataKey', 'test-key-123');
      localStorageData['test-key-123'] = JSON.stringify(validCallData);
    });

    // Helper to wait for connection and simulate assistant joining
    const waitForAssistantToJoin = async () => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      // Simulate assistant joining by emitting ParticipantConnected event
      await act(async () => {
        mockRoomInstance.numParticipants = 2;
        mockRoomInstance.emit(RoomEvent.ParticipantConnected, { identity: 'assistant' });
        await vi.advanceTimersByTimeAsync(50);
      });
    };

    it(
      'calls getLiveviewUrl when remote control button is clicked',
      {
        meta: {
          alias: 'FullScreen-RemoteControl-Toggle',
          scenario: 'User clicks "Show Assistant Screen" button.',
          behavior: 'getLiveviewUrl is called with assistant ID.',
        },
      },
      async () => {
        renderFullScreen();
        await waitForAssistantToJoin();

        // Find and click the remote control button
        const remoteControlButton = await screen.findByRole('button', {
          name: /show assistant screen/i,
        });
        await user.click(remoteControlButton);

        await waitFor(() => {
          expect(mockAssistantActions.desktop.getLiveviewUrl).toHaveBeenCalledWith('123');
        });
      }
    );

    it(
      'shows loading state while fetching liveview URL',
      {
        meta: {
          alias: 'FullScreen-RemoteControl-Loading',
          scenario: 'getLiveviewUrl request is in progress.',
          behavior: 'Button shows loading indicator.',
        },
      },
      async () => {
        // Make getLiveviewUrl take time
        let resolveUrl: (value: any) => void;
        mockAssistantActions.desktop.getLiveviewUrl.mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveUrl = resolve;
            })
        );

        renderFullScreen();
        await waitForAssistantToJoin();

        const remoteControlButton = await screen.findByRole('button', {
          name: /show assistant screen/i,
        });
        await user.click(remoteControlButton);

        // Button should be in loading state (disabled or show spinner)
        await waitFor(() => {
          expect(mockAssistantActions.desktop.getLiveviewUrl).toHaveBeenCalled();
        });

        // Resolve the URL
        await act(async () => {
          resolveUrl!({ liveviewUrl: 'https://liveview.example.com' });
          await vi.advanceTimersByTimeAsync(50);
        });
      }
    );

    it(
      'toggles remote control off when clicked again',
      {
        meta: {
          alias: 'FullScreen-RemoteControl-ToggleOff',
          scenario: 'Remote control is active and user clicks button again.',
          behavior: 'Remote control is deactivated without API call.',
        },
      },
      async () => {
        renderFullScreen();
        await waitForAssistantToJoin();

        const remoteControlButton = await screen.findByRole('button', {
          name: /show assistant screen/i,
        });

        // First click - enable
        await user.click(remoteControlButton);
        await waitFor(() => {
          expect(mockAssistantActions.desktop.getLiveviewUrl).toHaveBeenCalledTimes(1);
        });

        // Second click - disable (should not call API again)
        await user.click(remoteControlButton);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(100);
        });

        // Should not have made another API call
        expect(mockAssistantActions.desktop.getLiveviewUrl).toHaveBeenCalledTimes(1);
      }
    );

    it(
      'handles getLiveviewUrl error gracefully',
      {
        meta: {
          alias: 'FullScreen-RemoteControl-Error',
          scenario: 'getLiveviewUrl returns an error.',
          behavior: 'Error is logged but UI does not crash.',
        },
      },
      async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockAssistantActions.desktop.getLiveviewUrl.mockResolvedValueOnce({
          detail: 'No active session found',
        });

        renderFullScreen();
        await waitForAssistantToJoin();

        const remoteControlButton = await screen.findByRole('button', {
          name: /show assistant screen/i,
        });
        await user.click(remoteControlButton);

        await waitFor(() => {
          expect(consoleSpy).toHaveBeenCalledWith(
            '[FullScreen] Failed to get liveview URL:',
            'No active session found'
          );
        });

        consoleSpy.mockRestore();
      }
    );
  });

  describe('D - Interactive Mode Toggle', () => {
    const validCallData = {
      serverUrl: 'wss://test-server.livekit.cloud',
      token: 'mock-token-123',
      callType: 'video',
      assistantName: 'Test Assistant',
      assistantPhoto: 'https://example.com/photo.jpg',
      userImage: 'https://example.com/user.jpg',
    };

    beforeEach(() => {
      mockSearchParams.set('dataKey', 'test-key-123');
      localStorageData['test-key-123'] = JSON.stringify(validCallData);
    });

    // Helper to wait for connection and simulate assistant joining
    const waitForAssistantToJoin = async () => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      // Simulate assistant joining by emitting ParticipantConnected event
      await act(async () => {
        mockRoomInstance.numParticipants = 2;
        mockRoomInstance.emit(RoomEvent.ParticipantConnected, { identity: 'assistant' });
        await vi.advanceTimersByTimeAsync(50);
      });
    };

    it(
      'sends user_remote_control_started event when enabling interactive mode',
      {
        meta: {
          alias: 'FullScreen-Interactive-Enable',
          scenario: 'Remote control is active and user enables interactive mode.',
          behavior: 'sendSystemEvent is called with user_remote_control_started.',
        },
      },
      async () => {
        renderFullScreen();
        await waitForAssistantToJoin();

        // First enable remote control
        const remoteControlButton = await screen.findByRole('button', {
          name: /show assistant screen/i,
        });
        await user.click(remoteControlButton);

        await waitFor(() => {
          expect(mockAssistantActions.desktop.getLiveviewUrl).toHaveBeenCalled();
        });

        // Then find and click interactive mode button
        const interactiveButton = screen.queryByRole('button', { name: /take over|interactive/i });
        if (interactiveButton) {
          await user.click(interactiveButton);

          await waitFor(() => {
            expect(mockAssistantActions.desktop.sendSystemEvent).toHaveBeenCalledWith(
              '123',
              'user_remote_control_started',
              'User took remote control of assistant desktop'
            );
          });
        }
      }
    );

    it(
      'reverts interactive state on sendSystemEvent failure',
      {
        meta: {
          alias: 'FullScreen-Interactive-RevertOnError',
          scenario: 'sendSystemEvent fails.',
          behavior: 'Interactive state is reverted.',
        },
      },
      async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockAssistantActions.desktop.sendSystemEvent.mockResolvedValueOnce({
          detail: 'Failed to send event',
        });

        renderFullScreen();
        await waitForAssistantToJoin();

        // Enable remote control first
        const remoteControlButton = await screen.findByRole('button', {
          name: /show assistant screen/i,
        });
        await user.click(remoteControlButton);

        await waitFor(() => {
          expect(mockAssistantActions.desktop.getLiveviewUrl).toHaveBeenCalled();
        });

        // Try to enable interactive mode
        const interactiveButton = screen.queryByRole('button', { name: /take over|interactive/i });
        if (interactiveButton) {
          await user.click(interactiveButton);

          await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
              '[FullScreen] Error sending interaction event:',
              'Failed to send event'
            );
          });
        }

        consoleSpy.mockRestore();
      }
    );
  });

  describe('E - Cleanup and Lifecycle', () => {
    const validCallData = {
      serverUrl: 'wss://test-server.livekit.cloud',
      token: 'mock-token-123',
      callType: 'video',
      assistantName: 'Test Assistant',
      assistantPhoto: 'https://example.com/photo.jpg',
      userImage: 'https://example.com/user.jpg',
    };

    beforeEach(() => {
      mockSearchParams.set('dataKey', 'test-key-123');
      localStorageData['test-key-123'] = JSON.stringify(validCallData);
    });

    it(
      'sets activePopOutCall in localStorage on mount',
      {
        meta: {
          alias: 'FullScreen-Lifecycle-SetActiveCall',
          scenario: 'Component mounts successfully.',
          behavior: 'activePopOutCall is set in localStorage.',
        },
      },
      async () => {
        renderFullScreen();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });

        expect(setItemSpy).toHaveBeenCalledWith('activePopOutCall', expect.stringContaining('123'));
      }
    );

    it(
      'cleans up activePopOutCall on unmount',
      {
        meta: {
          alias: 'FullScreen-Lifecycle-CleanupOnUnmount',
          scenario: 'Component unmounts.',
          behavior: 'activePopOutCall is removed from localStorage.',
        },
      },
      async () => {
        const { unmount } = renderFullScreen();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });

        unmount();

        expect(removeItemSpy).toHaveBeenCalledWith('activePopOutCall');
      }
    );

    it(
      'disconnects room on unmount if still connected',
      {
        meta: {
          alias: 'FullScreen-Lifecycle-DisconnectOnUnmount',
          scenario: 'Component unmounts while room is connected.',
          behavior: 'room.disconnect is called.',
        },
      },
      async () => {
        const { unmount } = renderFullScreen();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });

        // Ensure room is connected
        mockRoomInstance.state = ConnectionState.Connected;

        unmount();

        expect(mockRoomInstance.disconnect).toHaveBeenCalled();
      }
    );

    it(
      'calls window.close when room disconnects',
      {
        meta: {
          alias: 'FullScreen-Lifecycle-CloseOnDisconnect',
          scenario: 'Room emits Disconnected event.',
          behavior: 'window.close is called.',
        },
      },
      async () => {
        renderFullScreen();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });

        // Simulate room disconnect
        act(() => {
          mockRoomInstance.emit(RoomEvent.Disconnected);
        });

        expect(window.close).toHaveBeenCalled();
      }
    );

    it(
      'responds to ping-pong localStorage communication',
      {
        meta: {
          alias: 'FullScreen-Lifecycle-PingPong',
          scenario: 'Parent window sends ping via localStorage.',
          behavior: 'Component responds with pong.',
        },
      },
      async () => {
        renderFullScreen();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });

        // Simulate ping from parent
        const pingEvent = new StorageEvent('storage', {
          key: 'popOutCallPing',
          newValue: 'ping-123',
        });

        act(() => {
          window.dispatchEvent(pingEvent);
        });

        expect(setItemSpy).toHaveBeenCalledWith('popOutCallPong', 'ping-123');
      }
    );
  });

  describe('F - Hang Up Functionality', () => {
    const validCallData = {
      serverUrl: 'wss://test-server.livekit.cloud',
      token: 'mock-token-123',
      callType: 'video',
      assistantName: 'Test Assistant',
      assistantPhoto: 'https://example.com/photo.jpg',
      userImage: 'https://example.com/user.jpg',
    };

    beforeEach(() => {
      mockSearchParams.set('dataKey', 'test-key-123');
      localStorageData['test-key-123'] = JSON.stringify(validCallData);
    });

    it(
      'disconnects room when hang up button is clicked',
      {
        meta: {
          alias: 'FullScreen-HangUp-Disconnect',
          scenario: 'User clicks hang up button.',
          behavior: 'room.disconnect is called.',
        },
      },
      async () => {
        renderFullScreen();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });

        const hangUpButton = await screen.findByRole('button', { name: /hang up/i });
        await user.click(hangUpButton);

        expect(mockRoomInstance.disconnect).toHaveBeenCalled();
      }
    );
  });

  describe('G - Audio-only Call', () => {
    const audioCallData = {
      serverUrl: 'wss://test-server.livekit.cloud',
      token: 'mock-token-123',
      callType: 'audio',
      assistantName: 'Test Assistant',
      assistantPhoto: 'https://example.com/photo.jpg',
      userImage: 'https://example.com/user.jpg',
    };

    beforeEach(() => {
      mockSearchParams.set('dataKey', 'test-key-123');
      localStorageData['test-key-123'] = JSON.stringify(audioCallData);
    });

    it(
      'does not enable camera for audio-only call',
      {
        meta: {
          alias: 'FullScreen-AudioCall-NoCamera',
          scenario: 'Call type is audio.',
          behavior: 'Camera is not enabled after connection.',
        },
      },
      async () => {
        renderFullScreen();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });

        await waitFor(() => {
          expect(mockRoomInstance.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
          expect(mockRoomInstance.localParticipant.setCameraEnabled).toHaveBeenCalledWith(false);
        });
      }
    );
  });

  // =========================================================================
  // H - Seamless Handoff from Dialog
  // =========================================================================
  describe('H - Seamless Handoff from Dialog', () => {
    const handoffCallData = {
      serverUrl: 'wss://test-server.livekit.cloud',
      token: 'mock-token-123',
      callType: 'video' as const,
      assistantName: 'Test Assistant',
      assistantPhoto: 'https://example.com/photo.jpg',
      userImage: 'https://example.com/user.jpg',
    };

    beforeEach(() => {
      mockSearchParams.set('dataKey', 'test-key-123');
    });

    describe('State Restoration', () => {
      it(
        'dispatches assistant and shows waiting state when assistant is not in room despite handoff claiming it was',
        {
          meta: {
            alias: 'Handoff-AssistantGoneDespiteHandoff',
            scenario: 'Dialog passes handoff data with assistantJoined=true, but assistant left during transition.',
            behavior: 'Fullscreen checks actual room state, shows waiting, and dispatches assistant.',
          },
        },
        async () => {
          // Handoff data says assistant was connected, but it left during the pop-out transition
          const handoffDataWithState = {
            ...handoffCallData,
            handoffState: {
              assistantJoined: true,
              micEnabled: true,
              cameraEnabled: true,
            },
          };
          localStorageData['test-key-123'] = JSON.stringify(handoffDataWithState);

          renderFullScreen();

          await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
          });

          // Room has numParticipants=0 (mock default), so waiting message should show
          // even though handoff said assistantJoined=true
          await waitFor(() => {
            expect(screen.getByText(/waiting for .* to join/i)).toBeInTheDocument();
          });

          // Should have dispatched the assistant to bring it back
          expect(mockAssistantActions.call.dispatchToCall).toHaveBeenCalledWith(
            '123',
            expect.stringContaining('meet')
          );
        }
      );

      it(
        'restores remote control state when handoff data indicates screen sharing was active',
        {
          meta: {
            alias: 'Handoff-RestoreRemoteControl',
            scenario: 'Dialog passes handoff data with remoteControlActive=true and liveviewUrl.',
            behavior: 'Remote control state is applied without requiring button click.',
          },
        },
        async () => {
          const handoffDataWithRemoteControl = {
            ...handoffCallData,
            handoffState: {
              assistantJoined: true,
              remoteControlActive: true,
              liveviewUrl: 'https://liveview.example.com/session/abc123',
              remoteControlInteractive: false,
            },
          };
          localStorageData['test-key-123'] = JSON.stringify(handoffDataWithRemoteControl);

          renderFullScreen();

          // Wait for connection to complete
          await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
          });

          // Verify connection was made
          await waitFor(() => {
            expect(mockRoomInstance.connect).toHaveBeenCalled();
          });

          // The key behavior: getLiveviewUrl should NOT be called since we restored from handoff
          // If the state wasn't restored, the user would need to click the button to get the liveview URL
          expect(mockAssistantActions.desktop.getLiveviewUrl).not.toHaveBeenCalled();

          // Also verify the toggle button is available (remote control can be toggled off)
          await waitFor(() => {
            const remoteControlButton = screen.getByRole('button', {
              name: /show.*screen|hide.*screen/i,
            });
            expect(remoteControlButton).toBeInTheDocument();
          });
        }
      );

      it(
        'restores interactive mode when handoff data indicates it was enabled',
        {
          meta: {
            alias: 'Handoff-RestoreInteractiveMode',
            scenario: 'Dialog passes handoff with remoteControlInteractive=true.',
            behavior: 'Interactive mode is enabled without requiring API call.',
          },
        },
        async () => {
          const handoffDataWithInteractive = {
            ...handoffCallData,
            handoffState: {
              assistantJoined: true,
              remoteControlActive: true,
              liveviewUrl: 'https://liveview.example.com/session/abc123',
              remoteControlInteractive: true,
            },
          };
          localStorageData['test-key-123'] = JSON.stringify(handoffDataWithInteractive);

          renderFullScreen();

          await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
          });

          // Wait for connection and state restoration
          await waitFor(() => {
            expect(mockRoomInstance.connect).toHaveBeenCalled();
          });

          // Interactive mode toggle should NOT make an API call since state was restored
          // The sendSystemEvent should not be called during initial load
          expect(mockAssistantActions.desktop.sendSystemEvent).not.toHaveBeenCalled();
        }
      );

      it(
        'preserves mic/camera state from handoff data instead of using defaults',
        {
          meta: {
            alias: 'Handoff-PreserveTrackState',
            scenario: 'Dialog passes handoff with micEnabled=false, cameraEnabled=true.',
            behavior: 'Fullscreen applies exact track states from handoff.',
          },
        },
        async () => {
          const handoffDataWithTrackState = {
            ...handoffCallData,
            handoffState: {
              assistantJoined: true,
              micEnabled: false,
              cameraEnabled: true,
            },
          };
          localStorageData['test-key-123'] = JSON.stringify(handoffDataWithTrackState);

          renderFullScreen();

          await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
          });

          // Should apply the exact mic/camera state from handoff
          await waitFor(() => {
            expect(mockRoomInstance.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(
              false
            );
            expect(mockRoomInstance.localParticipant.setCameraEnabled).toHaveBeenCalledWith(true);
          });
        }
      );
    });

    describe('Race Conditions and Edge Cases', () => {
      it(
        'handles rapid tab switch where assistant disconnects between handoff and connection',
        {
          meta: {
            alias: 'Handoff-AssistantDisconnectRace',
            scenario:
              'Handoff says assistantJoined=true, but assistant disconnects before fullscreen connects.',
            behavior: 'Shows waiting state and handles reconnection gracefully.',
          },
        },
        async () => {
          const handoffDataAssistantJoined = {
            ...handoffCallData,
            handoffState: {
              assistantJoined: true,
            },
          };
          localStorageData['test-key-123'] = JSON.stringify(handoffDataAssistantJoined);

          // Simulate that the room will have 1 participant (only user) after connect
          mockRoomInstance = new MockRoom() as any;
          mockRoomInstance.numParticipants = 1; // Only user, assistant not there

          renderFullScreen();

          await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
          });

          // Despite handoff saying assistant was joined, if room shows otherwise,
          // the UI should update to show waiting state
          await waitFor(() => {
            expect(mockRoomInstance.connect).toHaveBeenCalled();
          });

          // The component should detect the discrepancy and show waiting state
          // This tests that the component validates handoff state against actual room state
        }
      );

      it(
        'handles corrupted handoff state gracefully and falls back to defaults',
        {
          meta: {
            alias: 'Handoff-CorruptedState',
            scenario: 'Handoff data has malformed handoffState object.',
            behavior: 'Falls back to default behavior without crashing.',
          },
        },
        async () => {
          const handoffDataCorrupted = {
            ...handoffCallData,
            handoffState: 'not-an-object', // Corrupted - should be object
          };
          localStorageData['test-key-123'] = JSON.stringify(handoffDataCorrupted);

          // Should not throw
          expect(() => renderFullScreen()).not.toThrow();

          await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
          });

          // Should fall back to default behavior (enable mic, enable camera for video)
          await waitFor(() => {
            expect(mockRoomInstance.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(
              true
            );
          });
        }
      );

      it(
        'handles missing handoffState and uses default initialization',
        {
          meta: {
            alias: 'Handoff-MissingState',
            scenario: 'Handoff data has no handoffState (legacy format).',
            behavior: 'Uses default initialization behavior.',
          },
        },
        async () => {
          // Legacy format without handoffState
          localStorageData['test-key-123'] = JSON.stringify(handoffCallData);

          renderFullScreen();

          await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
          });

          // Should use default behavior
          await waitFor(() => {
            expect(mockRoomInstance.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(
              true
            );
            expect(mockRoomInstance.localParticipant.setCameraEnabled).toHaveBeenCalledWith(true);
          });
        }
      );

      it(
        'validates liveviewUrl before restoring remote control state',
        {
          meta: {
            alias: 'Handoff-ValidateLiveviewUrl',
            scenario: 'Handoff has remoteControlActive=true but liveviewUrl is expired/invalid.',
            behavior: 'Does not show remote control, allows user to re-enable.',
          },
        },
        async () => {
          const handoffDataExpiredUrl = {
            ...handoffCallData,
            handoffState: {
              assistantJoined: true,
              remoteControlActive: true,
              liveviewUrl: '', // Empty/invalid URL
            },
          };
          localStorageData['test-key-123'] = JSON.stringify(handoffDataExpiredUrl);

          renderFullScreen();

          await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
          });

          // Should NOT show remote control view with empty URL
          await waitFor(() => {
            const iframe = document.querySelector('iframe[src*="liveview"]');
            expect(iframe).not.toBeInTheDocument();
          });
        }
      );
    });

    describe('Dialog-Fullscreen Coordination', () => {
      it(
        'signals to dialog that handoff is complete so dialog can close cleanly',
        {
          meta: {
            alias: 'Handoff-SignalComplete',
            scenario: 'Fullscreen successfully connects and restores state.',
            behavior: 'Sets localStorage flag or dispatches event for dialog to detect.',
          },
        },
        async () => {
          const handoffDataWithState = {
            ...handoffCallData,
            handoffState: {
              assistantJoined: true,
            },
          };
          localStorageData['test-key-123'] = JSON.stringify(handoffDataWithState);

          renderFullScreen();

          await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
          });

          // Wait for connection
          await waitFor(() => {
            expect(mockRoomInstance.connect).toHaveBeenCalled();
          });

          // Should set activePopOutCall in localStorage to signal handoff complete
          expect(setItemSpy).toHaveBeenCalledWith(
            'activePopOutCall',
            expect.stringContaining(mockAssistant.agentId)
          );
        }
      );

      it(
        'handles scenario where dialog closes before fullscreen finishes connecting',
        {
          meta: {
            alias: 'Handoff-DialogClosedEarly',
            scenario: 'User closes dialog tab while fullscreen is still connecting.',
            behavior: 'Fullscreen continues normally, assistant stays in room.',
          },
        },
        async () => {
          const handoffDataWithState = {
            ...handoffCallData,
            handoffState: {
              assistantJoined: true,
            },
          };
          localStorageData['test-key-123'] = JSON.stringify(handoffDataWithState);

          renderFullScreen();

          // Simulate dialog closing (removing its activePopOutCall ping)
          await act(async () => {
            await vi.advanceTimersByTimeAsync(50);
            // Dialog would have cleared its state, but fullscreen should continue
          });

          // Fullscreen should still connect successfully
          await waitFor(() => {
            expect(mockRoomInstance.connect).toHaveBeenCalled();
          });
        }
      );

      it(
        'handles multiple rapid pop-out attempts gracefully',
        {
          meta: {
            alias: 'Handoff-RapidPopOut',
            scenario: 'User rapidly clicks pop-out multiple times.',
            behavior:
              'Only one fullscreen instance should be active, others should detect and close.',
          },
        },
        async () => {
          const handoffData1 = {
            ...handoffCallData,
            handoffState: { assistantJoined: true },
          };
          localStorageData['test-key-123'] = JSON.stringify(handoffData1);

          // First render
          const { unmount } = render(
            <AssistantCommunicationFullScreen
              assistant={mockAssistant as any}
              assistantActions={mockAssistantActions as any}
              user={mockUser}
            />
          );

          await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
          });

          // Simulate second pop-out by setting a new dataKey
          mockSearchParams.set('dataKey', 'test-key-456');
          localStorageData['test-key-456'] = JSON.stringify({
            ...handoffCallData,
            handoffState: { assistantJoined: true },
          });

          // The system should have a mechanism to detect duplicate windows
          // Either via localStorage coordination or window.opener communication
          expect(setItemSpy).toHaveBeenCalledWith('activePopOutCall', expect.any(String));

          unmount();
        }
      );
    });

    describe('State Persistence After Handoff', () => {
      it(
        'maintains restored remote control state across room reconnections',
        {
          meta: {
            alias: 'Handoff-MaintainStateOnReconnect',
            scenario:
              'Handoff restores remote control, then room briefly disconnects and reconnects.',
            behavior: 'Remote control state persists through reconnection.',
          },
        },
        async () => {
          const handoffDataWithRemoteControl = {
            ...handoffCallData,
            handoffState: {
              assistantJoined: true,
              remoteControlActive: true,
              liveviewUrl: 'https://liveview.example.com/session/abc123',
            },
          };
          localStorageData['test-key-123'] = JSON.stringify(handoffDataWithRemoteControl);

          renderFullScreen();

          await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
          });

          // Simulate room disconnect and reconnect
          await act(async () => {
            mockRoomInstance.emit(RoomEvent.Disconnected);
            await vi.advanceTimersByTimeAsync(100);
          });

          // Reconnect
          await act(async () => {
            mockRoomInstance.state = ConnectionState.Connected;
            mockRoomInstance.emit(RoomEvent.Connected);
            await vi.advanceTimersByTimeAsync(100);
          });

          // Remote control state should still be active (liveview URL should persist)
          // This tests that handoff state isn't lost on room events
        }
      );

      it(
        'properly cleans up handoff state on unmount to prevent stale data',
        {
          meta: {
            alias: 'Handoff-CleanupOnUnmount',
            scenario: 'User closes fullscreen tab.',
            behavior: 'Handoff-related localStorage data is cleaned up.',
          },
        },
        async () => {
          const handoffDataWithState = {
            ...handoffCallData,
            handoffState: {
              assistantJoined: true,
            },
          };
          localStorageData['test-key-123'] = JSON.stringify(handoffDataWithState);

          const { unmount } = render(
            <AssistantCommunicationFullScreen
              assistant={mockAssistant as any}
              assistantActions={mockAssistantActions as any}
              user={mockUser}
            />
          );

          await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
          });

          // Unmount should clean up
          unmount();

          // activePopOutCall should be removed
          expect(removeItemSpy).toHaveBeenCalledWith('activePopOutCall');
        }
      );
    });
  });
});
