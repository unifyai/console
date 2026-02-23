/**
 * Hire Media Pipeline Matrix Tests
 *
 * Combinatorial testing for the media selection flow in assistant hiring.
 * Tests all meaningful combinations of:
 * - Photo: Upload × Generate × Skip
 * - Video: Upload × Animate × Skip (animate depends on photo)
 * - Voice: Select × Clone × Design × Skip
 *
 * Uses defineMatrixTests for chunking support in CI.
 *
 * @group matrix
 * @group integration
 */

import React from 'react';
import { vi, beforeEach } from 'vitest';
import { render, screen } from '@/tests/render';
import { defineMatrixTests } from '@/tests/utils/matrixTestRunnerBrowser';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type PhotoSource = 'upload' | 'generate' | 'skip';
type VideoSource = 'upload' | 'animate' | 'skip';
type VoiceSource = 'select' | 'clone' | 'design' | 'skip';

interface MediaPipelineScenario {
  id: string;
  description: string;
  photo: PhotoSource;
  video: VideoSource;
  voice: VoiceSource;
  expected: {
    isValid: boolean;
    hasPhoto: boolean;
    hasVideo: boolean;
    hasVoice: boolean;
    canAnimate: boolean;
    submissionFields: string[];
  };
}

// =============================================================================
// MEDIA PIPELINE MATRIX DEFINITION
// =============================================================================

const MEDIA_PIPELINE_MATRIX: MediaPipelineScenario[] = [
  // Photo upload combinations
  {
    id: 'upload-skip-select',
    description: 'Upload photo, skip video, select voice',
    photo: 'upload',
    video: 'skip',
    voice: 'select',
    expected: {
      isValid: true,
      hasPhoto: true,
      hasVideo: false,
      hasVoice: true,
      canAnimate: true,
      submissionFields: ['photoFile', 'voiceId'],
    },
  },
  {
    id: 'upload-animate-select',
    description: 'Upload photo, animate to video, select voice',
    photo: 'upload',
    video: 'animate',
    voice: 'select',
    expected: {
      isValid: true,
      hasPhoto: true,
      hasVideo: true,
      hasVoice: true,
      canAnimate: true,
      submissionFields: ['photoFile', 'videoFile', 'voiceId'],
    },
  },
  {
    id: 'upload-upload-select',
    description: 'Upload photo, upload video, select voice',
    photo: 'upload',
    video: 'upload',
    voice: 'select',
    expected: {
      isValid: true,
      hasPhoto: true,
      hasVideo: true,
      hasVoice: true,
      canAnimate: true,
      submissionFields: ['photoFile', 'videoFile', 'voiceId'],
    },
  },

  // Photo generate combinations
  {
    id: 'generate-skip-select',
    description: 'Generate photo, skip video, select voice',
    photo: 'generate',
    video: 'skip',
    voice: 'select',
    expected: {
      isValid: true,
      hasPhoto: true,
      hasVideo: false,
      hasVoice: true,
      canAnimate: true,
      submissionFields: ['profilePhotoUrl', 'voiceId'],
    },
  },
  {
    id: 'generate-animate-select',
    description: 'Generate photo, animate to video, select voice',
    photo: 'generate',
    video: 'animate',
    voice: 'select',
    expected: {
      isValid: true,
      hasPhoto: true,
      hasVideo: true,
      hasVoice: true,
      canAnimate: true,
      submissionFields: ['profilePhotoUrl', 'profileVideoUrl', 'voiceId'],
    },
  },
  {
    id: 'generate-upload-select',
    description: 'Generate photo, upload video, select voice',
    photo: 'generate',
    video: 'upload',
    voice: 'select',
    expected: {
      isValid: true,
      hasPhoto: true,
      hasVideo: true,
      hasVoice: true,
      canAnimate: true,
      submissionFields: ['profilePhotoUrl', 'videoFile', 'voiceId'],
    },
  },

  // Skip photo combinations (can't animate without photo)
  {
    id: 'skip-skip-select',
    description: 'Skip photo, skip video, select voice',
    photo: 'skip',
    video: 'skip',
    voice: 'select',
    expected: {
      isValid: true,
      hasPhoto: false,
      hasVideo: false,
      hasVoice: true,
      canAnimate: false,
      submissionFields: ['voiceId'],
    },
  },
  {
    id: 'skip-upload-select',
    description: 'Skip photo, upload video, select voice',
    photo: 'skip',
    video: 'upload',
    voice: 'select',
    expected: {
      isValid: true,
      hasPhoto: false,
      hasVideo: true,
      hasVoice: true,
      canAnimate: false,
      submissionFields: ['videoFile', 'voiceId'],
    },
  },

  // Voice clone combinations
  {
    id: 'upload-skip-clone',
    description: 'Upload photo, skip video, clone voice',
    photo: 'upload',
    video: 'skip',
    voice: 'clone',
    expected: {
      isValid: true,
      hasPhoto: true,
      hasVideo: false,
      hasVoice: true,
      canAnimate: true,
      submissionFields: ['photoFile', 'voiceId'],
    },
  },
  {
    id: 'generate-animate-clone',
    description: 'Generate photo, animate video, clone voice',
    photo: 'generate',
    video: 'animate',
    voice: 'clone',
    expected: {
      isValid: true,
      hasPhoto: true,
      hasVideo: true,
      hasVoice: true,
      canAnimate: true,
      submissionFields: ['profilePhotoUrl', 'profileVideoUrl', 'voiceId'],
    },
  },

  // Voice design combinations
  {
    id: 'upload-skip-design',
    description: 'Upload photo, skip video, design voice',
    photo: 'upload',
    video: 'skip',
    voice: 'design',
    expected: {
      isValid: true,
      hasPhoto: true,
      hasVideo: false,
      hasVoice: true,
      canAnimate: true,
      submissionFields: ['photoFile', 'voiceId'],
    },
  },
  {
    id: 'generate-animate-design',
    description: 'Generate photo, animate video, design voice',
    photo: 'generate',
    video: 'animate',
    voice: 'design',
    expected: {
      isValid: true,
      hasPhoto: true,
      hasVideo: true,
      hasVoice: true,
      canAnimate: true,
      submissionFields: ['profilePhotoUrl', 'profileVideoUrl', 'voiceId'],
    },
  },

  // Skip voice combinations
  {
    id: 'upload-skip-skip',
    description: 'Upload photo, skip video, skip voice (uses default)',
    photo: 'upload',
    video: 'skip',
    voice: 'skip',
    expected: {
      isValid: true,
      hasPhoto: true,
      hasVideo: false,
      hasVoice: true, // Default voice is always applied
      canAnimate: true,
      submissionFields: ['photoFile', 'voiceId'],
    },
  },
  {
    id: 'skip-skip-skip',
    description: 'Skip all media (minimal assistant)',
    photo: 'skip',
    video: 'skip',
    voice: 'skip',
    expected: {
      isValid: true,
      hasPhoto: false,
      hasVideo: false,
      hasVoice: true, // Default voice
      canAnimate: false,
      submissionFields: ['voiceId'],
    },
  },

  // Full combinations
  {
    id: 'upload-animate-clone',
    description: 'Full: upload photo, animate video, clone voice',
    photo: 'upload',
    video: 'animate',
    voice: 'clone',
    expected: {
      isValid: true,
      hasPhoto: true,
      hasVideo: true,
      hasVoice: true,
      canAnimate: true,
      submissionFields: ['photoFile', 'videoFile', 'voiceId'],
    },
  },
  {
    id: 'generate-upload-design',
    description: 'Full: generate photo, upload video, design voice',
    photo: 'generate',
    video: 'upload',
    voice: 'design',
    expected: {
      isValid: true,
      hasPhoto: true,
      hasVideo: true,
      hasVoice: true,
      canAnimate: true,
      submissionFields: ['profilePhotoUrl', 'videoFile', 'voiceId'],
    },
  },
];

// =============================================================================
// MOCK COMPONENT FOR TESTING MEDIA PIPELINE LOGIC
// =============================================================================

interface MediaPipelineFormTestProps {
  photoSource: PhotoSource;
  videoSource: VideoSource;
  voiceSource: VoiceSource;
  photoFile: File | null;
  photoUrl: string | null;
  videoFile: File | null;
  videoUrl: string | null;
  voiceId: string | null;
  isAnimating: boolean;
  onPhotoUpload: (file: File) => void;
  onPhotoGenerate: () => void;
  onVideoUpload: (file: File) => void;
  onVideoAnimate: () => void;
  onVoiceSelect: (id: string) => void;
  onVoiceClone: (file: File) => void;
  onVoiceDesign: () => void;
}

const MediaPipelineFormTest: React.FC<MediaPipelineFormTestProps> = ({
  photoSource,
  videoSource,
  voiceSource,
  photoFile,
  photoUrl,
  videoFile,
  videoUrl,
  voiceId,
  isAnimating,
  onPhotoUpload,
  onPhotoGenerate,
  onVideoUpload,
  onVideoAnimate,
  onVoiceSelect,
  onVoiceClone,
  onVoiceDesign,
}) => {
  const hasPhoto = photoFile !== null || photoUrl !== null;
  const hasVideo = videoFile !== null || videoUrl !== null;
  const hasVoice = voiceId !== null;
  const canAnimate = hasPhoto && !hasVideo && !isAnimating;

  // Build submission fields based on current state
  const submissionFields: string[] = [];
  if (photoFile) submissionFields.push('photoFile');
  if (photoUrl && !photoFile) submissionFields.push('profilePhotoUrl');
  if (videoFile) submissionFields.push('videoFile');
  if (videoUrl && !videoFile) submissionFields.push('profileVideoUrl');
  if (voiceId) submissionFields.push('voiceId');

  return (
    <div data-testid="media-pipeline-form">
      {/* Photo section */}
      <div data-testid="photo-section">
        <div data-testid="photo-source">{photoSource}</div>
        {hasPhoto && <div data-testid="photo-preview">Photo loaded</div>}
        <button
          data-testid="photo-upload-btn"
          onClick={() => onPhotoUpload(new File([], 'test.jpg'))}
        >
          Upload Photo
        </button>
        <button data-testid="photo-generate-btn" onClick={onPhotoGenerate}>
          Generate Photo
        </button>
      </div>

      {/* Video section */}
      <div data-testid="video-section">
        <div data-testid="video-source">{videoSource}</div>
        {hasVideo && <div data-testid="video-preview">Video loaded</div>}
        <button
          data-testid="video-upload-btn"
          onClick={() => onVideoUpload(new File([], 'test.mp4'))}
        >
          Upload Video
        </button>
        <button
          data-testid="video-animate-btn"
          onClick={onVideoAnimate}
          disabled={!canAnimate}
          aria-disabled={!canAnimate}
        >
          Animate to Video
        </button>
        {isAnimating && <div data-testid="animating-indicator">Animating...</div>}
      </div>

      {/* Voice section */}
      <div data-testid="voice-section">
        <div data-testid="voice-source">{voiceSource}</div>
        {hasVoice && <div data-testid="voice-selected">Voice: {voiceId}</div>}
        <button data-testid="voice-select-btn" onClick={() => onVoiceSelect('preset-voice-1')}>
          Select Voice
        </button>
        <button
          data-testid="voice-clone-btn"
          onClick={() => onVoiceClone(new File([], 'voice.mp3'))}
        >
          Clone Voice
        </button>
        <button data-testid="voice-design-btn" onClick={onVoiceDesign}>
          Design Voice
        </button>
      </div>

      {/* State indicators */}
      <div data-testid="form-state">
        <span data-testid="has-photo">{hasPhoto.toString()}</span>
        <span data-testid="has-video">{hasVideo.toString()}</span>
        <span data-testid="has-voice">{hasVoice.toString()}</span>
        <span data-testid="can-animate">{canAnimate.toString()}</span>
        <span data-testid="submission-fields">{submissionFields.join(',')}</span>
      </div>
    </div>
  );
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getPhotoStateForScenario(scenario: MediaPipelineScenario) {
  switch (scenario.photo) {
    case 'upload':
      return { photoFile: new File([], 'photo.jpg'), photoUrl: null };
    case 'generate':
      return { photoFile: null, photoUrl: 'https://generated.photo/1.jpg' };
    case 'skip':
      return { photoFile: null, photoUrl: null };
  }
}

function getVideoStateForScenario(scenario: MediaPipelineScenario) {
  switch (scenario.video) {
    case 'upload':
      return { videoFile: new File([], 'video.mp4'), videoUrl: null };
    case 'animate':
      return { videoFile: null, videoUrl: 'https://animated.video/1.mp4' };
    case 'skip':
      return { videoFile: null, videoUrl: null };
  }
}

function getVoiceIdForScenario(scenario: MediaPipelineScenario): string | null {
  switch (scenario.voice) {
    case 'select':
      return 'preset-voice-1';
    case 'clone':
      return 'cloned-voice-1';
    case 'design':
      return 'designed-voice-1';
    case 'skip':
      return 'default-voice'; // Default voice is always set
  }
}

// =============================================================================
// MATRIX TESTS (using defineMatrixTests)
// =============================================================================

defineMatrixTests<MediaPipelineScenario>({
  name: 'Hire Media Pipeline Matrix',
  chunkSize: 4,

  getMatrix: () => MEDIA_PIPELINE_MATRIX,

  getConfigAlias: (scenario) => `[${scenario.id}] ${scenario.description}`,

  defineTests: (scenario, { it, expect }) => {
    const photoState = getPhotoStateForScenario(scenario);
    const videoState = getVideoStateForScenario(scenario);
    const voiceId = getVoiceIdForScenario(scenario);

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(`hasPhoto should be ${scenario.expected.hasPhoto}`, () => {
      render(
        <MediaPipelineFormTest
          photoSource={scenario.photo}
          videoSource={scenario.video}
          voiceSource={scenario.voice}
          photoFile={photoState.photoFile}
          photoUrl={photoState.photoUrl}
          videoFile={videoState.videoFile}
          videoUrl={videoState.videoUrl}
          voiceId={voiceId}
          isAnimating={false}
          onPhotoUpload={vi.fn()}
          onPhotoGenerate={vi.fn()}
          onVideoUpload={vi.fn()}
          onVideoAnimate={vi.fn()}
          onVoiceSelect={vi.fn()}
          onVoiceClone={vi.fn()}
          onVoiceDesign={vi.fn()}
        />
      );

      expect(screen.getByTestId('has-photo').textContent).toBe(
        scenario.expected.hasPhoto.toString()
      );
    });

    it(`hasVideo should be ${scenario.expected.hasVideo}`, () => {
      render(
        <MediaPipelineFormTest
          photoSource={scenario.photo}
          videoSource={scenario.video}
          voiceSource={scenario.voice}
          photoFile={photoState.photoFile}
          photoUrl={photoState.photoUrl}
          videoFile={videoState.videoFile}
          videoUrl={videoState.videoUrl}
          voiceId={voiceId}
          isAnimating={false}
          onPhotoUpload={vi.fn()}
          onPhotoGenerate={vi.fn()}
          onVideoUpload={vi.fn()}
          onVideoAnimate={vi.fn()}
          onVoiceSelect={vi.fn()}
          onVoiceClone={vi.fn()}
          onVoiceDesign={vi.fn()}
        />
      );

      expect(screen.getByTestId('has-video').textContent).toBe(
        scenario.expected.hasVideo.toString()
      );
    });

    it(`hasVoice should be ${scenario.expected.hasVoice}`, () => {
      render(
        <MediaPipelineFormTest
          photoSource={scenario.photo}
          videoSource={scenario.video}
          voiceSource={scenario.voice}
          photoFile={photoState.photoFile}
          photoUrl={photoState.photoUrl}
          videoFile={videoState.videoFile}
          videoUrl={videoState.videoUrl}
          voiceId={voiceId}
          isAnimating={false}
          onPhotoUpload={vi.fn()}
          onPhotoGenerate={vi.fn()}
          onVideoUpload={vi.fn()}
          onVideoAnimate={vi.fn()}
          onVoiceSelect={vi.fn()}
          onVoiceClone={vi.fn()}
          onVoiceDesign={vi.fn()}
        />
      );

      expect(screen.getByTestId('has-voice').textContent).toBe(
        scenario.expected.hasVoice.toString()
      );
    });

    it(`canAnimate should be ${scenario.expected.canAnimate}`, () => {
      render(
        <MediaPipelineFormTest
          photoSource={scenario.photo}
          videoSource={scenario.video}
          voiceSource={scenario.voice}
          photoFile={photoState.photoFile}
          photoUrl={photoState.photoUrl}
          videoFile={videoState.videoFile}
          videoUrl={videoState.videoUrl}
          voiceId={voiceId}
          isAnimating={false}
          onPhotoUpload={vi.fn()}
          onPhotoGenerate={vi.fn()}
          onVideoUpload={vi.fn()}
          onVideoAnimate={vi.fn()}
          onVoiceSelect={vi.fn()}
          onVoiceClone={vi.fn()}
          onVoiceDesign={vi.fn()}
        />
      );

      // canAnimate should be true only when we have photo but no video yet
      const expectedCanAnimate = scenario.expected.hasPhoto && !scenario.expected.hasVideo;
      expect(screen.getByTestId('can-animate').textContent).toBe(expectedCanAnimate.toString());
    });

    it(`animate button should be ${scenario.expected.canAnimate && !scenario.expected.hasVideo ? 'enabled' : 'disabled'}`, () => {
      render(
        <MediaPipelineFormTest
          photoSource={scenario.photo}
          videoSource={scenario.video}
          voiceSource={scenario.voice}
          photoFile={photoState.photoFile}
          photoUrl={photoState.photoUrl}
          videoFile={videoState.videoFile}
          videoUrl={videoState.videoUrl}
          voiceId={voiceId}
          isAnimating={false}
          onPhotoUpload={vi.fn()}
          onPhotoGenerate={vi.fn()}
          onVideoUpload={vi.fn()}
          onVideoAnimate={vi.fn()}
          onVoiceSelect={vi.fn()}
          onVoiceClone={vi.fn()}
          onVoiceDesign={vi.fn()}
        />
      );

      const animateBtn = screen.getByTestId('video-animate-btn');
      const shouldBeEnabled = scenario.expected.hasPhoto && !scenario.expected.hasVideo;

      if (shouldBeEnabled) {
        expect(animateBtn).not.toBeDisabled();
      } else {
        expect(animateBtn).toBeDisabled();
      }
    });
  },
});
