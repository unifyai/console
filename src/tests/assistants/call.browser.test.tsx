import { render, screen, waitFor, within, act } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Main from '@/components/Pages/Assistants/Main';
import { mockAssistantActions, mockTaskActions } from './mocks/actions';
import { mockAssistants } from './mocks/data';
import { RoomEvent, ConnectionState } from 'livekit-client';
import { EventEmitter } from 'events';

// 1. Mock LiveKit Client
class MockLocalParticipant {
  setMicrophoneEnabled = vi.fn().mockResolvedValue(undefined);
  setCameraEnabled = vi.fn().mockResolvedValue(undefined);
  setScreenShareEnabled = vi.fn().mockResolvedValue(undefined);
  // Always return a track publication so UI logic depends on toggle state (isCameraOn)
  getTrackPublication = vi.fn().mockReturnValue({
    isSubscribed: true,
    track: { kind: 'video', attach: vi.fn(), detach: vi.fn() },
    source: 'camera',
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
  return {
    ...actual,
    Room: vi.fn(function () {
      return new MockRoom();
    }),
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
    (window as any).__mockLiveKitState = {
      micEnabled: true,
      camEnabled: type === 'video',
      screenShareEnabled: false,
    };

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
    // Reset shared state
    (window as any).__mockLiveKitState = {
      micEnabled: true,
      camEnabled: false,
      screenShareEnabled: false,
    };

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
          expect(mockAssistantActions.call.getConnectionDetails).toHaveBeenCalled();
        });

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
          expect(mockAssistantActions.call.getConnectionDetails).toHaveBeenCalled();
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
            "System events for 'pause_actor' (enable user control) and 'resume_actor' (return control to AI) are sent to the backend.",
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

        // Verify API call for enabling (Pausing AI actor)
        await waitFor(() => {
          expect(mockAssistantActions.desktop.sendSystemEvent).toHaveBeenLastCalledWith(
            targetAssistant.agentId,
            'pause_actor',
            expect.stringContaining('taking over')
          );
        });

        // Verify overlay is gone
        expect(screen.queryByTitle('Enable interactive mode to take control')).toBeNull();

        // 3. Disable Interactive Mode
        await defaultUser.click(interactiveBtn); // Now acts as disable

        // Verify API call for disabling (Resuming AI actor)
        await waitFor(() => {
          expect(mockAssistantActions.desktop.sendSystemEvent).toHaveBeenLastCalledWith(
            targetAssistant.agentId,
            'resume_actor',
            expect.stringContaining('handing back')
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

        expect(openSpy).toHaveBeenCalled();

        // Cleanup
        openSpy.mockRestore();
      }
    );
  });
});
