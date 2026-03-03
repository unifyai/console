/**
 * Call Test Harness
 *
 * Provides reusable test utilities, LiveKit mocks, and wrapper components
 * for testing call-related functionality.
 *
 * @example
 * ```tsx
 * import { setupCallMocks, CallTestHarness, getMockRoom } from './fixtures/callTestHarness';
 *
 * // At module level (before describe):
 * setupCallMocks();
 *
 * // In your test:
 * const room = getMockRoom();
 * render(<CallTestHarness />);
 *
 * // Simulate connection
 * await room.connect('wss://test.livekit.cloud', 'token');
 * ```
 */
import * as React from 'react';
import { vi } from 'vitest';
import { EventEmitter } from 'events';
import { RoomEvent, ConnectionState } from 'livekit-client';
import Main from '@/components/Pages/Assistants/Main';
import { mockAssistantActions, mockTaskActions } from '../../mocks/actions';
import { mockAssistants } from '../../mocks/data';
import { AssistantActions } from '@/types/assistants/assistant';
import { TaskActions } from '@/types/assistants/task';

// =============================================================================
// LIVEKIT MOCK CLASSES
// =============================================================================

/**
 * Mock LocalParticipant for testing local user controls.
 */
export class MockLocalParticipant {
  setMicrophoneEnabled = vi.fn().mockResolvedValue(undefined);
  setCameraEnabled = vi.fn().mockResolvedValue(undefined);
  setScreenShareEnabled = vi.fn().mockResolvedValue(undefined);

  getTrackPublication = vi.fn().mockReturnValue({
    isSubscribed: true,
    track: { kind: 'video', attach: vi.fn(), detach: vi.fn() },
    source: 'camera',
  });
}

/**
 * Mock Room class for testing LiveKit room behavior.
 * Extends EventEmitter to support event-based testing.
 */
export class MockRoom extends EventEmitter {
  state = ConnectionState.Disconnected;
  localParticipant = new MockLocalParticipant();
  numParticipants = 0;

  /**
   * Simulate connection to a room.
   * Use 'error-url' to simulate connection failure.
   */
  connect = vi.fn().mockImplementation(async (url: string, _token: string) => {
    if (url === 'error-url') {
      await new Promise((resolve) => setTimeout(resolve, 100));
      throw new Error('Simulated Connection Failure');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    this.state = ConnectionState.Connected;
    this.emit(RoomEvent.Connected);
    return Promise.resolve();
  });

  disconnect = vi.fn().mockImplementation(async () => {
    this.state = ConnectionState.Disconnected;
    this.emit(RoomEvent.Disconnected);
    return Promise.resolve();
  });

  switchActiveDevice = vi.fn().mockResolvedValue(undefined);

  // Test helpers

  /** Simulate a participant joining */
  simulateParticipantJoined(participantId: string) {
    this.numParticipants++;
    this.emit(RoomEvent.ParticipantConnected, { identity: participantId });
  }

  /** Simulate a participant leaving */
  simulateParticipantLeft(participantId: string) {
    this.numParticipants = Math.max(0, this.numParticipants - 1);
    this.emit(RoomEvent.ParticipantDisconnected, { identity: participantId });
  }

  /** Simulate unexpected disconnection */
  simulateUnexpectedDisconnect() {
    this.state = ConnectionState.Disconnected;
    this.emit(RoomEvent.Disconnected);
  }

  /** Simulate reconnection attempt */
  simulateReconnecting() {
    this.state = ConnectionState.Reconnecting;
    this.emit(RoomEvent.Reconnecting);
  }

  /** Simulate successful reconnection */
  simulateReconnected() {
    this.state = ConnectionState.Connected;
    this.emit(RoomEvent.Reconnected);
  }
}

// Track the current mock room instance
let currentMockRoom: MockRoom | null = null;

/**
 * Get the current mock room instance.
 */
export function getMockRoom(): MockRoom {
  if (!currentMockRoom) {
    currentMockRoom = new MockRoom();
  }
  return currentMockRoom;
}

/**
 * Reset the mock room instance (call in beforeEach).
 */
export function resetMockRoom() {
  currentMockRoom = new MockRoom();
  return currentMockRoom;
}

// =============================================================================
// LIVEKIT MOCKING SETUP
// =============================================================================

/**
 * Global state for LiveKit track toggles.
 * Can be set before rendering to control initial state.
 */
export interface LiveKitTrackState {
  micEnabled: boolean;
  camEnabled: boolean;
  screenShareEnabled: boolean;
}

const defaultTrackState: LiveKitTrackState = {
  micEnabled: true,
  camEnabled: false,
  screenShareEnabled: false,
};

/**
 * Set the initial LiveKit track state.
 * Call before rendering to control initial toggle states.
 */
export function setLiveKitTrackState(state: Partial<LiveKitTrackState>) {
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__mockLiveKitState = {
      ...defaultTrackState,
      ...state,
    };
  }
}

/**
 * Clear LiveKit track state (call in afterEach).
 */
export function clearLiveKitTrackState() {
  if (typeof window !== 'undefined') {
    delete (window as unknown as Record<string, unknown>).__mockLiveKitState;
  }
}

/**
 * Setup LiveKit mocks at the module level.
 * This should be called BEFORE the describe block.
 *
 * @example
 * ```ts
 * // At the top of your test file:
 * import { setupCallMocks } from './fixtures/callTestHarness';
 * setupCallMocks();
 *
 * describe('My Call Tests', () => { ... });
 * ```
 */
export function setupCallMocks() {
  // Mock livekit-client
  vi.mock('livekit-client', async (importOriginal) => {
    const actual = await importOriginal<typeof import('livekit-client')>();
    return {
      ...actual,
      Room: vi.fn(() => getMockRoom()),
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

  // Mock @livekit/components-react
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
        devices: [
          { deviceId: 'dev-1', label: 'Default Device', groupId: '1' },
          { deviceId: 'dev-2', label: 'Alternate Device', groupId: '1' },
        ],
        activeDeviceId: 'dev-1',
        setActiveMediaDevice: vi.fn(),
      }),

      useTrackToggle: ({ source }: { source: string }) => {
        const globalState =
          ((typeof window !== 'undefined' &&
            (window as unknown as Record<string, unknown>)
              .__mockLiveKitState) as LiveKitTrackState) || defaultTrackState;

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
}

// =============================================================================
// WORKSPACE PROVIDER MOCK
// =============================================================================

/**
 * Setup workspace provider mock.
 * Call this at module level before tests.
 */
export function setupWorkspaceMock(
  options: {
    workspaceType?: 'personal' | 'organization';
    userId?: string;
    isOwner?: boolean;
  } = {}
) {
  const { workspaceType = 'personal', userId = 'test-user-001', isOwner = true } = options;

  vi.mock('@/components/Pages/Providers/WorkspaceProvider', () => ({
    useWorkspace: () => ({
      workspaces: [{ id: workspaceType, name: 'Test Workspace', type: workspaceType }],
      activeWorkspace: { id: workspaceType, name: 'Test Workspace', type: workspaceType },
      activeOrganization:
        workspaceType === 'organization' ? { id: 'org-1', name: 'Test Org' } : null,
      currentUserId: userId,
      isOwner,
      isWorkspaceSwitchable: true,
      switchWorkspace: vi.fn(),
    }),
  }));
}

// =============================================================================
// CALL TEST HARNESS COMPONENT
// =============================================================================

export interface CallTestHarnessProps {
  /** Override assistant actions */
  assistantActionsOverride?: Partial<AssistantActions>;
  /** Override task actions */
  taskActionsOverride?: Partial<TaskActions>;
  /** User metadata */
  userMeta?: { image: string | null | undefined; timezone?: string | null | undefined };
}

/**
 * Test wrapper component for call functionality.
 * Renders the Main component with all necessary mocks.
 */
export function CallTestHarness({
  assistantActionsOverride = {},
  taskActionsOverride = {},
  userMeta = { image: 'test-image.jpg', timezone: 'UTC' },
}: CallTestHarnessProps) {
  const actions = React.useMemo(
    () => ({
      ...mockAssistantActions,
      ...assistantActionsOverride,
    }),
    [assistantActionsOverride]
  );

  const taskActions = React.useMemo(
    () => ({
      ...mockTaskActions,
      ...taskActionsOverride,
    }),
    [taskActionsOverride]
  );

  return <Main taskActions={taskActions} assistantActions={actions} userMeta={userMeta} />;
}

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Get the target assistant for call tests.
 */
export function getTargetAssistant() {
  return mockAssistants[0]; // Jane Doe
}

/**
 * Helper to open an assistant profile panel.
 */
export async function openProfile(
  screen: {
    findByText: (text: string | RegExp) => Promise<HTMLElement>;
  },
  user: { click: (element: HTMLElement) => Promise<void> }
) {
  const targetAssistant = getTargetAssistant();
  const assistantCard = await screen.findByText(
    `${targetAssistant.firstName} ${targetAssistant.surname}`
  );
  await user.click(assistantCard);
}

/**
 * Helper to find call control buttons.
 */
export function getCallControls(screen: {
  queryByRole: (role: string, options?: { name?: string | RegExp }) => HTMLElement | null;
}) {
  return {
    muteButton: screen.queryByRole('button', { name: /mute/i }),
    cameraButton: screen.queryByRole('button', { name: /camera/i }),
    screenShareButton: screen.queryByRole('button', { name: /share screen/i }),
    hangupButton: screen.queryByRole('button', { name: /end call|hang up/i }),
  };
}
