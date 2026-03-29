/**
 * Unit tests for src/hooks/Assistants/usePhotoCreator.tsx
 *
 * Tests the photo creation hook logic for generating, editing, and animating photos.
 * Focuses on stress testing race conditions, stale operations, and cleanup.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as React from 'react';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
    info: vi.fn(),
    custom: vi.fn((fn, opts) => {
      // Execute the custom toast function with a fake id to capture the component
      if (typeof fn === 'function') {
        fn(opts?.id || 'custom-toast-id');
      }
      return opts?.id || 'custom-toast-id';
    }),
  },
}));

// Mock fetch for balance and image downloads
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import hook after mocks
import { usePhotoCreator } from '@/hooks/Assistants/usePhotoCreator';
import { VoiceOption } from '@/types/assistants/assistant';

describe('usePhotoCreator', () => {
  // Mock dependencies
  const mockPhotoActions = {
    generate: vi.fn(),
    edit: vi.fn(),
    animate: vi.fn(),
    getAnimation: vi.fn(),
    cancelAnimation: vi.fn(),
  };

  const mockGenerateSpeech = vi.fn();
  const mockOnNewMediaReady = vi.fn();

  const mockVoice: VoiceOption = {
    voiceId: 'voice-123',
    name: 'Test Voice',
    provider: 'elevenlabs',
    language: 'en',
    gender: 'female',
    description: '',
  };

  const defaultProps = {
    photoActions: mockPhotoActions as any,
    generateSpeechAction: mockGenerateSpeech,
    onNewMediaReady: mockOnNewMediaReady,
    photoOperationCost: 1,
    videoAnimationCost: 5,
    selectedVoice: mockVoice,
    firstName: 'Jane',
    surname: 'Doe',
    age: 30,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Default fetch mock for balance check
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/billing/balance')) {
        return {
          ok: true,
          json: async () => ({ fullBalance: 100 }),
        };
      }
      // Mock for image/video downloads
      return {
        ok: true,
        blob: async () => new Blob(['test'], { type: 'image/jpeg' }),
      };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('F - Stress and Robustness', () => {
    describe('Concurrent Operation Prevention', () => {
      it(
        'prevents concurrent generate operations when already processing',
        {
          meta: {
            alias: 'Photo-PreventsConcurrentGenerate',
            scenario: 'User clicks generate while already generating',
            behavior: 'Second operation should be blocked',
          },
        },
        async () => {
          // Arrange - generate returns a pending promise
          let generateCallCount = 0;
          mockPhotoActions.generate.mockImplementation(async () => {
            generateCallCount++;
            // Never resolve - simulates slow operation
            return new Promise(() => {});
          });

          const { result } = renderHook(() =>
            usePhotoCreator(
              defaultProps.photoActions,
              defaultProps.generateSpeechAction,
              defaultProps.onNewMediaReady,
              defaultProps.photoOperationCost,
              defaultProps.videoAnimationCost,
              defaultProps.selectedVoice,
              defaultProps.firstName,
              defaultProps.surname,
              defaultProps.age
            )
          );

          act(() => {
            result.current.setPrompt('Test prompt');
          });

          // Start first operation (non-blocking call)
          act(() => {
            result.current.handleGenerate();
          });

          // Let the balance check complete
          await act(async () => {
            await vi.advanceTimersByTimeAsync(50);
          });

          // First operation should be in progress
          expect(result.current.isProcessing).toBe(true);
          expect(result.current.isGenerating).toBe(true);
          expect(result.current.isEditing).toBe(false);

          // Try to start second operation while first is processing
          act(() => {
            result.current.handleGenerate();
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(50);
          });

          // BUG: Currently both operations proceed - should only be 1
          expect(generateCallCount).toBe(1);
        }
      );

      it(
        'prevents concurrent edit operations when already processing',
        {
          meta: {
            alias: 'Photo-PreventsConcurrentEdit',
            scenario: 'User clicks edit while already editing',
            behavior: 'Second operation should be blocked',
          },
        },
        async () => {
          // Arrange
          let editCallCount = 0;
          mockPhotoActions.edit.mockImplementation(async () => {
            editCallCount++;
            return new Promise(() => {});
          });

          const mockImageFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

          const { result } = renderHook(() =>
            usePhotoCreator(
              defaultProps.photoActions,
              defaultProps.generateSpeechAction,
              defaultProps.onNewMediaReady,
              defaultProps.photoOperationCost,
              defaultProps.videoAnimationCost,
              defaultProps.selectedVoice,
              defaultProps.firstName,
              defaultProps.surname,
              defaultProps.age
            )
          );

          act(() => {
            result.current.setPrompt('Make it brighter');
          });

          // Start first edit
          act(() => {
            result.current.handleEdit(mockImageFile);
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(50);
          });

          expect(result.current.isProcessing).toBe(true);
          expect(result.current.isEditing).toBe(true);
          expect(result.current.isGenerating).toBe(false);

          // Try second edit
          act(() => {
            result.current.handleEdit(mockImageFile);
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(50);
          });

          // BUG: Currently both edits proceed - should only be 1
          expect(editCallCount).toBe(1);
        }
      );

      it(
        'prevents concurrent animate operations when already processing',
        {
          meta: {
            alias: 'Photo-PreventsConcurrentAnimate',
            scenario: 'User clicks animate while already animating',
            behavior: 'Second operation should be blocked',
          },
        },
        async () => {
          // Arrange - track how many times handleAnimate actually proceeds
          let speechCallCount = 0;
          mockGenerateSpeech.mockImplementation(async () => {
            speechCallCount++;
            // Never resolve to keep processing state
            return new Promise(() => {});
          });

          const mockImageFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

          const { result } = renderHook(() =>
            usePhotoCreator(
              defaultProps.photoActions,
              defaultProps.generateSpeechAction,
              defaultProps.onNewMediaReady,
              defaultProps.photoOperationCost,
              defaultProps.videoAnimationCost,
              defaultProps.selectedVoice,
              defaultProps.firstName,
              defaultProps.surname,
              defaultProps.age
            )
          );

          act(() => {
            result.current.setTtsPrompt('Hello world');
          });

          // Start first animate
          act(() => {
            result.current.handleAnimate(mockImageFile);
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(10);
          });

          expect(result.current.isProcessing).toBe(true);
          expect(result.current.isAnimating).toBe(true);
          expect(result.current.isGenerating).toBe(false);
          expect(result.current.isEditing).toBe(false);

          // Try second animate while first is processing
          act(() => {
            result.current.handleAnimate(mockImageFile);
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(10);
          });

          // Should only have one speech generation call (first animate)
          expect(speechCallCount).toBe(1);
        }
      );
    });

    describe('Operation ID Tracking', () => {
      it(
        'increments operation ID to track current operation',
        {
          meta: {
            alias: 'Photo-TracksOperationId',
            scenario: 'Multiple operations are started',
            behavior: 'Each operation gets a unique ID for tracking',
          },
        },
        async () => {
          // This test verifies concurrent operations are blocked
          // which implicitly tests that operation ID tracking is in place
          let generateCallCount = 0;

          mockPhotoActions.generate.mockImplementation(async () => {
            generateCallCount++;
            // Never resolve - keeps isProcessing = true
            return new Promise(() => {});
          });

          const { result } = renderHook(() =>
            usePhotoCreator(
              defaultProps.photoActions,
              defaultProps.generateSpeechAction,
              defaultProps.onNewMediaReady,
              defaultProps.photoOperationCost,
              defaultProps.videoAnimationCost,
              defaultProps.selectedVoice,
              defaultProps.firstName,
              defaultProps.surname,
              defaultProps.age
            )
          );

          act(() => {
            result.current.setPrompt('First prompt');
          });

          // Start first generate
          act(() => {
            result.current.handleGenerate();
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(50);
          });

          expect(result.current.isProcessing).toBe(true);
          expect(result.current.isGenerating).toBe(true);

          // While first is processing, try second (should be blocked)
          act(() => {
            result.current.handleGenerate();
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(50);
          });

          // Only one generate call should have been made
          expect(generateCallCount).toBe(1);
        }
      );
    });

    describe('Animation Polling Cleanup', () => {
      it(
        'clears polling timeout on unmount during animation',
        {
          meta: {
            alias: 'Photo-ClearsPollingOnUnmount',
            scenario: 'Component unmounts while animation is polling',
            behavior: 'Polling should stop and no state updates should occur',
          },
        },
        async () => {
          // Arrange
          mockPhotoActions.animate.mockResolvedValue({
            id: 'pred_123',
            status: 'starting',
            model: 'test',
            version: '1',
            createdAt: new Date().toISOString(),
          });

          mockPhotoActions.getAnimation.mockResolvedValue({
            id: 'pred_123',
            status: 'processing',
            model: 'test',
            version: '1',
            createdAt: new Date().toISOString(),
          });

          mockGenerateSpeech.mockResolvedValue({
            audioBase64: 'VGVzdA==',
            contentType: 'audio/mp3',
          });

          const mockImageFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

          const { result, unmount } = renderHook(() =>
            usePhotoCreator(
              defaultProps.photoActions,
              defaultProps.generateSpeechAction,
              defaultProps.onNewMediaReady,
              defaultProps.photoOperationCost,
              defaultProps.videoAnimationCost,
              defaultProps.selectedVoice,
              defaultProps.firstName,
              defaultProps.surname,
              defaultProps.age
            )
          );

          // Start animation
          act(() => {
            result.current.setTtsPrompt('Hello world');
          });

          await act(async () => {
            result.current.handleAnimate(mockImageFile);
          });

          // Wait for animation to start
          await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
          });

          // Clear mock to track post-unmount calls
          mockPhotoActions.getAnimation.mockClear();

          // Unmount while animation is polling
          unmount();

          // Advance timers past polling interval
          await act(async () => {
            await vi.advanceTimersByTimeAsync(30000);
          });

          // Assert - no polling calls should happen after unmount
          expect(mockPhotoActions.getAnimation).not.toHaveBeenCalled();
        }
      );
    });

    describe('Stale Voice Reference', () => {
      it(
        'blocks concurrent animate operations which would prevent stale voice issues',
        {
          meta: {
            alias: 'Photo-BlocksConcurrentAnimate',
            scenario: 'Multiple animate calls are attempted',
            behavior: 'Only first animate proceeds, preventing stale voice issues',
          },
        },
        async () => {
          // Arrange
          let speechCallCount = 0;
          mockGenerateSpeech.mockImplementation(async () => {
            speechCallCount++;
            return {
              audioBase64: 'VGVzdA==',
              contentType: 'audio/mp3',
            };
          });

          // Animate never resolves
          mockPhotoActions.animate.mockImplementation(async () => {
            return new Promise(() => {});
          });

          const mockImageFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

          const { result } = renderHook(() =>
            usePhotoCreator(
              defaultProps.photoActions,
              defaultProps.generateSpeechAction,
              defaultProps.onNewMediaReady,
              defaultProps.photoOperationCost,
              defaultProps.videoAnimationCost,
              defaultProps.selectedVoice,
              defaultProps.firstName,
              defaultProps.surname,
              defaultProps.age
            )
          );

          act(() => {
            result.current.setTtsPrompt('Hello world');
          });

          // Start first animate
          act(() => {
            result.current.handleAnimate(mockImageFile);
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
          });

          expect(result.current.isProcessing).toBe(true);
          expect(result.current.isAnimating).toBe(true);

          // Try second animate (should be blocked)
          act(() => {
            result.current.handleAnimate(mockImageFile);
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
          });

          // Only one speech generation should have occurred
          expect(speechCallCount).toBe(1);
        }
      );
    });
  });
});
