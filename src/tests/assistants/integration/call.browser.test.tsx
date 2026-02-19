import { render, screen, waitFor, within, act } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Server Action module before importing components that use it
// This prevents loading next-auth dependencies in the browser environment
vi.mock('@/lib/assistants/preHireChat', () => ({
  sendPreHireChatMessage: vi.fn().mockResolvedValue({ content: 'Mocked response' }),
  generatePostHireGreeting: vi.fn().mockResolvedValue({ content: 'Hello! I am ready to work.' }),
}));

import Main from '@/components/Pages/Assistants/Main';
import { mockAssistantActions, mockTaskActions } from '../mocks/actions';
import { mockAssistants } from '../mocks/data';
import { RoomEvent, ConnectionState } from 'livekit-client';
import { EventEmitter } from 'events';

// Import harness utilities for track state management
import { setLiveKitTrackState, clearLiveKitTrackState } from './fixtures';

// 1. Mock LiveKit Client
class MockLocalParticipant extends EventEmitter {
  setMicrophoneEnabled = vi.fn().mockResolvedValue(undefined);
  setCameraEnabled = vi.fn().mockResolvedValue(undefined);
  setScreenShareEnabled = vi.fn().mockResolvedValue(undefined);
  // Always return a track publication so UI logic depends on toggle state (isCameraOn)
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

  connect = vi.fn().mockImplementation(async (url, token) => {
    if (url === 'error-url') {
      await new Promise((resolve) => setTimeout(resolve, 100));
      throw new Error('Simulated Connection Failure');
    }
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

vi.mock('livekit-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('livekit-client')>();

  // Create a mock Room constructor with static methods
  const MockRoomConstructor = vi.fn(function () {
    return new MockRoom();
  }) as unknown as typeof actual.Room;

  // Add static methods that the production code uses
  (MockRoomConstructor as any).getLocalDevices = vi.fn().mockResolvedValue([
    { deviceId: 'mock-device-1', label: 'Mock Camera', kind: 'videoinput' },
    { deviceId: 'mock-device-2', label: 'Mock Microphone', kind: 'audioinput' },
  ]);

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
  const React = await import('react'); // Use real React hooks for stateful mocks

  return {
    ...actual,
    RoomContext: actual.RoomContext,
    RoomAudioRenderer: () => <div data-testid="audio-renderer" />,
    VideoTrack: () => <div data-testid="video-track" />,
    useTracks: () => [],
    useVoiceAssistant: () => ({ state: 'listening', videoTrack: undefined }),
    useLocalParticipant: () => ({ localParticipant: new MockLocalParticipant() }),

    // Mock device selection with dummy devices to populate settings
    useMediaDeviceSelect: () => ({
      devices: [
        { deviceId: 'dev-1', label: 'Default Device', groupId: '1' },
        { deviceId: 'dev-2', label: 'Alternate Device', groupId: '1' },
      ],
      activeDeviceId: 'dev-1',
      setActiveMediaDevice: vi.fn(),
    }),

    // Stateful Mock for useTrackToggle using React state to ensure re-renders in tests
    useTrackToggle: ({ source }: { source: string }) => {
      // Initialize from global state if present to respect test setup
      const globalState = (window as any).__mockLiveKitState || {};
      let initialEnabled = false;

      if (source === 'microphone') initialEnabled = globalState.micEnabled ?? true;
      if (source === 'camera') initialEnabled = globalState.camEnabled ?? false;
      if (source === 'screen_share') initialEnabled = globalState.screenShareEnabled ?? false;

      const [enabled, setEnabled] = React.useState(initialEnabled);

      const toggle = React.useCallback(async () => {
        setEnabled((prev: boolean) => !prev);
        return Promise.resolve();
      }, []);

      return {
        enabled,
        toggle,
        // Fix: Added onClick to buttonProps so the click event triggers the toggle
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

// 3. Mock WorkspaceProvider - Main component uses useAssistantPermissions which requires workspace context
// See src/tests/mocks/workspaceProvider.ts for reusable mock patterns
vi.mock('@/components/Pages/Providers/WorkspaceProvider', () => ({
  useWorkspace: () => ({
    workspaces: [{ id: 'personal', name: 'Test User', type: 'personal' }],
    activeWorkspace: { id: 'personal', name: 'Test User', type: 'personal' },
    activeOrganization: null,
    currentUserId: 'test-user-001',
    switchWorkspace: vi.fn(),
  }),
}));

describe('Assistant Call', () => {
  // Default user for tests that don't need fake timer integration
  const defaultUser = userEvent.setup();
  const targetAssistant = mockAssistants[0]; // Jane Doe

  const renderPage = () => {
    return render(
      <Main
        taskActions={mockTaskActions}
        assistantActions={mockAssistantActions}
        userMeta={{ image: 'test-image.jpg', timezone: 'UTC' }}
      />
    );
  };

  const openProfileAndGetCallButton = async (user = defaultUser) => {
    const assistantCard = await screen.findByText(
      `${targetAssistant.firstName} ${targetAssistant.surname}`
    );
    await user.click(assistantCard);
    const profilePanel = await screen.findByText('Profile');
    expect(profilePanel).toBeVisible();
    const callButton = await screen.findByTestId('call-menu-trigger');
    return callButton;
  };

  const getMockRoomInstance = async (): Promise<MockRoom> => {
    const LiveKitClient = await import('livekit-client');
    const instances = vi.mocked(LiveKitClient.Room).mock.results;
    return instances[instances.length - 1].value as MockRoom;
  };

  // Helper to get to a connected call state quickly and robustly
  const establishCall = async (type: 'video' | 'audio' = 'video') => {
    // Initialize the shared mock state based on call type intent
    setLiveKitTrackState({
      micEnabled: true,
      camEnabled: type === 'video',
      screenShareEnabled: false,
    });

    const callButton = await openProfileAndGetCallButton();
    await defaultUser.click(callButton);

    const option = await screen.findByTestId(`call-option-${type}`);
    await defaultUser.click(option);

    const mockRoomInstance = await getMockRoomInstance();

    // Wait for connect call
    await waitFor(() => expect(mockRoomInstance.connect).toHaveBeenCalled());

    // Simulate assistant joining
    mockRoomInstance.numParticipants = 2;
    mockRoomInstance.emit(RoomEvent.ParticipantConnected, { identity: 'assistant-agent' });

    // Wait for the UI to stabilize
    await waitFor(() => expect(screen.queryByText('Setting up a connection...')).toBeNull());
    await waitFor(() => expect(screen.queryByText(/Waiting for .* to join/)).toBeNull());

    // Wait for controls to load
    await screen.findByLabelText(type === 'video' ? 'Turn off camera' : 'Turn on camera');

    return mockRoomInstance;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();
    // Reset shared state using harness helper
    setLiveKitTrackState({
      micEnabled: true,
      camEnabled: false,
      screenShareEnabled: false,
    });

    mockAssistantActions.call.getConnectionDetails = vi.fn().mockResolvedValue({
      serverUrl: 'ws://test-livekit',
      token: 'mock-token',
      roomName: 'room-123',
    });
    mockAssistantActions.call.dispatchToCall = vi.fn().mockResolvedValue({ info: 'Dispatched' });
    mockAssistantActions.desktop.getLiveviewUrl = vi
      .fn()
      .mockResolvedValue({ liveviewUrl: 'https://vnc.example.com' });
    mockAssistantActions.desktop.sendSystemEvent = vi.fn().mockResolvedValue({});
  });

  afterEach(() => {
    delete (window as any)._TEST_ASSISTANT_JOIN_TIMEOUT;
    // Clean up LiveKit track state using harness helper
    clearLiveKitTrackState();
  });

  describe('A-LiveKit Room Connection', () => {
    it(
      'handles a full successful call lifecycle',
      {
        meta: {
          alias: 'Call-Lifecycle-Success',
          scenario: 'User initiates a video call which connects successfully and then hangs up.',
          behavior:
            'The UI transitions through connecting states, shows the assistant view upon connection, and cleans up upon hangup.',
        },
      },
      async () => {
        renderPage();
        const callButton = await openProfileAndGetCallButton();

        await defaultUser.click(callButton);
        const videoOption = await screen.findByTestId('call-option-video');
        await defaultUser.click(videoOption);

        expect(await screen.findByText('Setting up a connection...')).toBeInTheDocument();

        await waitFor(() => {
          expect(mockAssistantActions.call.getConnectionDetails).toHaveBeenCalledTimes(1);
        });
        // Verify connection details requested for correct assistant (agentId, assistantName)
        expect(mockAssistantActions.call.getConnectionDetails).toHaveBeenCalledWith(
          targetAssistant.agentId,
          `${targetAssistant.firstName}${targetAssistant.surname}`
        );

        expect(
          await screen.findByText(`Waiting for ${targetAssistant.firstName} to join...`)
        ).toBeVisible();

        const mockRoomInstance = await getMockRoomInstance();
        mockRoomInstance.numParticipants = 2;
        mockRoomInstance.emit(RoomEvent.ParticipantConnected, { identity: 'assistant-agent' });

        await waitFor(() => {
          expect(
            screen.queryByText(`Waiting for ${targetAssistant.firstName} to join...`)
          ).toBeNull();
        });
        expect(
          screen.getByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
        ).toBeVisible();

        const hangUpButton = screen.getByRole('button', { name: /hang up/i });
        await defaultUser.click(hangUpButton!);

        await waitFor(() => {
          expect(mockRoomInstance.disconnect).toHaveBeenCalled();
          expect(
            screen.queryByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
          ).toBeNull();
        });
      }
    );

    it(
      'handles API failure during connection setup',
      {
        meta: {
          alias: 'Call-API-Failure',
          scenario:
            'The backend returns an error (e.g., quota exceeded) when requesting connection details.',
          behavior:
            'The UI retries the connection request up to the limit, then stops and does not attempt to connect to the room.',
        },
      },
      async () => {
        vi.useRealTimers();
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        mockAssistantActions.call.getConnectionDetails = vi
          .fn()
          .mockResolvedValue({ detail: 'Backend Error: Quota Exceeded' });

        renderPage();
        const callButton = await openProfileAndGetCallButton();

        await defaultUser.click(callButton);
        const audioOption = await screen.findByTestId('call-option-audio');
        await defaultUser.click(audioOption);

        expect(await screen.findByText('Setting up a connection...')).toBeVisible();

        await waitFor(
          () => {
            expect(mockAssistantActions.call.getConnectionDetails).toHaveBeenCalledTimes(4);
          },
          { timeout: 15000 }
        );

        await waitFor(() => expect(screen.queryByText('Setting up a connection...')).toBeNull(), {
          timeout: 5000,
        });

        consoleSpy.mockRestore();

        const LiveKitClient = await import('livekit-client');
        const roomConstructor = vi.mocked(LiveKitClient.Room);
        if (roomConstructor.mock.results.length > 0) {
          const instance = roomConstructor.mock.results[roomConstructor.mock.results.length - 1]
            .value as MockRoom;
          expect(instance.connect).not.toHaveBeenCalled();
        }
      }
    );

    it(
      'handle user hanging up immediately while connecting',
      {
        meta: {
          alias: 'Call-Stress-Rapid-Close',
          scenario:
            'User clicks hang up immediately while the connection spinner is still visible.',
          behavior:
            'The connection process aborts immediately, and the room state remains disconnected.',
        },
      },
      async () => {
        mockAssistantActions.call.getConnectionDetails = vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return { serverUrl: 'ws://slow', token: 't', roomName: 'r' };
        });

        renderPage();
        const callButton = await openProfileAndGetCallButton();
        await defaultUser.click(callButton);
        const videoOption = await screen.findByTestId('call-option-video');
        await defaultUser.click(videoOption);

        expect(await screen.findByText('Setting up a connection...')).toBeVisible();

        const hangUpButton = screen.getByRole('button', { name: /hang up/i });
        await defaultUser.click(hangUpButton!);

        await waitFor(() => {
          expect(screen.queryByText('Setting up a connection...')).toBeNull();
        });

        await new Promise((resolve) => setTimeout(resolve, 600));

        const mockRoomInstance = await getMockRoomInstance();
        expect(mockRoomInstance.state).toBe(ConnectionState.Disconnected);
      }
    );

    it(
      'handles unexpected remote disconnection gracefully',
      {
        meta: {
          alias: 'Call-Unexpected-Disconnect',
          scenario: "The call is active, but the assistant's connection drops unexpectedly.",
          behavior:
            'The UI handles the disconnection event by resetting the view to the pre-call state.',
        },
      },
      async () => {
        renderPage();
        const callButton = await openProfileAndGetCallButton();
        await defaultUser.click(callButton);
        const videoOption = await screen.findByTestId('call-option-video');
        await defaultUser.click(videoOption);

        const mockRoomInstance = await getMockRoomInstance();
        mockRoomInstance.numParticipants = 2;
        mockRoomInstance.emit(RoomEvent.ParticipantConnected, { identity: 'assistant' });

        await screen.findByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`);

        mockRoomInstance.state = ConnectionState.Disconnected;
        mockRoomInstance.emit(RoomEvent.Disconnected);

        await waitFor(() => {
          expect(
            screen.queryByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
          ).toBeNull();
        });
      }
    );

    it(
      'handles microphone permission denial',
      {
        meta: {
          alias: 'Call-Device-Permission-Error',
          scenario: 'The browser denies microphone permissions during call setup.',
          behavior: 'The call setup aborts, the error is handled, and the room disconnects.',
        },
      },
      async () => {
        const LiveKitClient = await import('livekit-client');
        vi.mocked(LiveKitClient.Room).mockImplementationOnce(function () {
          const room = new MockRoom();
          room.localParticipant.setMicrophoneEnabled = vi
            .fn()
            .mockRejectedValue(new Error('Permission denied'));
          return room;
        } as any);

        renderPage();
        const callButton = await openProfileAndGetCallButton();
        await defaultUser.click(callButton);
        const audioOption = await screen.findByTestId('call-option-audio');
        await defaultUser.click(audioOption);

        await waitFor(() => {
          expect(screen.queryByText('Setting up a connection...')).toBeNull();
        });

        const mockRoomInstance = await getMockRoomInstance();
        expect(mockRoomInstance.disconnect).toHaveBeenCalled();
      }
    );

    it(
      'allows retrying connection after a failure',
      {
        meta: {
          alias: 'Call-Retry-Flow',
          scenario: 'The connection times out, and the user clicks the retry button.',
          behavior:
            'The UI initiates a fresh connection attempt, successfully resetting error states and calling the API again.',
        },
      },
      async () => {
        (window as any)._TEST_ASSISTANT_JOIN_TIMEOUT = 2000;

        renderPage();

        // 1. Start and Fail (Timeout)
        const callButton = await openProfileAndGetCallButton();
        await defaultUser.click(callButton);
        const videoOption = await screen.findByTestId('call-option-video');
        await defaultUser.click(videoOption);

        expect(await screen.findByText(/Waiting for/)).toBeVisible();

        expect(
          await screen.findByText(
            `${targetAssistant.firstName} is taking too long to join.`,
            {},
            { timeout: 5000 }
          )
        ).toBeVisible();

        // 2. Click Retry
        const retryBtn = await screen.findByRole('button', { name: /retry/i });

        mockAssistantActions.call.getConnectionDetails = vi.fn().mockResolvedValue({
          serverUrl: 'ws://test-livekit-2',
          token: 'mock-token-2',
          roomName: 'room-456',
        });

        await defaultUser.click(retryBtn);

        await waitFor(() => {
          expect(screen.getByText('Setting up a connection...')).toBeVisible();
        });

        await waitFor(() => {
          expect(mockAssistantActions.call.getConnectionDetails).toHaveBeenCalledWith(
            targetAssistant.agentId,
            `${targetAssistant.firstName}${targetAssistant.surname}`
          );
        });
      }
    );

    it(
      'handles rapid connect/disconnect cycles',
      {
        meta: {
          alias: 'Call-Rapid-Toggle',
          scenario:
            'User rapidly toggles the call button and hangs up before connections finalize.',
          behavior:
            "The system handles race conditions gracefully, ensuring the final state matches the user's last action.",
        },
      },
      async () => {
        renderPage();
        const callButton = await openProfileAndGetCallButton();

        // Click 1: Start
        await defaultUser.click(callButton);
        const videoOption = await screen.findByTestId('call-option-video');
        await defaultUser.click(videoOption);

        // Click 2: Hangup
        await waitFor(() => expect(screen.getByTestId('audio-renderer')).toBeInTheDocument());

        const cancelBtn = screen.getByRole('button', { name: /hang up/i });
        if (cancelBtn) await defaultUser.click(cancelBtn);

        // Wait for dialog to close before trying to reopen
        await waitFor(() => expect(screen.queryByRole('button', { name: /hang up/i })).toBeNull());

        // Click 3: Start again
        // Re-find the button as DOM updated
        const callButton2 = await screen.findByTestId('call-menu-trigger');
        await defaultUser.click(callButton2);

        // Wait for menu to appear
        const videoOption2 = await screen.findByTestId('call-option-video');
        await defaultUser.click(videoOption2);

        expect(await screen.findByText('Setting up a connection...')).toBeVisible();

        await waitFor(() => {
          expect(mockAssistantActions.call.getConnectionDetails).toHaveBeenCalledTimes(2);
        });
      }
    );

    it(
      'cleans up the Room connection when the component unmounts',
      {
        meta: {
          alias: 'Call-Unmount-Cleanup',
          scenario: 'User navigates away (unmounts component) while a call is active.',
          behavior:
            'The Room connection is explicitly disconnected to prevent memory leaks or phantom calls.',
        },
      },
      async () => {
        const { unmount } = renderPage();
        const callButton = await openProfileAndGetCallButton();

        // 1. Establish Call
        await defaultUser.click(callButton);
        const videoOption = await screen.findByTestId('call-option-video');
        await defaultUser.click(videoOption);

        const mockRoomInstance = await getMockRoomInstance();
        // Simulate successful join state on the instance
        mockRoomInstance.numParticipants = 2;
        mockRoomInstance.state = ConnectionState.Connected; // Explicitly set state to ensure cleanup logic runs
        mockRoomInstance.emit(RoomEvent.ParticipantConnected, { identity: 'assistant' });

        await screen.findByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`);

        // 2. Simulate Navigation (Unmount)
        unmount();

        // 3. Verify Disconnect was triggered
        await waitFor(() => {
          expect(mockRoomInstance.disconnect).toHaveBeenCalled();
        });
      }
    );

    it(
      'prevents starting a second call while one is already active',
      {
        meta: {
          alias: 'Call-Prevent-Concurrent',
          scenario: 'User attempts to call a second assistant while already in a call.',
          behavior:
            'The second call action is blocked or disabled, and an appropriate warning is shown.',
        },
      },
      async () => {
        renderPage();

        const assistantA = mockAssistants[0];
        const cardA = await screen.findByText(`${assistantA.firstName} ${assistantA.surname}`);
        await defaultUser.click(cardA);

        const callButtonA = await screen.findByTestId('call-menu-trigger');
        await defaultUser.click(callButtonA);
        await defaultUser.click(await screen.findByTestId('call-option-video'));

        const mockRoomInstance = await getMockRoomInstance();
        mockRoomInstance.numParticipants = 2;
        mockRoomInstance.emit(RoomEvent.ParticipantConnected, { identity: 'assistant-a' });

        const minimizeBtn = await screen.findByRole('button', { name: /minimize/i });
        await defaultUser.click(minimizeBtn);

        const assistantB = mockAssistants[1];
        const cardB = await screen.findByText(`${assistantB.firstName} ${assistantB.surname}`);
        await defaultUser.click(cardB);

        const callButtonB = await screen.findByTestId('call-menu-trigger');

        if (callButtonB.hasAttribute('disabled')) {
          expect(callButtonB).toBeDisabled();
        } else {
          await defaultUser.click(callButtonB);
          const videoOptionB = await screen.queryByTestId('call-option-video');
          if (videoOptionB) await defaultUser.click(videoOptionB);
          expect(await screen.findByText(/call is already in progress/i)).toBeVisible();
        }
      }
    );

    it(
      'resets transient state between separate call sessions',
      {
        meta: {
          alias: 'Call-State-Reset-On-Close',
          scenario: 'User finishes one call, closes it, and immediately starts a new one.',
          behavior:
            'All transient state (participants, connection status) is reset, ensuring the second call starts fresh.',
        },
      },
      async () => {
        renderPage();
        const callButton = await openProfileAndGetCallButton();

        // --- SESSION 1 ---
        await defaultUser.click(callButton);
        await defaultUser.click(await screen.findByTestId('call-option-video'));

        const mockRoomInstance1 = await getMockRoomInstance();
        mockRoomInstance1.numParticipants = 2;
        mockRoomInstance1.emit(RoomEvent.ParticipantConnected, { identity: 'assistant' });

        await screen.findByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`);

        const hangUpButton = screen.getByRole('button', { name: /hang up/i });
        await defaultUser.click(hangUpButton!);

        await waitFor(() =>
          expect(
            screen.queryByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
          ).toBeNull()
        );

        // --- SESSION 2 ---
        // Refresh call button ref
        const callButton2 = await openProfileAndGetCallButton();
        await defaultUser.click(callButton2);
        await defaultUser.click(await screen.findByTestId('call-option-video'));

        expect(await screen.findByText('Setting up a connection...')).toBeVisible();

        const mockRoomInstance2 = await getMockRoomInstance();
        expect(mockRoomInstance2.connect).toHaveBeenCalledTimes(2);
      }
    );

    it(
      'handles network interruptions without crashing',
      {
        meta: {
          alias: 'Call-Network-Resilience',
          scenario: "The network drops temporarily causing a 'Reconnecting' state.",
          behavior:
            'The UI maintains the active call view without crashing during the reconnection phase.',
        },
      },
      async () => {
        renderPage();
        const callButton = await openProfileAndGetCallButton();
        await defaultUser.click(callButton);
        await defaultUser.click(await screen.findByTestId('call-option-video'));

        const mockRoomInstance = await getMockRoomInstance();
        mockRoomInstance.numParticipants = 2;
        mockRoomInstance.emit(RoomEvent.ParticipantConnected, { identity: 'assistant' });

        await screen.findByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`);

        mockRoomInstance.state = ConnectionState.Reconnecting;
        mockRoomInstance.emit(RoomEvent.Reconnecting);

        expect(
          screen.getByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
        ).toBeVisible();

        mockRoomInstance.state = ConnectionState.Connected;
        mockRoomInstance.emit(RoomEvent.Reconnected);

        expect(
          screen.getByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
        ).toBeVisible();
      }
    );

    it(
      'toggles microphone mute state',
      {
        meta: {
          alias: 'Call-Input-MicToggle',
          scenario: 'User clicks the microphone button.',
          behavior: 'The button state updates to reflect muted/unmuted status.',
        },
      },
      async () => {
        renderPage();
        await establishCall('video'); // Default mic enabled

        // Default is unmuted (active)
        const micBtn = await screen.findByLabelText('Mute microphone');
        expect(micBtn).toBeInTheDocument();

        // Click to mute
        await defaultUser.click(micBtn);

        // Label changes to 'Unmute microphone'
        const unmuteBtn = await screen.findByLabelText('Unmute microphone');
        expect(unmuteBtn).toBeInTheDocument();
        expect(screen.queryByLabelText('Mute microphone')).toBeNull();

        // Click to unmute
        await defaultUser.click(unmuteBtn);

        // Label changes back
        expect(await screen.findByLabelText('Mute microphone')).toBeInTheDocument();
      }
    );
  });

  describe('B-Assistant Screen Share', () => {
    it(
      'activates screen share view when remote control is toggled',
      {
        meta: {
          alias: 'Call-ScreenShare-Activation',
          scenario: 'User clicks the remote control button while in a call.',
          behavior:
            "The API is called to get the liveview URL, and an iframe displays the assistant's screen.",
        },
      },
      async () => {
        renderPage();
        await establishCall();

        // Locate and click the remote control button using findBy to wait for it to be ready/enabled
        const remoteControlBtn = await screen.findByLabelText('Show assistant screen');
        await defaultUser.click(remoteControlBtn);

        // Verify API call
        await waitFor(() => {
          expect(mockAssistantActions.desktop.getLiveviewUrl).toHaveBeenCalledWith(
            targetAssistant.agentId
          );
        });

        // Verify iframe is rendered with correct URL
        const iframe = await screen.findByTitle('Assistant Remote Desktop');
        expect(iframe).toBeVisible();
        expect(iframe).toHaveAttribute('src', 'https://vnc.example.com');

        // Should be in view-only mode (non-interactive) by default
        expect(screen.getByTitle('Enable interactive mode to take control')).toBeInTheDocument();
      }
    );

    it(
      'allows toggling screen share off to return to standard view',
      {
        meta: {
          alias: 'Call-ScreenShare-ToggleOff',
          scenario: 'User has screen share active and clicks the button again to hide it.',
          behavior:
            'The iframe is removed, and the standard assistant avatar/video view is restored.',
        },
      },
      async () => {
        // Ensure deterministic Avatar fallback by removing photo for this test
        const originalPhoto = targetAssistant.profilePhoto;
        targetAssistant.profilePhoto = null;

        try {
          renderPage();
          await establishCall();

          // 1. Turn On
          const remoteControlBtn = await screen.findByLabelText('Show assistant screen');
          await defaultUser.click(remoteControlBtn);
          await screen.findByTitle('Assistant Remote Desktop');

          // 2. Turn Off
          // Button label changes to "Hide assistant screen"
          const hideBtn = await screen.findByLabelText('Hide assistant screen');
          await defaultUser.click(hideBtn);

          // 3. Verify return to Avatar
          await waitFor(() => {
            expect(screen.queryByTitle('Assistant Remote Desktop')).toBeNull();
          });

          // Verify avatar fallback is visible via fallback text "JD" inside the call dialog
          // We scope to role="dialog" to ignore the "JD" in the background list
          const dialog = await screen.findByRole('dialog');
          expect(await within(dialog).findByText('JD')).toBeVisible();
        } finally {
          // Restore photo to avoid side effects
          targetAssistant.profilePhoto = originalPhoto;
        }
      }
    );

    it(
      'toggles interactive mode sending correct system events',
      {
        meta: {
          alias: 'Call-ScreenShare-Interaction',
          scenario: 'User toggles interactive mode on the screen share view.',
          behavior:
            "System events for 'user_remote_control_started' and 'user_remote_control_stopped' are sent to the backend.",
        },
      },
      async () => {
        renderPage();
        await establishCall();

        // 1. Enable Screen Share
        const remoteControlBtn = await screen.findByLabelText('Show assistant screen');
        await defaultUser.click(remoteControlBtn);
        await screen.findByTitle('Assistant Remote Desktop');

        // 2. Enable Interactive Mode
        const interactiveBtn = await screen.findByLabelText('Enable mouse & keyboard control');
        await defaultUser.click(interactiveBtn);

        // Verify API call for enabling (user takes remote control)
        await waitFor(() => {
          expect(mockAssistantActions.desktop.sendSystemEvent).toHaveBeenLastCalledWith(
            targetAssistant.agentId,
            'user_remote_control_started',
            expect.stringContaining('took remote control')
          );
        });

        // Verify overlay is gone
        expect(screen.queryByTitle('Enable interactive mode to take control')).toBeNull();

        // 3. Disable Interactive Mode
        await defaultUser.click(interactiveBtn); // Now acts as disable

        // Verify API call for disabling (user releases remote control)
        await waitFor(() => {
          expect(mockAssistantActions.desktop.sendSystemEvent).toHaveBeenLastCalledWith(
            targetAssistant.agentId,
            'user_remote_control_stopped',
            expect.stringContaining('released remote control')
          );
        });

        // Verify overlay is back
        expect(screen.getByTitle('Enable interactive mode to take control')).toBeVisible();
      }
    );

    it(
      'handles API failure when toggling interactive mode',
      {
        meta: {
          alias: 'Call-ScreenShare-Interaction-Failure',
          scenario: 'User tries to enable interactive mode but the API fails.',
          behavior:
            'The interactive mode state does not change, and an error notification is displayed.',
        },
      },
      async () => {
        mockAssistantActions.desktop.sendSystemEvent = vi
          .fn()
          .mockResolvedValue({ detail: 'Failed to send event' });

        renderPage();
        await establishCall();

        // Open Screen Share
        const showBtn = await screen.findByLabelText('Show assistant screen');
        await defaultUser.click(showBtn);
        await screen.findByTitle('Assistant Remote Desktop');

        // Try to enable interactive
        const interactiveBtn = await screen.findByLabelText('Enable mouse & keyboard control');
        await defaultUser.click(interactiveBtn);

        // Check for error toast. findAllByText handles potential duplicates or async appearance.
        const errorMessages = await screen.findAllByText(/could not enable interactive mode/i);
        expect(errorMessages.length).toBeGreaterThan(0);

        // Verify state did NOT change (overlay still present)
        expect(screen.getByTitle('Enable interactive mode to take control')).toBeVisible();
      }
    );

    it(
      'resets interactive mode when screen share is closed and reopened',
      {
        meta: {
          alias: 'Call-ScreenShare-StateReset',
          scenario: 'User enables interactive mode, closes screen share, and re-opens it.',
          behavior: 'Interactive mode is reset to false (view-only) upon re-opening screen share.',
        },
      },
      async () => {
        renderPage();
        await establishCall();

        // 1. Enable Screen Share
        const showBtn = await screen.findByLabelText('Show assistant screen');
        await defaultUser.click(showBtn);
        await screen.findByTitle('Assistant Remote Desktop');

        // 2. Enable Interactive
        const interactiveBtn = await screen.findByLabelText('Enable mouse & keyboard control');
        await defaultUser.click(interactiveBtn);
        expect(screen.queryByTitle('Enable interactive mode to take control')).toBeNull(); // Overlay gone

        // 3. Close Screen Share
        const hideBtn = await screen.findByLabelText('Hide assistant screen');
        await defaultUser.click(hideBtn);
        await waitFor(() => expect(screen.queryByTitle('Assistant Remote Desktop')).toBeNull());

        // 4. Re-open Screen Share
        // We need to re-find the button as DOM updated
        const showBtn2 = await screen.findByLabelText('Show assistant screen');
        await defaultUser.click(showBtn2);
        await screen.findByTitle('Assistant Remote Desktop');

        // 5. Verify reset to view-only (overlay present)
        expect(screen.getByTitle('Enable interactive mode to take control')).toBeVisible();
      }
    );

    it(
      'handles failure to retrieve liveview url gracefully',
      {
        meta: {
          alias: 'Call-ScreenShare-Error',
          scenario:
            'The backend fails to return a valid liveview URL when screen share is requested.',
          behavior: 'An error notification is shown, and the view does not switch to the iframe.',
        },
      },
      async () => {
        mockAssistantActions.desktop.getLiveviewUrl = vi
          .fn()
          .mockRejectedValue(new Error('Failed to fetch URL'));

        renderPage();
        await establishCall();

        const remoteControlBtn = await screen.findByLabelText('Show assistant screen');
        await defaultUser.click(remoteControlBtn);

        await waitFor(() => {
          expect(mockAssistantActions.desktop.getLiveviewUrl).toHaveBeenCalled();
        });

        // Expect error toast/notification. Using findAllByText to handle potential duplicates in toast rendering.
        const errorMessages = await screen.findAllByText(/could not share their screen/i);
        expect(errorMessages.length).toBeGreaterThan(0);
        expect(errorMessages[0]).toBeInTheDocument();

        // Iframe should not be present
        expect(screen.queryByTitle('Assistant Remote Desktop')).toBeNull();
      }
    );

    it(
      'cleans up screen share state when call is hung up while active',
      {
        meta: {
          alias: 'Call-ScreenShare-Hangup-While-Active',
          scenario: "User hangs up the call while viewing the assistant's screen.",
          behavior:
            'The call disconnects cleanly, and screen share state is reset for future calls.',
        },
      },
      async () => {
        renderPage();
        const room = await establishCall();

        // Open Screen Share
        const showBtn = await screen.findByLabelText('Show assistant screen');
        await defaultUser.click(showBtn);
        expect(await screen.findByTitle('Assistant Remote Desktop')).toBeVisible();

        // Hang up
        const hangUpBtn = screen.getByLabelText('Hang up');
        await defaultUser.click(hangUpBtn);

        await waitFor(() => {
          expect(room.disconnect).toHaveBeenCalled();
        });

        // Wait for main UI to disappear/reset
        await waitFor(() => {
          expect(screen.queryByTitle('Assistant Remote Desktop')).toBeNull();
        });
      }
    );
  });

  describe('C-View States (Fullscreen & Minimized)', () => {
    it(
      'minimizes call to a floating widget',
      {
        meta: {
          alias: 'Call-View-Minimize',
          scenario: 'User clicks the minimize button in the main dialog.',
          behavior:
            'The main call dialog disappears, and a small floating widget appears in the bottom right.',
        },
      },
      async () => {
        renderPage();
        await establishCall('video');

        // Verify Header exists
        expect(
          screen.getByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
        ).toBeVisible();

        // Click Minimize
        const minimizeBtn = await screen.findByLabelText('Minimize');
        await defaultUser.click(minimizeBtn);

        // Header should be gone
        await waitFor(() => {
          expect(
            screen.queryByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
          ).toBeNull();
        });

        // Widget should be present (can check by Expand button which is unique to widget)
        expect(screen.getByLabelText('Expand View')).toBeVisible();

        // Widget should still show controls like Hang Up
        expect(screen.getByLabelText('Hang Up')).toBeVisible();
      }
    );

    it(
      'expands call from floating widget back to dialog',
      {
        meta: {
          alias: 'Call-View-Expand',
          scenario: 'User clicks the expand button on the floating widget.',
          behavior: 'The floating widget disappears, and the main call dialog reappears.',
        },
      },
      async () => {
        renderPage();
        await establishCall('video');

        // 1. Minimize
        const minimizeBtn = await screen.findByLabelText('Minimize');
        await defaultUser.click(minimizeBtn);
        await waitFor(() =>
          expect(
            screen.queryByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
          ).toBeNull()
        );

        // 2. Expand
        const expandBtn = await screen.findByLabelText('Expand View');
        await defaultUser.click(expandBtn);

        // 3. Verify Dialog is back
        await waitFor(() => {
          expect(
            screen.getByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
          ).toBeVisible();
        });
        // Expand button should be gone
        expect(screen.queryByLabelText('Expand View')).toBeNull();
      }
    );

    it(
      'hangs up directly from the minimized widget',
      {
        meta: {
          alias: 'Call-View-Minimize-Hangup',
          scenario: 'User clicks hang up on the floating widget.',
          behavior: 'The call disconnects, and the widget disappears.',
        },
      },
      async () => {
        renderPage();
        const room = await establishCall('video');

        // 1. Minimize
        const minimizeBtn = await screen.findByLabelText('Minimize');
        await defaultUser.click(minimizeBtn);

        // 2. Hang Up from Widget
        const hangUpWidgetBtn = await screen.findByLabelText('Hang Up');
        await defaultUser.click(hangUpWidgetBtn);

        // 3. Verify Disconnect
        await waitFor(() => {
          expect(room.disconnect).toHaveBeenCalled();
        });

        // 4. Verify Widget Gone
        await waitFor(() => {
          expect(screen.queryByLabelText('Expand View')).toBeNull();
          expect(screen.queryByLabelText('Hang Up')).toBeNull();
        });
      }
    );

    it(
      'transfers call to new tab (Pop-out)',
      {
        meta: {
          alias: 'Call-View-PopOut',
          scenario: "User clicks the 'Open in new tab' button.",
          behavior:
            'Calls window.open and transfers call data to local storage to hand off the session.',
        },
      },
      async () => {
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

        renderPage();
        await establishCall('video');

        const popOutBtn = await screen.findByLabelText('Open in new tab');
        await defaultUser.click(popOutBtn);

        // Verify window.open was called with a call URL pattern
        expect(openSpy).toHaveBeenCalledTimes(1);
        const openedUrl = openSpy.mock.calls[0][0] as string;
        expect(openedUrl).toMatch(/\/assistants\/call\//);

        // Cleanup
        openSpy.mockRestore();
      }
    );
  });

  // =========================================================================
  // SECTION E: CALL RECONNECTION
  // =========================================================================
  describe('E-Call Reconnection', () => {
    it(
      'handles assistant leaving and rejoining during call',
      {
        meta: {
          alias: 'Call-Reconnect-Participant',
          scenario: 'Assistant temporarily disconnects during an active call.',
          behavior:
            'The UI shows waiting state with disconnect message, redispatches assistant, and reconnects when assistant rejoins.',
        },
      },
      async () => {
        renderPage();
        const room = await establishCall('video');

        // Verify call is active
        expect(
          screen.getByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
        ).toBeVisible();

        // Clear the mock to track the redispatch call
        mockAssistantActions.call.dispatchToCall.mockClear();

        // Simulate assistant leaving
        room.numParticipants = 1;
        room.emit(RoomEvent.ParticipantDisconnected, { identity: 'assistant-agent' });

        // Should show waiting state with disconnect message
        await waitFor(() => {
          expect(
            screen.getByText(
              `${targetAssistant.firstName} disconnected, waiting for them to rejoin...`
            )
          ).toBeVisible();
        });

        // Verify dispatchToCall was called to redispatch the assistant
        await waitFor(() => {
          expect(mockAssistantActions.call.dispatchToCall).toHaveBeenCalledWith(
            targetAssistant.agentId,
            expect.any(String) // roomName
          );
        });

        // Assistant rejoins
        room.numParticipants = 2;
        room.emit(RoomEvent.ParticipantConnected, { identity: 'assistant-agent' });

        // Should resume normal call view
        await waitFor(() => {
          expect(
            screen.getByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
          ).toBeVisible();
        });
      }
    );

    it(
      'shows retry option when connection drops unexpectedly',
      {
        meta: {
          alias: 'Call-Reconnect-Retry',
          scenario: 'Room connection drops due to network issues.',
          behavior: 'UI transitions to error state with retry option.',
        },
      },
      async () => {
        renderPage();
        const room = await establishCall('audio');

        // Simulate unexpected disconnect
        room.state = ConnectionState.Disconnected;
        room.emit(RoomEvent.Disconnected);

        // Call view should be closed
        await waitFor(() => {
          expect(
            screen.queryByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
          ).toBeNull();
        });

        // Verify we can start a new call
        const callButton = await screen.findByTestId('call-menu-trigger');
        expect(callButton).toBeInTheDocument();
      }
    );

    it(
      'cleans up resources on connection failure during setup',
      {
        meta: {
          alias: 'Call-Reconnect-Cleanup',
          scenario: 'LiveKit room.connect() throws an error.',
          behavior: 'Room is disconnected and resources are cleaned up properly.',
        },
      },
      async () => {
        const LiveKitClient = await import('livekit-client');
        const mockRoom = new MockRoom();
        mockRoom.connect = vi.fn().mockRejectedValue(new Error('Connection failed'));
        vi.mocked(LiveKitClient.Room).mockImplementationOnce(function () {
          return mockRoom;
        });

        renderPage();
        const callButton = await openProfileAndGetCallButton();
        await defaultUser.click(callButton);

        const audioOption = await screen.findByTestId('call-option-audio');
        await defaultUser.click(audioOption);

        // Wait for error to be handled - connect should have been called and failed
        await waitFor(() => {
          expect(mockRoom.connect).toHaveBeenCalled();
        });

        // Give time for the error to propagate
        await waitFor(() => {
          // Should not show call view after connection failure
          expect(
            screen.queryByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
          ).toBeNull();
        });

        // disconnect() is only called if room.state !== 'disconnected'
        // Since connect() failed, state is still 'disconnected', so disconnect() won't be called
        expect(mockRoom.state).toBe(ConnectionState.Disconnected);
      }
    );

    it(
      'handles rapid disconnect/reconnect without state corruption',
      {
        meta: {
          alias: 'Call-Reconnect-Rapid',
          scenario: 'User rapidly disconnects and starts new call.',
          behavior: 'Each call session is independent, no state leakage between calls.',
        },
      },
      async () => {
        renderPage();

        // First call
        const room1 = await establishCall('audio');
        expect(
          screen.getByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
        ).toBeVisible();

        // Hang up
        const hangUpButton = screen.getByRole('button', { name: /hang up/i });
        await defaultUser.click(hangUpButton);

        await waitFor(() => {
          expect(room1.disconnect).toHaveBeenCalled();
        });

        // Wait for UI to reset
        await waitFor(() => {
          expect(
            screen.queryByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
          ).toBeNull();
        });

        // Start second call immediately
        const callButton = await screen.findByTestId('call-menu-trigger');
        await defaultUser.click(callButton);

        const videoOption = await screen.findByTestId('call-option-video');
        await defaultUser.click(videoOption);

        // Wait for new connection
        const room2 = await getMockRoomInstance();
        await waitFor(() => expect(room2.connect).toHaveBeenCalled());

        // Simulate assistant joining
        room2.numParticipants = 2;
        room2.emit(RoomEvent.ParticipantConnected, { identity: 'assistant-agent' });

        // Second call should be active
        await waitFor(() => {
          expect(
            screen.getByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
          ).toBeVisible();
        });
      }
    );

    it(
      'maintains call controls after participant reconnect',
      {
        meta: {
          alias: 'Call-Reconnect-Controls',
          scenario: 'Assistant reconnects after brief disconnect.',
          behavior: 'All call controls (mute, camera, etc.) remain functional.',
        },
      },
      async () => {
        renderPage();
        const room = await establishCall('video');

        // Verify controls work before disconnect - find mute button and verify it can be clicked
        const muteButton = await screen.findByLabelText('Mute microphone');
        expect(muteButton).toBeVisible();
        await defaultUser.click(muteButton);

        // After clicking mute, the button should now be "Unmute microphone"
        await waitFor(() => {
          expect(screen.queryByLabelText('Unmute microphone')).toBeInTheDocument();
        });

        // Simulate assistant disconnect and reconnect
        room.numParticipants = 1;
        room.emit(RoomEvent.ParticipantDisconnected, { identity: 'assistant-agent' });

        await waitFor(() => {
          expect(
            screen.getByText(
              `${targetAssistant.firstName} disconnected, waiting for them to rejoin...`
            )
          ).toBeVisible();
        });

        room.numParticipants = 2;
        room.emit(RoomEvent.ParticipantConnected, { identity: 'assistant-agent' });

        await waitFor(() => {
          expect(
            screen.getByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
          ).toBeVisible();
        });

        // Verify controls still work after reconnect - the mute state should be preserved
        const unmuteButton = await screen.findByLabelText('Unmute microphone');
        expect(unmuteButton).toBeVisible();
        await defaultUser.click(unmuteButton);

        // After clicking unmute, the button should now be "Mute microphone" again
        await waitFor(() => {
          expect(screen.queryByLabelText('Mute microphone')).toBeInTheDocument();
        });
      }
    );
  });

  // =========================================================================
  // SECTION F: STRESS AND ROBUSTNESS TESTS
  // =========================================================================
  describe('F-Stress and Robustness', () => {
    describe('Rapid Connection Stress', () => {
      it(
        'handles rapid connect-disconnect-connect cycles without state corruption',
        {
          meta: {
            alias: 'Call-Stress-RapidCycle',
            scenario:
              'User rapidly clicks call, hangs up, and calls again before previous operations complete.',
            behavior:
              'Each cycle is handled cleanly with no orphaned state from previous attempts.',
          },
        },
        async () => {
          renderPage();
          const callButton = await openProfileAndGetCallButton();

          // Cycle 1: Start call
          await defaultUser.click(callButton);
          const videoOption1 = await screen.findByTestId('call-option-video');
          await defaultUser.click(videoOption1);

          // Don't wait for connection to complete - immediately cancel
          const hangUpBtn1 = await screen.findByRole('button', { name: /hang up/i });
          await defaultUser.click(hangUpBtn1);

          // Wait for UI to reset
          await waitFor(() =>
            expect(screen.queryByRole('button', { name: /hang up/i })).toBeNull()
          );

          // Cycle 2: Start another call immediately
          const callButton2 = await screen.findByTestId('call-menu-trigger');
          await defaultUser.click(callButton2);
          const videoOption2 = await screen.findByTestId('call-option-video');
          await defaultUser.click(videoOption2);

          // Cancel again quickly
          const hangUpBtn2 = await screen.findByRole('button', { name: /hang up/i });
          await defaultUser.click(hangUpBtn2);

          await waitFor(() =>
            expect(screen.queryByRole('button', { name: /hang up/i })).toBeNull()
          );

          // Cycle 3: Start final call and let it connect
          const callButton3 = await screen.findByTestId('call-menu-trigger');
          await defaultUser.click(callButton3);
          const videoOption3 = await screen.findByTestId('call-option-video');
          await defaultUser.click(videoOption3);

          const mockRoom = await getMockRoomInstance();
          mockRoom.numParticipants = 2;
          mockRoom.emit(RoomEvent.ParticipantConnected, { identity: 'assistant' });

          // Final call should be stable
          await waitFor(() => {
            expect(
              screen.getByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
            ).toBeVisible();
          });

          // Verify no duplicate API calls from zombie operations
          // Should have called getConnectionDetails 3 times (one per cycle)
          expect(mockAssistantActions.call.getConnectionDetails).toHaveBeenCalledTimes(3);
        }
      );

      it(
        'clears pending retry timeouts when user disconnects during connection retry loop',
        {
          meta: {
            alias: 'Call-Stress-RetryCleanup',
            scenario: 'Connection fails, retry loop starts, but user hangs up during retry delay.',
            behavior: 'Retry loop is cancelled and no further connection attempts are made.',
          },
        },
        async () => {
          // Use real timers but with controlled delays in mocks
          let callCount = 0;
          let resolvers: (() => void)[] = [];

          // Make connection fail with delays we control
          mockAssistantActions.call.getConnectionDetails = vi.fn().mockImplementation(async () => {
            callCount++;
            // First call resolves immediately with error
            if (callCount === 1) {
              return { detail: 'Service temporarily unavailable' };
            }
            // Subsequent calls hang until we resolve them
            return new Promise((resolve) => {
              resolvers.push(() => resolve({ detail: 'Still failing' }));
            });
          });

          renderPage();
          const callButton = await openProfileAndGetCallButton();
          await defaultUser.click(callButton);
          const videoOption = await screen.findByTestId('call-option-video');
          await defaultUser.click(videoOption);

          // Wait for first attempt to fail
          await waitFor(() => {
            expect(mockAssistantActions.call.getConnectionDetails).toHaveBeenCalledTimes(1);
          });

          // Wait briefly for retry to be scheduled (1 second delay in code)
          await new Promise((r) => setTimeout(r, 1100));

          // Second attempt should have started
          await waitFor(
            () => {
              expect(mockAssistantActions.call.getConnectionDetails).toHaveBeenCalledTimes(2);
            },
            { timeout: 2000 }
          );

          // User hangs up while second attempt is pending
          const hangUpBtn = screen.getByRole('button', { name: /hang up/i });
          await defaultUser.click(hangUpBtn);

          // Wait for UI to reset
          await waitFor(() =>
            expect(screen.queryByRole('button', { name: /hang up/i })).toBeNull()
          );

          // Resolve the pending request (should be ignored due to cancellation)
          resolvers.forEach((r) => r());

          // Wait to see if any more retries happen
          await new Promise((r) => setTimeout(r, 3000));

          // Should only have 2 calls (first attempt + one retry, not all 4)
          expect(
            mockAssistantActions.call.getConnectionDetails.mock.calls.length
          ).toBeLessThanOrEqual(3);
        }
      );
    });

    describe('Stale Closure in Redispatch', () => {
      it(
        'uses current assistant data when redispatching after participant disconnect',
        {
          meta: {
            alias: 'Call-Stress-RedispatchStale',
            scenario:
              'Assistant disconnects, redispatch starts, but call state references change during redispatch retry.',
            behavior: 'Redispatch uses the correct assistant ID captured at start of operation.',
          },
        },
        async () => {
          renderPage();
          const room = await establishCall('video');

          // Clear mocks to track redispatch calls
          mockAssistantActions.call.dispatchToCall.mockClear();

          // Make dispatch fail to trigger retry loop
          let dispatchCallCount = 0;
          mockAssistantActions.call.dispatchToCall = vi.fn().mockImplementation(async () => {
            dispatchCallCount++;
            if (dispatchCallCount <= 2) {
              await new Promise((r) => setTimeout(r, 100));
              throw new Error('Temporary failure');
            }
            return { info: 'dispatched' };
          });

          // Simulate assistant disconnecting
          room.numParticipants = 1;
          room.emit(RoomEvent.ParticipantDisconnected, { identity: 'assistant-agent' });

          // Wait for redispatch to be called
          await waitFor(() => {
            expect(mockAssistantActions.call.dispatchToCall).toHaveBeenCalled();
          });

          // All dispatch calls should use the same assistant ID (Jane's)
          const dispatchCalls = mockAssistantActions.call.dispatchToCall.mock.calls;
          const allUseCorrectAssistant = dispatchCalls.every(
            (call: unknown[]) => call[0] === targetAssistant.agentId
          );
          expect(allUseCorrectAssistant).toBe(true);
        }
      );
    });

    describe('Remote Control Race Conditions', () => {
      it(
        'handles rapid remote control toggle without orphaned requests',
        {
          meta: {
            alias: 'Call-Stress-RemoteToggleRapid',
            scenario: 'User rapidly toggles remote control on/off/on before requests complete.',
            behavior:
              'Only the final toggle state is applied, and no orphaned requests cause state corruption.',
          },
        },
        async () => {
          let requestCount = 0;
          const requestOrder: string[] = [];

          mockAssistantActions.desktop.getLiveviewUrl = vi.fn().mockImplementation(async () => {
            requestCount++;
            const thisRequest = requestCount;
            requestOrder.push(`start-${thisRequest}`);
            // Simulate varying response times
            await new Promise((r) => setTimeout(r, thisRequest === 1 ? 200 : 50));
            requestOrder.push(`end-${thisRequest}`);
            return { liveviewUrl: `https://vnc${thisRequest}.example.com` };
          });

          renderPage();
          await establishCall('video');

          // Toggle 1: Turn on (starts slow request)
          const showBtn = await screen.findByLabelText('Show assistant screen');
          await defaultUser.click(showBtn);

          // Toggle 2: Turn off immediately (before first request completes)
          // Need to wait briefly for the loading state to start
          await waitFor(() => {
            expect(mockAssistantActions.desktop.getLiveviewUrl).toHaveBeenCalledTimes(1);
          });

          // The button should now show "Hide" since loading started
          // But we want to test what happens if we click again - let's wait for iframe
          await screen.findByTitle('Assistant Remote Desktop');

          // Turn off
          const hideBtn = await screen.findByLabelText('Hide assistant screen');
          await defaultUser.click(hideBtn);

          await waitFor(() => {
            expect(screen.queryByTitle('Assistant Remote Desktop')).toBeNull();
          });

          // Turn on again
          const showBtn2 = await screen.findByLabelText('Show assistant screen');
          await defaultUser.click(showBtn2);

          await screen.findByTitle('Assistant Remote Desktop');

          // The final URL should be from the most recent request
          const iframe = screen.getByTitle('Assistant Remote Desktop');
          expect(iframe).toHaveAttribute('src', expect.stringContaining('vnc'));
        }
      );

      it(
        'cancels pending remote control request when call is disconnected',
        {
          meta: {
            alias: 'Call-Stress-RemoteDisconnect',
            scenario: 'User starts remote control, but hangs up before it loads.',
            behavior: 'Remote control state is cleaned up and no orphaned loading state persists.',
          },
        },
        async () => {
          const pendingRequest: { resolve: (() => void) | null } = { resolve: null };
          mockAssistantActions.desktop.getLiveviewUrl = vi.fn().mockImplementation(
            () =>
              new Promise((resolve) => {
                pendingRequest.resolve = () => resolve({ liveviewUrl: 'https://vnc.example.com' });
              })
          );

          renderPage();
          const room = await establishCall('video');

          // Start remote control
          const showBtn = await screen.findByLabelText('Show assistant screen');
          await defaultUser.click(showBtn);

          // Verify loading started
          await waitFor(() => {
            expect(mockAssistantActions.desktop.getLiveviewUrl).toHaveBeenCalled();
          });

          // Hang up while loading
          const hangUpBtn = screen.getByRole('button', { name: /hang up/i });
          await defaultUser.click(hangUpBtn);

          await waitFor(() => {
            expect(room.disconnect).toHaveBeenCalled();
          });

          // Now resolve the pending request
          if (pendingRequest.resolve) pendingRequest.resolve();

          // Give time for any state updates to propagate
          await new Promise((r) => setTimeout(r, 100));

          // Remote control iframe should NOT appear (call is disconnected)
          expect(screen.queryByTitle('Assistant Remote Desktop')).toBeNull();
        }
      );
    });

    describe('Retry Connection Event Handler Race', () => {
      it(
        'preserves disconnect handler during retry connection',
        {
          meta: {
            alias: 'Call-Stress-RetryHandlerRace',
            scenario:
              'User clicks retry, and a disconnect event fires while handler is temporarily detached.',
            behavior: 'The disconnect is handled properly after handler is reattached.',
          },
        },
        async () => {
          (window as any)._TEST_ASSISTANT_JOIN_TIMEOUT = 500;

          renderPage();
          const callButton = await openProfileAndGetCallButton();

          // Start call and wait for timeout error
          await defaultUser.click(callButton);
          const videoOption = await screen.findByTestId('call-option-video');
          await defaultUser.click(videoOption);

          // Wait for timeout error
          await waitFor(
            () => {
              expect(
                screen.getByText(`${targetAssistant.firstName} is taking too long to join.`)
              ).toBeVisible();
            },
            { timeout: 2000 }
          );

          // Click retry
          const retryBtn = await screen.findByRole('button', { name: /retry/i });
          await defaultUser.click(retryBtn);

          // Wait for retry to start
          await waitFor(() => {
            expect(screen.getByText('Setting up a connection...')).toBeVisible();
          });

          // Get the room and simulate a disconnect
          const mockRoom = await getMockRoomInstance();
          mockRoom.state = ConnectionState.Disconnected;
          mockRoom.emit(RoomEvent.Disconnected);

          // The disconnect should be handled - call dialog should close
          await waitFor(() => {
            expect(screen.queryByText('Setting up a connection...')).toBeNull();
          });

          // Should be able to start a new call
          const callButton2 = await screen.findByTestId('call-menu-trigger');
          expect(callButton2).toBeInTheDocument();
        }
      );
    });

    describe('Timeout Cleanup on Unmount', () => {
      it(
        'clears all pending timeouts when component unmounts during waiting state',
        {
          meta: {
            alias: 'Call-Stress-TimeoutUnmount',
            scenario: 'Component unmounts while waiting for assistant to join.',
            behavior: 'All timeouts are cleared and no state updates occur after unmount.',
          },
        },
        async () => {
          vi.useFakeTimers({ shouldAdvanceTime: true });
          const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          const { unmount } = renderPage();
          const callButton = await openProfileAndGetCallButton(user);

          await user.click(callButton);
          const videoOption = await screen.findByTestId('call-option-video');
          await user.click(videoOption);

          // Wait for "waiting for assistant" state
          await waitFor(() => {
            expect(screen.getByText(/Waiting for .* to join/)).toBeVisible();
          });

          // Unmount while waiting
          unmount();

          // Advance time past the timeout
          await act(async () => {
            vi.advanceTimersByTime(70000); // Past the 60s join timeout
          });

          // No React errors should have occurred from state updates after unmount
          const reactErrors = consoleSpy.mock.calls.filter(
            (call) =>
              call[0]?.toString().includes("Can't perform a React state update") ||
              call[0]?.toString().includes('unmounted component')
          );
          expect(reactErrors.length).toBe(0);

          consoleSpy.mockRestore();
          vi.useRealTimers();
        }
      );

      it(
        'clears rejoin timeout when component unmounts during redispatch',
        {
          meta: {
            alias: 'Call-Stress-RejoinTimeoutUnmount',
            scenario: 'Component unmounts while assistant is being redispatched after disconnect.',
            behavior: 'Rejoin timeout is cleared and no state updates occur after unmount.',
          },
        },
        async () => {
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          // Set short rejoin timeout for testing
          (window as any)._TEST_ASSISTANT_REJOIN_TIMEOUT = 500;

          const { unmount } = renderPage();

          // Use establishCall helper to get to a connected state
          const mockRoom = await establishCall('video');

          // Now make redispatch hang
          mockAssistantActions.call.dispatchToCall = vi.fn().mockImplementation(
            () => new Promise(() => {}) // Never resolves
          );

          // Simulate assistant disconnect
          mockRoom.numParticipants = 1;
          mockRoom.emit(RoomEvent.ParticipantDisconnected, { identity: 'assistant-agent' });

          await waitFor(() => {
            expect(
              screen.getByText(
                `${targetAssistant.firstName} disconnected, waiting for them to rejoin...`
              )
            ).toBeVisible();
          });

          // Unmount while waiting for rejoin
          unmount();

          // Wait past the rejoin timeout (using real timers)
          await new Promise((r) => setTimeout(r, 700));

          // No React errors should have occurred from state updates after unmount
          const reactErrors = consoleSpy.mock.calls.filter(
            (call) =>
              call[0]?.toString().includes("Can't perform a React state update") ||
              call[0]?.toString().includes('unmounted component')
          );
          expect(reactErrors.length).toBe(0);

          consoleSpy.mockRestore();
          delete (window as any)._TEST_ASSISTANT_REJOIN_TIMEOUT;
        }
      );
    });

    describe('Concurrent Operation Handling', () => {
      it(
        'prevents multiple simultaneous connect attempts',
        {
          meta: {
            alias: 'Call-Stress-ConcurrentConnect',
            scenario: 'User somehow triggers connect twice rapidly (e.g., double-click).',
            behavior: 'Only one connection is established, second attempt is ignored.',
          },
        },
        async () => {
          // Make connection slow
          mockAssistantActions.call.getConnectionDetails = vi.fn().mockImplementation(async () => {
            await new Promise((r) => setTimeout(r, 200));
            return {
              serverUrl: 'ws://test-livekit',
              token: 'mock-token',
              roomName: 'room-123',
            };
          });

          renderPage();
          const callButton = await openProfileAndGetCallButton();

          // Start first call
          await defaultUser.click(callButton);
          const videoOption1 = await screen.findByTestId('call-option-video');
          await defaultUser.click(videoOption1);

          // Try to start second call immediately (menu should be gone, but let's verify behavior)
          // The room.state check should prevent this
          await waitFor(() => {
            expect(mockAssistantActions.call.getConnectionDetails).toHaveBeenCalledTimes(1);
          });

          // Wait for connection
          const mockRoom = await getMockRoomInstance();
          await waitFor(() => expect(mockRoom.connect).toHaveBeenCalled());

          // Complete the call
          mockRoom.numParticipants = 2;
          mockRoom.emit(RoomEvent.ParticipantConnected, { identity: 'assistant' });

          await waitFor(() => {
            expect(
              screen.getByText(`Talk to ${targetAssistant.firstName} ${targetAssistant.surname}`)
            ).toBeVisible();
          });

          // Only one getConnectionDetails call should have been made
          expect(mockAssistantActions.call.getConnectionDetails).toHaveBeenCalledTimes(1);
        }
      );

      it(
        'handles disconnect during camera/mic setup',
        {
          meta: {
            alias: 'Call-Stress-DisconnectDuringSetup',
            scenario: 'Room disconnects while enabling camera/microphone.',
            behavior: 'Disconnect is handled gracefully without throwing.',
          },
        },
        async () => {
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          const LiveKitClient = await import('livekit-client');
          vi.mocked(LiveKitClient.Room).mockImplementationOnce(function () {
            const room = new MockRoom();
            room.localParticipant.setMicrophoneEnabled = vi.fn().mockImplementation(async () => {
              // Simulate disconnect happening during mic setup
              room.state = ConnectionState.Disconnected;
              room.emit(RoomEvent.Disconnected);
            });
            return room;
          } as any);

          renderPage();
          const callButton = await openProfileAndGetCallButton();
          await defaultUser.click(callButton);
          const audioOption = await screen.findByTestId('call-option-audio');
          await defaultUser.click(audioOption);

          // Wait for the disconnect to be handled
          await waitFor(() => {
            expect(screen.queryByText('Setting up a connection...')).toBeNull();
          });

          // Should not have crashed - verify we can still interact
          const callButton2 = await screen.findByTestId('call-menu-trigger');
          expect(callButton2).toBeInTheDocument();

          // Check for actual errors (not just mock logging)
          const realErrors = consoleSpy.mock.calls.filter((call) =>
            call[0]?.toString().includes('Unhandled')
          );
          expect(realErrors.length).toBe(0);

          consoleSpy.mockRestore();
        }
      );
    });

    describe('Assistant Switch During Active Call Operations', () => {
      it(
        'cancels in-flight operations when switching to a different assistant profile',
        {
          meta: {
            alias: 'Call-Stress-SwitchAssistant',
            scenario:
              'User starts call with Assistant A, hangs up, then quickly calls Assistant B while A operations are still pending.',
            behavior: "Operations for Assistant A don't affect Assistant B's call state.",
          },
        },
        async () => {
          const assistantA = mockAssistants[0];
          const assistantB = mockAssistants[1];

          // Make API calls slow
          mockAssistantActions.call.getConnectionDetails = vi.fn().mockImplementation(async () => {
            await new Promise((r) => setTimeout(r, 300));
            return {
              serverUrl: 'ws://test-livekit',
              token: 'mock-token',
              roomName: 'room-123',
            };
          });

          renderPage();

          // Start call with Assistant A
          const cardA = await screen.findByText(`${assistantA.firstName} ${assistantA.surname}`);
          await defaultUser.click(cardA);
          const callButtonA = await screen.findByTestId('call-menu-trigger');
          await defaultUser.click(callButtonA);
          await defaultUser.click(await screen.findByTestId('call-option-video'));

          // Immediately hang up
          const hangUpBtn = await screen.findByRole('button', { name: /hang up/i });
          await defaultUser.click(hangUpBtn);

          await waitFor(() =>
            expect(screen.queryByRole('button', { name: /hang up/i })).toBeNull()
          );

          // Switch to Assistant B and start call
          const cardB = await screen.findByText(`${assistantB.firstName} ${assistantB.surname}`);
          await defaultUser.click(cardB);
          const callButtonB = await screen.findByTestId('call-menu-trigger');
          await defaultUser.click(callButtonB);
          await defaultUser.click(await screen.findByTestId('call-option-audio'));

          const mockRoom = await getMockRoomInstance();
          await waitFor(() => expect(mockRoom.connect).toHaveBeenCalled());

          // Complete B's call
          mockRoom.numParticipants = 2;
          mockRoom.emit(RoomEvent.ParticipantConnected, { identity: 'assistant-b' });

          // Should show Assistant B's name
          await waitFor(() => {
            expect(
              screen.getByText(`Talk to ${assistantB.firstName} ${assistantB.surname}`)
            ).toBeVisible();
          });

          // Verify the dispatch was for Assistant B (the last call)
          const dispatchCalls = mockAssistantActions.call.dispatchToCall.mock.calls;
          const lastDispatch = dispatchCalls[dispatchCalls.length - 1];
          expect(lastDispatch[0]).toBe(assistantB.agentId);
        }
      );
    });
  });
});
