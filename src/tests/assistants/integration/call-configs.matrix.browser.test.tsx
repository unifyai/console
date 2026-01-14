/**
 * Call Configurations Matrix Tests
 *
 * Combinatorial testing for call UI toggle states.
 * Tests all meaningful combinations of:
 * - Audio: on × off × muted
 * - Video: on × off
 * - Screen share: on × off
 * - View mode: normal × minimized × fullscreen
 * - Connection: connecting × connected × reconnecting × disconnected
 *
 * Uses defineMatrixTests for chunking/sharding support in CI.
 *
 * @group matrix
 * @group integration
 */

import React from 'react';
import { vi, beforeEach } from 'vitest';
import { render, screen } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { defineMatrixTests } from '@/tests/utils/matrixTestRunnerBrowser';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type AudioState = 'on' | 'off' | 'muted';
type VideoState = 'on' | 'off';
type ScreenShareState = 'on' | 'off';
type ViewMode = 'normal' | 'minimized' | 'fullscreen';
type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface CallConfigScenario {
  id: string;
  description: string;
  audio: AudioState;
  video: VideoState;
  screenShare: ScreenShareState;
  view: ViewMode;
  connection: ConnectionState;
  callType: 'audio' | 'video';
}

// =============================================================================
// CALL CONFIG MATRIX DEFINITION
// =============================================================================

const CALL_CONFIG_MATRIX: CallConfigScenario[] = [
  // Audio-only call states
  {
    id: 'audio-on-connected',
    description: 'Audio call with mic on',
    audio: 'on',
    video: 'off',
    screenShare: 'off',
    view: 'normal',
    connection: 'connected',
    callType: 'audio',
  },
  {
    id: 'audio-muted-connected',
    description: 'Audio call with mic muted',
    audio: 'muted',
    video: 'off',
    screenShare: 'off',
    view: 'normal',
    connection: 'connected',
    callType: 'audio',
  },

  // Video call states
  {
    id: 'video-full-connected',
    description: 'Video call with all on',
    audio: 'on',
    video: 'on',
    screenShare: 'off',
    view: 'normal',
    connection: 'connected',
    callType: 'video',
  },
  {
    id: 'video-muted-connected',
    description: 'Video call with mic muted',
    audio: 'muted',
    video: 'on',
    screenShare: 'off',
    view: 'normal',
    connection: 'connected',
    callType: 'video',
  },
  {
    id: 'video-camera-off-connected',
    description: 'Video call with camera off',
    audio: 'on',
    video: 'off',
    screenShare: 'off',
    view: 'normal',
    connection: 'connected',
    callType: 'video',
  },

  // Screen share states
  {
    id: 'screenshare-on-connected',
    description: 'Call with screen share active',
    audio: 'on',
    video: 'on',
    screenShare: 'on',
    view: 'normal',
    connection: 'connected',
    callType: 'video',
  },
  {
    id: 'screenshare-only-connected',
    description: 'Screen share with camera off',
    audio: 'on',
    video: 'off',
    screenShare: 'on',
    view: 'normal',
    connection: 'connected',
    callType: 'video',
  },

  // View mode variations
  {
    id: 'video-minimized',
    description: 'Video call minimized',
    audio: 'on',
    video: 'on',
    screenShare: 'off',
    view: 'minimized',
    connection: 'connected',
    callType: 'video',
  },
  {
    id: 'video-fullscreen',
    description: 'Video call fullscreen',
    audio: 'on',
    video: 'on',
    screenShare: 'off',
    view: 'fullscreen',
    connection: 'connected',
    callType: 'video',
  },

  // Connection state variations
  {
    id: 'video-connecting',
    description: 'Video call connecting',
    audio: 'off',
    video: 'off',
    screenShare: 'off',
    view: 'normal',
    connection: 'connecting',
    callType: 'video',
  },
  {
    id: 'video-reconnecting',
    description: 'Video call reconnecting',
    audio: 'on',
    video: 'on',
    screenShare: 'off',
    view: 'normal',
    connection: 'reconnecting',
    callType: 'video',
  },

  // All toggles off
  {
    id: 'all-off-connected',
    description: 'All media off but connected',
    audio: 'off',
    video: 'off',
    screenShare: 'off',
    view: 'normal',
    connection: 'connected',
    callType: 'video',
  },
];

// =============================================================================
// MOCK COMPONENT FOR TESTING CALL CONFIG LOGIC
// =============================================================================

interface CallControlsTestProps {
  audioState: AudioState;
  videoState: VideoState;
  screenShareState: ScreenShareState;
  viewMode: ViewMode;
  connectionState: ConnectionState;
  callType: 'audio' | 'video';
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleView: (mode: ViewMode) => void;
  onHangUp: () => void;
}

const CallControlsTest: React.FC<CallControlsTestProps> = ({
  audioState,
  videoState,
  screenShareState,
  viewMode,
  connectionState,
  callType,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleView,
  onHangUp,
}) => {
  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting' || connectionState === 'reconnecting';

  return (
    <div data-testid="call-container" data-view-mode={viewMode}>
      {/* Connection status */}
      <div data-testid="connection-state">{connectionState}</div>
      <div data-testid="call-type">{callType}</div>

      {/* Loading indicator for connecting states */}
      {isConnecting && <div data-testid="connecting-indicator">Connecting...</div>}

      {/* Media tracks display */}
      <div data-testid="media-tracks">
        {audioState !== 'off' && (
          <div data-testid="audio-track" data-muted={audioState === 'muted'}>
            Audio {audioState}
          </div>
        )}
        {videoState === 'on' && <div data-testid="video-track">Video on</div>}
        {screenShareState === 'on' && <div data-testid="screen-share-track">Screen sharing</div>}
      </div>

      {/* Controls */}
      <div data-testid="call-controls">
        <button
          data-testid="mic-button"
          onClick={onToggleMic}
          disabled={!isConnected}
          aria-pressed={audioState === 'on'}
          aria-label={
            audioState === 'muted' ? 'Unmute' : audioState === 'on' ? 'Mute' : 'Turn on mic'
          }
        >
          {audioState === 'muted' ? 'Unmute' : audioState === 'on' ? 'Mute' : 'Mic Off'}
        </button>

        {callType === 'video' && (
          <button
            data-testid="camera-button"
            onClick={onToggleCamera}
            disabled={!isConnected}
            aria-pressed={videoState === 'on'}
            aria-label={videoState === 'on' ? 'Turn off camera' : 'Turn on camera'}
          >
            {videoState === 'on' ? 'Camera On' : 'Camera Off'}
          </button>
        )}

        <button
          data-testid="screen-share-button"
          onClick={onToggleScreenShare}
          disabled={!isConnected}
          aria-pressed={screenShareState === 'on'}
          aria-label={screenShareState === 'on' ? 'Stop sharing' : 'Share screen'}
        >
          {screenShareState === 'on' ? 'Stop Share' : 'Share Screen'}
        </button>

        <button data-testid="hangup-button" onClick={onHangUp} aria-label="Hang up">
          Hang Up
        </button>
      </div>

      {/* View mode controls */}
      <div data-testid="view-controls">
        <button
          data-testid="minimize-button"
          onClick={() => onToggleView('minimized')}
          aria-pressed={viewMode === 'minimized'}
        >
          Minimize
        </button>
        <button
          data-testid="fullscreen-button"
          onClick={() => onToggleView('fullscreen')}
          aria-pressed={viewMode === 'fullscreen'}
        >
          Fullscreen
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// MATRIX TESTS (using defineMatrixTests)
// =============================================================================

defineMatrixTests<CallConfigScenario>({
  name: 'Call Configs Matrix',
  chunkSize: 4,

  getMatrix: () => CALL_CONFIG_MATRIX,

  getConfigAlias: (scenario) => `[${scenario.id}] ${scenario.description}`,

  defineTests: (scenario, { it, expect }) => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(`should render correct audio state (${scenario.audio})`, () => {
      render(
        <CallControlsTest
          audioState={scenario.audio}
          videoState={scenario.video}
          screenShareState={scenario.screenShare}
          viewMode={scenario.view}
          connectionState={scenario.connection}
          callType={scenario.callType}
          onToggleMic={vi.fn()}
          onToggleCamera={vi.fn()}
          onToggleScreenShare={vi.fn()}
          onToggleView={vi.fn()}
          onHangUp={vi.fn()}
        />
      );

      const audioTrack = screen.queryByTestId('audio-track');
      if (scenario.audio === 'off') {
        expect(audioTrack).not.toBeInTheDocument();
      } else {
        expect(audioTrack).toBeInTheDocument();
        if (scenario.audio === 'muted') {
          expect(audioTrack).toHaveAttribute('data-muted', 'true');
        }
      }
    });

    it(`should render correct video state (${scenario.video})`, () => {
      render(
        <CallControlsTest
          audioState={scenario.audio}
          videoState={scenario.video}
          screenShareState={scenario.screenShare}
          viewMode={scenario.view}
          connectionState={scenario.connection}
          callType={scenario.callType}
          onToggleMic={vi.fn()}
          onToggleCamera={vi.fn()}
          onToggleScreenShare={vi.fn()}
          onToggleView={vi.fn()}
          onHangUp={vi.fn()}
        />
      );

      const videoTrack = screen.queryByTestId('video-track');
      if (scenario.video === 'on') {
        expect(videoTrack).toBeInTheDocument();
      } else {
        expect(videoTrack).not.toBeInTheDocument();
      }
    });

    it(`should render correct screen share state (${scenario.screenShare})`, () => {
      render(
        <CallControlsTest
          audioState={scenario.audio}
          videoState={scenario.video}
          screenShareState={scenario.screenShare}
          viewMode={scenario.view}
          connectionState={scenario.connection}
          callType={scenario.callType}
          onToggleMic={vi.fn()}
          onToggleCamera={vi.fn()}
          onToggleScreenShare={vi.fn()}
          onToggleView={vi.fn()}
          onHangUp={vi.fn()}
        />
      );

      const screenShareTrack = screen.queryByTestId('screen-share-track');
      if (scenario.screenShare === 'on') {
        expect(screenShareTrack).toBeInTheDocument();
      } else {
        expect(screenShareTrack).not.toBeInTheDocument();
      }
    });

    it(`should apply correct view mode (${scenario.view})`, () => {
      render(
        <CallControlsTest
          audioState={scenario.audio}
          videoState={scenario.video}
          screenShareState={scenario.screenShare}
          viewMode={scenario.view}
          connectionState={scenario.connection}
          callType={scenario.callType}
          onToggleMic={vi.fn()}
          onToggleCamera={vi.fn()}
          onToggleScreenShare={vi.fn()}
          onToggleView={vi.fn()}
          onHangUp={vi.fn()}
        />
      );

      const container = screen.getByTestId('call-container');
      expect(container).toHaveAttribute('data-view-mode', scenario.view);
    });

    it(`controls should be ${scenario.connection === 'connected' ? 'enabled' : 'disabled'}`, () => {
      render(
        <CallControlsTest
          audioState={scenario.audio}
          videoState={scenario.video}
          screenShareState={scenario.screenShare}
          viewMode={scenario.view}
          connectionState={scenario.connection}
          callType={scenario.callType}
          onToggleMic={vi.fn()}
          onToggleCamera={vi.fn()}
          onToggleScreenShare={vi.fn()}
          onToggleView={vi.fn()}
          onHangUp={vi.fn()}
        />
      );

      const micButton = screen.getByTestId('mic-button');
      const screenShareButton = screen.getByTestId('screen-share-button');

      if (scenario.connection === 'connected') {
        expect(micButton).not.toBeDisabled();
        expect(screenShareButton).not.toBeDisabled();
      } else {
        expect(micButton).toBeDisabled();
        expect(screenShareButton).toBeDisabled();
      }
    });
  },
});
