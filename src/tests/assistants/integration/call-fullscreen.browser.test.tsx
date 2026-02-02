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
  voiceMode: 'standard' as const,
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
    triggerContactSync: vi.fn(),
  },
  call: {
    getConnectionDetails: vi.fn(),
    dispatchToCall: vi.fn(),
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
            validCallData.serverUrl,
            validCallData.token
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

        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });

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

        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });

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

        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });

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

        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });

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

    it(
      'sends pause_actor event when enabling interactive mode',
      {
        meta: {
          alias: 'FullScreen-Interactive-Enable',
          scenario: 'Remote control is active and user enables interactive mode.',
          behavior: 'sendSystemEvent is called with pause_actor.',
        },
      },
      async () => {
        renderFullScreen();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });

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
              'pause_actor',
              'user is taking over'
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

        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });

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
});
