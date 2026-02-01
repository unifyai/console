/**
 * Unit tests for src/hooks/Assistants/useVoiceCreator.ts
 *
 * Tests the voice creation hook logic for cloning and designing voices.
 * Focuses on stress testing race conditions, stale operations, and mode switching.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock constants
vi.mock('@/constants/assistants/settings', () => ({
  PRIMARY_VOICE_PROVIDER: 'elevenlabs',
  DESIGN_VOICE_DESC_MIN_LENGTH: 10,
  DESIGN_VOICE_DESC_MAX_LENGTH: 500,
  DESIGN_SAMPLE_TEXT_MIN_LENGTH: 10,
  DESIGN_SAMPLE_TEXT_MAX_LENGTH: 500,
}));

// Import hook after mocks
import { useVoiceCreator } from '@/hooks/Assistants/useVoiceCreator';

// Wrapper component to provide FormContext
const FormWrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm({
    defaultValues: {
      designIncludeBio: false,
      about: 'A helpful AI assistant',
    },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FormWrapper>{children}</FormWrapper>
);

describe('useVoiceCreator', () => {
  // Mock dependencies
  const mockVoiceActions = {
    clone: vi.fn(),
    preview: vi.fn(),
    design: vi.fn(),
  };

  const mockOnVoiceCreatedAndSelected = vi.fn();
  const mockFetchUserVoices = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('F - Stress and Robustness', () => {
    describe('Concurrent Operation Prevention', () => {
      it(
        'prevents double submission when create button clicked rapidly',
        {
          meta: {
            alias: 'Voice-PreventsDoubleCreate',
            scenario: 'User clicks create button twice rapidly',
            behavior: 'Only one voice should be created',
          },
        },
        async () => {
          // Arrange
          let createCallCount = 0;

          mockVoiceActions.clone.mockImplementation(async () => {
            createCallCount++;
            // Never resolve to keep isProcessingCreate = true
            return new Promise(() => {});
          });

          const mockFile = new File(['audio'], 'test.mp3', { type: 'audio/mp3' });

          const { result } = renderHook(
            () =>
              useVoiceCreator(
                mockVoiceActions as any,
                mockOnVoiceCreatedAndSelected,
                mockFetchUserVoices
              ),
            { wrapper }
          );

          // Setup clone mode with valid data
          act(() => {
            result.current.setCreateMode('clone');
            result.current.setCloneFile(mockFile);
            result.current.setCloneName('My Voice');
          });

          // Click create first time
          act(() => {
            result.current.handleCreateAndSelect();
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(10);
          });

          // isProcessingCreate should be true
          expect(result.current.isProcessingCreate).toBe(true);

          // Click create second time while first is processing
          act(() => {
            result.current.handleCreateAndSelect();
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(10);
          });

          // BUG: Currently both calls proceed - should only be 1
          expect(createCallCount).toBe(1);
        }
      );

      it(
        'prevents double preview generation when button clicked rapidly',
        {
          meta: {
            alias: 'Voice-PreventsDoublePreview',
            scenario: 'User clicks generate previews twice rapidly',
            behavior: 'Only one preview generation should occur',
          },
        },
        async () => {
          // Arrange
          let previewCallCount = 0;

          mockVoiceActions.preview.mockImplementation(async () => {
            previewCallCount++;
            return new Promise(() => {}); // Never resolve
          });

          const { result } = renderHook(
            () =>
              useVoiceCreator(
                mockVoiceActions as any,
                mockOnVoiceCreatedAndSelected,
                mockFetchUserVoices
              ),
            { wrapper }
          );

          // Setup design mode
          act(() => {
            result.current.setCreateMode('design');
            result.current.setDesignVoiceDescription('A warm and friendly voice with a calm tone');
          });

          // Click generate previews first time
          act(() => {
            result.current.handleGenerateDesignPreviews();
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(10);
          });

          expect(result.current.isGeneratingPreviews).toBe(true);

          // Click generate previews second time
          act(() => {
            result.current.handleGenerateDesignPreviews();
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(10);
          });

          // BUG: Currently both calls proceed - should only be 1
          expect(previewCallCount).toBe(1);
        }
      );
    });

    describe('Stale Operation Handling', () => {
      it(
        'ignores stale create response when mode switched',
        {
          meta: {
            alias: 'Voice-IgnoresStaleCreateOnModeSwitch',
            scenario: 'User starts clone, switches to design, clone completes',
            behavior: 'Clone completion should be ignored since mode changed',
          },
        },
        async () => {
          // Arrange
          let resolveClone: ((v: any) => void) | null = null;

          mockVoiceActions.clone.mockImplementation(async () => {
            return new Promise((resolve) => {
              resolveClone = resolve;
            });
          });

          const mockFile = new File(['audio'], 'test.mp3', { type: 'audio/mp3' });

          const { result } = renderHook(
            () =>
              useVoiceCreator(
                mockVoiceActions as any,
                mockOnVoiceCreatedAndSelected,
                mockFetchUserVoices
              ),
            { wrapper }
          );

          // Setup clone mode and start creation
          act(() => {
            result.current.setCreateMode('clone');
            result.current.setCloneFile(mockFile);
            result.current.setCloneName('Clone Voice');
          });

          act(() => {
            result.current.handleCreateAndSelect();
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(10);
          });

          expect(result.current.isProcessingCreate).toBe(true);

          // Switch to design mode while clone is in progress
          act(() => {
            result.current.setCreateMode('design');
          });

          // Resolve the clone request
          await act(async () => {
            resolveClone?.({
              voiceId: 'cloned-voice-id',
              name: 'Clone Voice',
              provider: 'elevenlabs',
            });
            await vi.advanceTimersByTimeAsync(10);
          });

          // BUG: Currently the callback IS called even though mode switched
          // After fix, it should NOT be called
          expect(mockOnVoiceCreatedAndSelected).not.toHaveBeenCalled();
        }
      );

      it(
        'ignores stale preview response when mode switched to clone',
        {
          meta: {
            alias: 'Voice-IgnoresStalePreviewOnModeSwitch',
            scenario: 'User generates previews, switches to clone, previews complete',
            behavior: 'Previews should be ignored since mode changed',
          },
        },
        async () => {
          // Arrange
          let resolvePreview: ((v: any) => void) | null = null;

          mockVoiceActions.preview.mockImplementation(async () => {
            return new Promise((resolve) => {
              resolvePreview = resolve;
            });
          });

          const { result } = renderHook(
            () =>
              useVoiceCreator(
                mockVoiceActions as any,
                mockOnVoiceCreatedAndSelected,
                mockFetchUserVoices
              ),
            { wrapper }
          );

          // Set design mode and start preview generation
          act(() => {
            result.current.setCreateMode('design');
            result.current.setDesignVoiceDescription('A warm and friendly voice with a calm tone');
          });

          act(() => {
            result.current.handleGenerateDesignPreviews();
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(10);
          });

          expect(result.current.isGeneratingPreviews).toBe(true);

          // Switch to clone mode while previews are generating
          act(() => {
            result.current.setCreateMode('clone');
          });

          // Resolve the preview request (should be ignored)
          await act(async () => {
            resolvePreview?.({
              previews: [
                { generatedVoiceId: 'preview-1', audioBase64: 'test', mediaType: 'audio/mpeg' },
              ],
            });
            await vi.advanceTimersByTimeAsync(10);
          });

          // BUG: Currently the previews ARE set even after mode switch
          // After fix, previews should be empty
          expect(result.current.createMode).toBe('clone');
          expect(result.current.designPreviews).toHaveLength(0);
        }
      );

      it(
        'ignores stale preview response when form reset',
        {
          meta: {
            alias: 'Voice-IgnoresStalePreviewOnReset',
            scenario: 'User generates previews, resets form, previews complete',
            behavior: 'Previews should be ignored since form was reset',
          },
        },
        async () => {
          // Arrange
          let resolvePreview: ((v: any) => void) | null = null;

          mockVoiceActions.preview.mockImplementation(async () => {
            return new Promise((resolve) => {
              resolvePreview = resolve;
            });
          });

          const { result } = renderHook(
            () =>
              useVoiceCreator(
                mockVoiceActions as any,
                mockOnVoiceCreatedAndSelected,
                mockFetchUserVoices
              ),
            { wrapper }
          );

          // Start preview generation
          act(() => {
            result.current.setCreateMode('design');
            result.current.setDesignVoiceDescription('A warm and friendly voice with a calm tone');
          });

          act(() => {
            result.current.handleGenerateDesignPreviews();
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(10);
          });

          expect(result.current.isGeneratingPreviews).toBe(true);

          // Reset form while generating
          act(() => {
            result.current.resetCreateForm();
          });

          // Resolve the preview (should be ignored)
          await act(async () => {
            resolvePreview?.({
              previews: [
                { generatedVoiceId: 'preview-1', audioBase64: 'test', mediaType: 'audio/mpeg' },
              ],
            });
            await vi.advanceTimersByTimeAsync(10);
          });

          // BUG: Currently previews are set even after reset
          // After fix, previews should remain empty
          expect(result.current.designPreviews).toHaveLength(0);
        }
      );
    });

    describe('Operation ID Tracking', () => {
      it(
        'blocks second preview request while first is in progress',
        {
          meta: {
            alias: 'Voice-BlocksSecondPreview',
            scenario: 'Two preview requests attempted rapidly',
            behavior: 'Second request should be blocked while first is in progress',
          },
        },
        async () => {
          // Arrange
          let callCount = 0;

          mockVoiceActions.preview.mockImplementation(async () => {
            callCount++;
            // Never resolve to keep isGeneratingPreviews true
            return new Promise(() => {});
          });

          const { result } = renderHook(
            () =>
              useVoiceCreator(
                mockVoiceActions as any,
                mockOnVoiceCreatedAndSelected,
                mockFetchUserVoices
              ),
            { wrapper }
          );

          act(() => {
            result.current.setCreateMode('design');
            result.current.setDesignVoiceDescription('A warm and friendly voice with a calm tone');
          });

          // First request
          act(() => {
            result.current.handleGenerateDesignPreviews();
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(10);
          });

          expect(result.current.isGeneratingPreviews).toBe(true);

          // Second request (should be blocked)
          act(() => {
            result.current.handleGenerateDesignPreviews();
          });

          await act(async () => {
            await vi.advanceTimersByTimeAsync(10);
          });

          // Only one preview call should have been made
          expect(callCount).toBe(1);
        }
      );
    });

    describe('Form State Consistency', () => {
      it(
        'clears design previews when resetCreateForm is called',
        {
          meta: {
            alias: 'Voice-ClearsPreviewsOnReset',
            scenario: 'User resets form after generating previews',
            behavior: 'All previews and selection should be cleared',
          },
        },
        async () => {
          // Arrange - manually set previews via state setter
          const { result } = renderHook(
            () =>
              useVoiceCreator(
                mockVoiceActions as any,
                mockOnVoiceCreatedAndSelected,
                mockFetchUserVoices
              ),
            { wrapper }
          );

          // Manually set some previews and state
          act(() => {
            result.current.setCreateMode('design');
            result.current.setDesignPreviews([
              { generatedVoiceId: 'preview-1', audioBase64: 'test', mediaType: 'audio/mpeg' },
              { generatedVoiceId: 'preview-2', audioBase64: 'test', mediaType: 'audio/mpeg' },
            ]);
            result.current.setSelectedPreviewId('preview-1');
            result.current.setCloneName('Test Clone');
          });

          expect(result.current.designPreviews.length).toBe(2);
          expect(result.current.selectedPreviewId).toBe('preview-1');

          // Reset form
          act(() => {
            result.current.resetCreateForm();
          });

          // Assert - all state should be cleared
          expect(result.current.designPreviews).toHaveLength(0);
          expect(result.current.selectedPreviewId).toBeNull();
          expect(result.current.cloneFile).toBeNull();
          expect(result.current.cloneName).toBe('');
        }
      );
    });
  });
});
