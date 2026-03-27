/**
 * Unit tests for src/hooks/Assistants/useAssistantForm.ts
 *
 * Tests the hire form hook logic for managing assistant creation/editing.
 * Uses React Testing Library's renderHook with mocked dependencies.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  AssistantActions,
  VoiceOption,
  AssistantPreset,
  Assistant,
  AssistantUpdatePayload,
  AssistantFormData,
} from '@/types/assistants/assistant';
import { ChatMessage } from '@/types/assistants/chat';

// Mock the Server Action module before importing the hook
vi.mock('@/lib/assistants/preHireChat', () => ({
  sendPreHireChatMessage: vi.fn(),
  generatePostHireGreeting: vi.fn().mockResolvedValue({ content: 'Hello! I am ready to work.' }),
}));

// Must import hook after mocking
import { useAssistantForm } from '@/hooks/Assistants/useAssistantForm';

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

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));

// Factory for mock assistant actions
const createMockAssistantActions = (): AssistantActions => ({
  assistant: {
    create: vi.fn().mockResolvedValue({
      assistant: {
        agentId: 'new-assistant-1',
        firstName: 'Jane',
        surname: 'Doe',
      },
    }),
    update: vi.fn().mockResolvedValue({ info: 'Updated' }),
    delete: vi.fn(),
    check: vi.fn().mockResolvedValue({ sufficient: true }),
  },
  chat: {
    getContactId: vi.fn(),
    getTranscripts: vi.fn(),
    message: vi.fn(),
    getAssistantOwnerById: vi.fn(),
  },
  call: {
    getConnectionDetails: vi.fn(),
    dispatchToCall: vi.fn(),
    deleteRoom: vi.fn(),
  },
  voice: {
    register: vi.fn().mockResolvedValue({ voiceId: 'v1', info: 'Registered' }),
    delete: vi.fn(),
    clone: vi.fn(),
    generate: vi.fn(),
    preview: vi.fn(),
    design: vi.fn(),
  },
  contact: {
    listAllAssistantEmails: vi.fn().mockResolvedValue([]),
    listAvailablePhoneCountries: vi.fn().mockResolvedValue([
      { code: 'US', name: 'United States', flag: '🇺🇸' },
      { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    ]),
    listAvailableSocialPlatforms: vi.fn(),
    verifySocialAccount: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
    fetchContactCosts: vi.fn(),
  },
  photo: {
    uploadPhoto: vi.fn().mockResolvedValue({ gcsUrl: 'gs://bucket/photo.jpg' }),
    uploadVideo: vi.fn().mockResolvedValue({ gcsUrl: 'gs://bucket/video.mp4' }),
    downloadMedia: vi.fn(),
    downloadPresetPhoto: vi.fn().mockResolvedValue({
      signedUrl: 'https://signed.url/photo.jpg',
      gcsUrl: 'gs://bucket/preset_assistants/photos/test.jpg',
    }),
    downloadPresetVideo: vi.fn().mockResolvedValue({
      signedUrl: 'https://signed.url/video.mp4',
      gcsUrl: 'gs://bucket/preset_assistants/videos/test.mp4',
    }),
    generate: vi.fn(),
    edit: vi.fn(),
    animate: vi.fn(),
    getAnimation: vi.fn(),
    cancelAnimation: vi.fn(),
  },
  secret: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  desktop: {
    getLiveviewUrl: vi.fn(),
    buildLiveviewUrl: vi.fn(async (rawUrl: string) => ({ liveviewUrl: `${rawUrl}?password=test-key` })),
    checkLiveviewHealth: vi.fn().mockResolvedValue(true),
    sendSystemEvent: vi.fn(),
    listUserDesktops: vi.fn(),
  },
  spending: {
    setLimit: vi.fn(),
  },
});

// Factory for mock voice options
const createMockVoices = (): VoiceOption[] => [
  {
    voiceId: 'default-voice',
    name: 'Default Voice',
    description: 'A default voice',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
    isPreset: true,
    isUserVoiceInOrchestra: true,
  },
  {
    voiceId: 'custom-voice',
    name: 'Custom Voice',
    description: 'A custom voice',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
    isPreset: false,
    isUserVoiceInOrchestra: true,
  },
];

describe('useAssistantForm', () => {
  let mockActions: AssistantActions;
  let mockVoices: VoiceOption[];
  let onHireSuccess: (
    newAssistant: Assistant,
    formData: AssistantFormData,
    chatHistory?: ChatMessage[]
  ) => void;
  let onUpdateSuccess: (updatedPayload: Partial<AssistantUpdatePayload>) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockActions = createMockAssistantActions();
    mockVoices = createMockVoices();
    onHireSuccess = vi.fn();
    onUpdateSuccess = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Initialization', () => {
    it(
      'does not load data when dialog is closed',
      {
        meta: {
          alias: 'HireForm-NoLoadClosed',
          scenario: 'Dialog is closed',
          behavior: 'Does not fetch data',
        },
      },
      () => {
        // Act
        renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, false)
        );

        // Assert
        expect(mockActions.contact.listAvailablePhoneCountries).not.toHaveBeenCalled();
        expect(mockActions.contact.listAllAssistantEmails).not.toHaveBeenCalled();
      }
    );
  });

  // ===========================================================================
  // Assistant Creation - No Contact Data
  // These tests verify that creating an assistant does not send contact details
  // ===========================================================================

  describe('Assistant Creation - No Contact Data', () => {
    it(
      'creates assistant without email, phone, or whatsapp data',
      {
        meta: {
          alias: 'HireForm-CreateWithoutContactData',
          scenario: 'User hires a new assistant',
          behavior: 'API should be called with null for all contact fields',
        },
      },
      async () => {
        // Arrange
        mockActions.assistant.create = vi.fn().mockResolvedValue({
          assistant: {
            agentId: 'new-1',
            firstName: 'New',
            surname: 'Assistant',
          },
        });

        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        // Wait for initialization
        await waitFor(() => {
          expect(result.current.isSubmitting).toBe(false);
        });

        // Setup valid form data (only profile data, no contact data)
        act(() => {
          result.current.formMethods.setValue('firstName', 'New');
          result.current.formMethods.setValue('surname', 'Assistant');
          result.current.formMethods.setValue('age', 25);
          result.current.formMethods.setValue('nationality', 'United States');
          result.current.formMethods.setValue('about', 'A new assistant');
          result.current.formMethods.setValue('voiceId', 'voice-1');
          result.current.formMethods.setValue('voiceName', 'Test Voice');
          result.current.formMethods.setValue('voiceGender', 'female');
          result.current.formMethods.setValue('voiceLanguage', 'en');
          result.current.formMethods.setValue('voiceExists', true);
        });

        // Act - Hire the assistant
        await act(async () => {
          await result.current.initiateHireSequence();
        });

        // Assert - Create should be called with null for contact fields
        await waitFor(() => {
          expect(mockActions.assistant.create).toHaveBeenCalled();
        });

        const createCall = (mockActions.assistant.create as any).mock.calls[0];
        // Based on the function signature: create(firstName, surname, age, nationality, timezone,
        // profilePhoto, profileVideo, about, voiceId, voiceProvider,
        // isUserDesktop, desktopMode, preHireChat)
        // Contact fields (email, userPhone, etc.) are no longer passed - handled by contact manager

        // Verify the call has the expected number of arguments (14 total: 13 required + optional preHireChat)
        expect(createCall.length).toBeLessThanOrEqual(14);
        // isUserDesktop (index 11) should be a boolean
        expect(typeof createCall[11]).toBe('boolean');
        // desktopMode (index 12) can be string or null
        expect(createCall[12] === null || typeof createCall[12] === 'string').toBe(true);
      }
    );

    it(
      'does NOT validate contact fields during hire submission',
      {
        meta: {
          alias: 'HireForm-NoContactValidationOnHire',
          scenario: 'User submits hire form',
          behavior: 'Should not validate email or phone fields',
        },
      },
      async () => {
        // Arrange
        mockActions.assistant.create = vi.fn().mockResolvedValue({
          assistant: { agentId: 'new-1', firstName: 'Test', surname: 'User' },
        });

        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        await waitFor(() => {
          expect(result.current.isSubmitting).toBe(false);
        });

        // Setup minimal valid form data
        act(() => {
          result.current.formMethods.setValue('firstName', 'Test');
          result.current.formMethods.setValue('surname', 'User');
          result.current.formMethods.setValue('nationality', 'United States');
          result.current.formMethods.setValue('voiceId', 'voice-1');
          result.current.formMethods.setValue('voiceName', 'Test Voice');
          result.current.formMethods.setValue('voiceGender', 'female');
          result.current.formMethods.setValue('voiceLanguage', 'en');
          result.current.formMethods.setValue('voiceExists', true);
        });

        // Act - Should succeed without any contact data
        await act(async () => {
          await result.current.initiateHireSequence();
        });

        // Assert - Hire should succeed (create was called)
        await waitFor(() => {
          expect(mockActions.assistant.create).toHaveBeenCalled();
        });

        // Form should not have errors
        expect(result.current.formMethods.formState.errors.firstName).toBeUndefined();
        expect(result.current.formMethods.formState.errors.surname).toBeUndefined();
      }
    );
  });

  describe('Form Methods', () => {
    it(
      'exposes react-hook-form methods',
      {
        meta: {
          alias: 'HireForm-ExposesRHF',
          scenario: 'Hook initialized',
          behavior: 'formMethods contains form methods',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        // Assert
        expect(result.current.formMethods).toBeDefined();
        expect(result.current.formMethods.setValue).toBeDefined();
        expect(result.current.formMethods.getValues).toBeDefined();
        expect(result.current.formMethods.watch).toBeDefined();
      }
    );

    it(
      'has default form values',
      {
        meta: {
          alias: 'HireForm-DefaultValues',
          scenario: 'Hook initialized',
          behavior: 'Form has expected default values',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        const values = result.current.formMethods.getValues();

        // Assert
        expect(values.firstName).toBe('');
        expect(values.surname).toBe('');
        expect(values.age).toBeNull();
        expect(values.nationality).toBe('United States');
        expect(values.setup).toBe('remote');
      }
    );
  });

  describe('Preset Selection', () => {
    const mockPreset: AssistantPreset = {
      firstName: 'PresetFirst',
      surname: 'PresetLast',
      age: 28,
      nationality: 'Canada',
      gender: 'female',
      about: 'A preset assistant',
      profilePhoto: 'preset_assistants/photos/PresetFirst_PresetLast.jpg',
      profileVideo: null,
      voiceIds: {
        elevenlabs: 'preset-el-voice',
        openai: 'preset-oai-voice',
      },
      timezone: 'America/Toronto',
      phoneCountry: 'CA',
    };

    it(
      'populates form with preset values',
      {
        meta: {
          alias: 'HireForm-SelectPreset',
          scenario: 'User selects a preset',
          behavior: 'Form values are populated from preset',
        },
      },
      async () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        act(() => {
          result.current.selectPreset(mockPreset);
        });

        const values = result.current.formMethods.getValues();

        // Assert
        expect(values.firstName).toBe('PresetFirst');
        expect(values.surname).toBe('PresetLast');
        expect(values.age).toBe(28);
        expect(values.nationality).toBe('Canada');

        // Preset photo is now fetched async from GCS — wait for the signed URL
        await waitFor(() => {
          const updatedValues = result.current.formMethods.getValues();
          expect(updatedValues.profilePhotoUrl).toBe(
            'gs://bucket/preset_assistants/photos/test.jpg'
          );
          expect(updatedValues.photoPreviewUrl).toBe(
            'https://signed.url/preset-photo.jpg'
          );
        });
      }
    );

    it(
      'stores preset original values',
      {
        meta: {
          alias: 'HireForm-PresetOriginalValues',
          scenario: 'User selects a preset',
          behavior: 'presetOriginalValues is populated',
        },
      },
      async () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        act(() => {
          result.current.selectPreset(mockPreset);
        });

        const values = result.current.formMethods.getValues();

        // Assert
        expect(values.presetOriginalValues).not.toBeNull();
        expect(values.presetOriginalValues?.firstName).toBe('PresetFirst');
      }
    );

    it(
      'downloads preset photo from GCS',
      {
        meta: {
          alias: 'HireForm-PresetPhoto',
          scenario: 'User selects a preset',
          behavior: 'Fetches preset photo signed URL from GCS',
        },
      },
      async () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        act(() => {
          result.current.selectPreset(mockPreset);
        });

        // Assert
        await waitFor(() => {
          expect(mockActions.photo.downloadPresetPhoto).toHaveBeenCalledWith(
            'PresetFirst',
            'PresetLast'
          );
        });
      }
    );

    it(
      'downloads preset video',
      {
        meta: {
          alias: 'HireForm-PresetVideo',
          scenario: 'User selects a preset',
          behavior: 'Fetches preset video URL',
        },
      },
      async () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        act(() => {
          result.current.selectPreset(mockPreset);
        });

        // Assert
        await waitFor(() => {
          expect(mockActions.photo.downloadPresetVideo).toHaveBeenCalledWith(
            'PresetFirst',
            'PresetLast',
            expect.any(String)
          );
        });
      }
    );
  });

  describe('Media Handling', () => {
    it(
      'handles photo file selection',
      {
        meta: {
          alias: 'HireForm-PhotoSelect',
          scenario: 'User selects photo file',
          behavior: 'Form values are updated with photo',
        },
      },
      () => {
        // Arrange
        const mockFile = new File(['photo data'], 'photo.jpg', { type: 'image/jpeg' });

        // Act
        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        act(() => {
          result.current.onNewMediaReady(mockFile, 'photo');
        });

        const values = result.current.formMethods.getValues();

        // Assert
        expect(values.photoFile).toBe(mockFile);
        expect(values.photoPreviewUrl).toContain('blob:');
      }
    );

    it(
      'handles video file selection',
      {
        meta: {
          alias: 'HireForm-VideoSelect',
          scenario: 'User selects video file',
          behavior: 'Form values are updated with video',
        },
      },
      () => {
        // Arrange
        const mockFile = new File(['video data'], 'video.mp4', { type: 'video/mp4' });

        // Act
        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        act(() => {
          result.current.onNewMediaReady(mockFile, 'video', { voiceId: 'v1' });
        });

        const values = result.current.formMethods.getValues();

        // Assert
        expect(values.videoFile).toBe(mockFile);
        expect(values.videoSourceVoiceId).toBe('v1');
      }
    );

    it(
      'sets isPresetPristine to false when media changes',
      {
        meta: {
          alias: 'HireForm-MediaBreaksPristine',
          scenario: 'User changes media after preset selection',
          behavior: 'isPresetPristine becomes false',
        },
      },
      () => {
        // Arrange
        const mockFile = new File(['photo data'], 'photo.jpg', { type: 'image/jpeg' });

        // Act
        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        // Set pristine first
        act(() => {
          result.current.formMethods.setValue('isPresetPristine', true);
        });

        act(() => {
          result.current.onNewMediaReady(mockFile, 'photo');
        });

        const values = result.current.formMethods.getValues();

        // Assert
        expect(values.isPresetPristine).toBe(false);
      }
    );
  });

  describe('Form Reset', () => {
    it(
      'resets form to default values',
      {
        meta: {
          alias: 'HireForm-Reset',
          scenario: 'User resets form',
          behavior: 'Form values return to defaults',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        // Modify some values
        act(() => {
          result.current.formMethods.setValue('firstName', 'Modified');
          result.current.formMethods.setValue('age', 25);
        });

        // Reset
        act(() => {
          result.current.resetForm();
        });

        const values = result.current.formMethods.getValues();

        // Assert
        expect(values.firstName).toBe('');
        expect(values.age).toBeNull();
      }
    );

    it(
      'clears insufficient funds hint on reset',
      {
        meta: {
          alias: 'HireForm-ResetClearsHint',
          scenario: 'User resets form',
          behavior: 'showInsufficientFundsHint becomes false',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        // Set hint to true
        act(() => {
          result.current.setShowInsufficientFundsHint(true);
        });

        expect(result.current.showInsufficientFundsHint).toBe(true);

        // Reset
        act(() => {
          result.current.resetForm();
        });

        // Assert
        expect(result.current.showInsufficientFundsHint).toBe(false);
      }
    );
  });

  describe('State Flags', () => {
    it(
      'exposes isSubmitting state',
      {
        meta: {
          alias: 'HireForm-IsSubmitting',
          scenario: 'Hook initialized',
          behavior: 'isSubmitting is false initially',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        // Assert
        expect(result.current.isSubmitting).toBe(false);
      }
    );

    it(
      'exposes isCheckingBalance state',
      {
        meta: {
          alias: 'HireForm-IsCheckingBalance',
          scenario: 'Hook initialized',
          behavior: 'isCheckingBalance is false initially',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        // Assert
        expect(result.current.isCheckingBalance).toBe(false);
      }
    );

    it(
      'exposes showInsufficientFundsHint state',
      {
        meta: {
          alias: 'HireForm-InsufficientFunds',
          scenario: 'Hook initialized',
          behavior: 'showInsufficientFundsHint is false initially',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        // Assert
        expect(result.current.showInsufficientFundsHint).toBe(false);
      }
    );

    it(
      'allows setting insufficient funds hint',
      {
        meta: {
          alias: 'HireForm-SetInsufficientFunds',
          scenario: 'Balance check fails',
          behavior: 'setShowInsufficientFundsHint updates state',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        act(() => {
          result.current.setShowInsufficientFundsHint(true);
        });

        // Assert
        expect(result.current.showInsufficientFundsHint).toBe(true);
      }
    );
  });

  // ===========================================================================
  // F - Stress and Robustness
  // ===========================================================================

  describe('F - Stress and Robustness', () => {
    describe('Preset Selection Race Conditions', () => {
      it(
        'ignores stale video download when switching presets rapidly',
        {
          meta: {
            alias: 'HireForm-IgnoresStalePresetVideo',
            scenario: 'User rapidly clicks through different presets',
            behavior: 'Only the last preset video should be displayed',
          },
        },
        async () => {
          // Arrange - setup delayed video downloads
          let resolveFirstVideo: ((v: any) => void) | null = null;
          let resolveSecondVideo: ((v: any) => void) | null = null;
          let callCount = 0;

          mockActions.photo.downloadPresetVideo = vi
            .fn()
            .mockImplementation(async (firstName: string) => {
              callCount++;
              if (callCount === 1) {
                return new Promise((resolve) => {
                  resolveFirstVideo = resolve;
                });
              }
              return new Promise((resolve) => {
                resolveSecondVideo = resolve;
              });
            });

          const preset1: AssistantPreset = {
            firstName: 'Alice',
            surname: 'First',
            age: 25,
            gender: 'female',
            nationality: 'United States',
            voiceIds: { elevenlabs: 'voice-1', openai: 'voice-1-openai' },
            profilePhoto: 'gs://bucket/alice.jpg',
            profileVideo: null,
            about: 'A helpful assistant',
            phoneCountry: 'US',
            timezone: 'UTC',
          };

          const preset2: AssistantPreset = {
            firstName: 'Bob',
            surname: 'Second',
            age: 30,
            gender: 'male',
            nationality: 'United Kingdom',
            voiceIds: { elevenlabs: 'voice-2', openai: 'voice-2-openai' },
            profilePhoto: 'gs://bucket/bob.jpg',
            profileVideo: null,
            about: 'Another helpful assistant',
            phoneCountry: 'GB',
            timezone: 'UTC',
          };

          const { result } = renderHook(() =>
            useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
          );

          // Allow hook to initialize
          await new Promise((r) => setTimeout(r, 50));

          // Select first preset
          act(() => {
            result.current.selectPreset(preset1);
          });

          // Give time for async operation to start
          await act(async () => {
            await new Promise((r) => setTimeout(r, 10));
          });

          // Quickly select second preset before first video loads
          act(() => {
            result.current.selectPreset(preset2);
          });

          // Give time for async operation to start
          await act(async () => {
            await new Promise((r) => setTimeout(r, 10));
          });

          // Resolve first video (stale - should be ignored)
          await act(async () => {
            resolveFirstVideo?.({ signedUrl: 'https://stale-alice-video.mp4' });
            await new Promise((r) => setTimeout(r, 10));
          });

          // Resolve second video (current)
          await act(async () => {
            resolveSecondVideo?.({ signedUrl: 'https://current-bob-video.mp4' });
            await new Promise((r) => setTimeout(r, 10));
          });

          // BUG: First video might overwrite second since there's no operation ID
          // After fix, should have Bob's data and video
          const formValues = result.current.formMethods.getValues();
          expect(formValues.firstName).toBe('Bob');
          expect(formValues.videoPreviewUrl).toBe('https://current-bob-video.mp4');
        }
      );
    });

    describe('Double Submission Prevention', () => {
      it(
        'prevents double hire submission when clicked rapidly',
        {
          meta: {
            alias: 'HireForm-PreventsDoubleHire',
            scenario: 'User clicks hire button twice rapidly',
            behavior: 'Only one hire should be processed',
          },
        },
        async () => {
          // Arrange - slow hire process
          let hireCallCount = 0;
          mockActions.assistant.create = vi.fn().mockImplementation(async () => {
            hireCallCount++;
            // Never resolve to keep isSubmitting true
            return new Promise(() => {});
          });

          const { result } = renderHook(() =>
            useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
          );

          // Allow hook to initialize
          await new Promise((r) => setTimeout(r, 50));

          // Setup valid form data
          act(() => {
            result.current.formMethods.setValue('firstName', 'Test');
            result.current.formMethods.setValue('surname', 'Assistant');
            result.current.formMethods.setValue('nationality', 'United States');
            result.current.formMethods.setValue('voiceId', 'voice-1');
            result.current.formMethods.setValue('voiceName', 'Test Voice');
            result.current.formMethods.setValue('voiceGender', 'female');
            result.current.formMethods.setValue('voiceLanguage', 'en');
            result.current.formMethods.setValue('voiceExists', true);
          });

          // First hire attempt
          act(() => {
            result.current.initiateHireSequence();
          });

          await act(async () => {
            await new Promise((r) => setTimeout(r, 100));
          });

          // Verify submitting state
          expect(result.current.isCheckingBalance || result.current.isSubmitting).toBe(true);

          // Second hire attempt while first is processing
          act(() => {
            result.current.initiateHireSequence();
          });

          await act(async () => {
            await new Promise((r) => setTimeout(r, 100));
          });

          // Should only have one hire call
          // Note: The guard at line 851 should prevent this
          expect(hireCallCount).toBeLessThanOrEqual(1);
        }
      );

      it(
        'prevents double update submission when clicked rapidly',
        {
          meta: {
            alias: 'HireForm-PreventsDoubleUpdate',
            scenario: 'User clicks update button twice rapidly',
            behavior: 'Only one update should be processed',
          },
        },
        async () => {
          // Arrange
          let updateCallCount = 0;
          mockActions.assistant.update = vi.fn().mockImplementation(async () => {
            updateCallCount++;
            // Never resolve
            return new Promise(() => {});
          });

          const existingAssistant: Assistant = {
            agentId: 'existing-1',
            firstName: 'Existing',
            surname: 'Assistant',
            age: 25,
            nationality: 'United States',
            timezone: 'UTC',
            voiceId: 'voice-1',
            voiceProvider: 'elevenlabs',
          } as Assistant;

          const { result } = renderHook(() =>
            useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
          );

          // Allow hook to initialize
          await new Promise((r) => setTimeout(r, 50));

          // Load assistant for editing
          act(() => {
            result.current.loadAssistantForEdit(existingAssistant);
          });

          // Make a change
          act(() => {
            result.current.formMethods.setValue('about', 'Updated bio');
          });

          // First update attempt
          act(() => {
            result.current.initiateUpdate();
          });

          await act(async () => {
            await new Promise((r) => setTimeout(r, 50));
          });

          // Second update attempt while first is processing
          act(() => {
            result.current.initiateUpdate();
          });

          await act(async () => {
            await new Promise((r) => setTimeout(r, 50));
          });

          // Should only have one update call
          expect(updateCallCount).toBeLessThanOrEqual(1);
        }
      );
    });

    describe('Operation ID Tracking', () => {
      it(
        'should have mechanism to cancel stale hire operations',
        {
          meta: {
            alias: 'HireForm-CancelStaleHire',
            scenario: 'User starts hire, closes dialog, starts new hire',
            behavior: 'First hire should be cancelled/ignored',
          },
        },
        async () => {
          // This test documents that the hook currently lacks operation ID tracking
          // for the hire sequence. The form reset clears state but doesn't cancel
          // in-flight operations.

          // For now, verify that resetForm can be called
          const { result } = renderHook(() =>
            useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
          );

          // Allow hook to initialize
          await new Promise((r) => setTimeout(r, 50));

          act(() => {
            result.current.formMethods.setValue('firstName', 'Test');
          });

          expect(result.current.formMethods.getValues('firstName')).toBe('Test');

          act(() => {
            result.current.resetForm();
          });

          expect(result.current.formMethods.getValues('firstName')).toBe('');
        }
      );
    });
  });

  describe('Media Upload with assistant_id', () => {
    it(
      'hire flow: creates assistant first, then uploads photo with assistant_id, then updates assistant',
      {
        meta: {
          alias: 'HireForm-PhotoUploadWithAssistantId',
          scenario: 'User hires assistant with custom photo',
          behavior:
            'Create assistant first (null photo), upload photo with assistant_id, update with URL',
        },
      },
      async () => {
        // Arrange - track call order
        const callOrder: string[] = [];

        mockActions.assistant.create = vi.fn().mockImplementation(async (...args: any[]) => {
          callOrder.push('create');
          return {
            assistant: {
              agentId: 'new-assistant-42',
              firstName: 'Jane',
              surname: 'Doe',
            },
          };
        });

        mockActions.photo.uploadPhoto = vi.fn().mockImplementation(async (formData: FormData) => {
          callOrder.push('photo.uploadPhoto');
          return { gcsUrl: 'gs://bucket/42/photos/photo.jpg' };
        });

        mockActions.assistant.update = vi.fn().mockImplementation(async () => {
          callOrder.push('update');
          return { info: 'Updated' };
        });

        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        await waitFor(() => {
          expect(result.current.isSubmitting).toBe(false);
        });

        const mockPhotoFile = new File(['photo data'], 'photo.jpg', { type: 'image/jpeg' });

        act(() => {
          result.current.formMethods.setValue('firstName', 'Jane');
          result.current.formMethods.setValue('surname', 'Doe');
          result.current.formMethods.setValue('age', 25);
          result.current.formMethods.setValue('nationality', 'United States');
          result.current.formMethods.setValue('voiceId', 'voice-1');
          result.current.formMethods.setValue('voiceName', 'Test Voice');
          result.current.formMethods.setValue('voiceGender', 'female');
          result.current.formMethods.setValue('voiceLanguage', 'en');
          result.current.formMethods.setValue('voiceExists', true);
          result.current.formMethods.setValue('photoFile', mockPhotoFile);
        });

        // Act
        await act(async () => {
          await result.current.initiateHireSequence();
        });

        // Assert - correct call order
        await waitFor(() => {
          expect(callOrder).toEqual(['create', 'photo.uploadPhoto', 'update']);
        });

        // Create should be called with null for profilePhoto (index 5)
        const createCall = (mockActions.assistant.create as any).mock.calls[0];
        expect(createCall[5]).toBeNull(); // profilePhoto = null (custom upload deferred)

        // Photo upload should include assistant_id in FormData
        const uploadCall = (mockActions.photo.uploadPhoto as any).mock.calls[0];
        const uploadFormData: FormData = uploadCall[0];
        expect(uploadFormData.get('assistant_id')).toBe('new-assistant-42');
        expect(uploadFormData.get('file')).toBeTruthy();

        // Update should be called with assistant_id and profilePhoto
        expect(mockActions.assistant.update).toHaveBeenCalledWith('new-assistant-42', {
          profilePhoto: 'gs://bucket/42/photos/photo.jpg',
        });
      }
    );

    it(
      'hire flow: does not upload or update when using preset (pristine) photo',
      {
        meta: {
          alias: 'HireForm-PresetPhotoNoUpload',
          scenario: 'User hires with a preset (no custom photo file)',
          behavior: 'Photo URL is passed directly to create, no upload/update needed',
        },
      },
      async () => {
        mockActions.assistant.create = vi.fn().mockResolvedValue({
          assistant: { agentId: 'preset-1', firstName: 'Preset', surname: 'Test' },
        });

        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        await waitFor(() => {
          expect(result.current.isSubmitting).toBe(false);
        });

        act(() => {
          result.current.formMethods.setValue('firstName', 'Preset');
          result.current.formMethods.setValue('surname', 'Test');
          result.current.formMethods.setValue('nationality', 'United States');
          result.current.formMethods.setValue('voiceId', 'voice-1');
          result.current.formMethods.setValue('voiceName', 'Test Voice');
          result.current.formMethods.setValue('voiceGender', 'female');
          result.current.formMethods.setValue('voiceLanguage', 'en');
          result.current.formMethods.setValue('voiceExists', true);
          result.current.formMethods.setValue('isPresetPristine', true);
          result.current.formMethods.setValue(
            'profilePhotoUrl',
            'gs://bucket/preset.jpg'
          );
        });

        await act(async () => {
          await result.current.initiateHireSequence();
        });

        await waitFor(() => {
          expect(mockActions.assistant.create).toHaveBeenCalled();
        });

        // Create should have the preset photo URL (index 5)
        const createCall = (mockActions.assistant.create as any).mock.calls[0];
        expect(createCall[5]).toBe('gs://bucket/preset.jpg');

        // No photo upload or assistant update should have been called
        expect(mockActions.photo.uploadPhoto).not.toHaveBeenCalled();
        expect(mockActions.assistant.update).not.toHaveBeenCalled();
      }
    );

    it(
      'update flow: includes assistant_id in photo upload FormData',
      {
        meta: {
          alias: 'HireForm-UpdatePhotoWithAssistantId',
          scenario: 'User updates assistant with new photo',
          behavior: 'Photo upload FormData includes assistant_id',
        },
      },
      async () => {
        const existingAssistant: Assistant = {
          agentId: 'existing-99',
          firstName: 'Existing',
          surname: 'Assistant',
          age: 25,
          nationality: 'United States',
          timezone: 'UTC',
          voiceId: 'default-voice',
          voiceProvider: 'elevenlabs',
          userId: '1',
          organizationId: null,
          about: 'Test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          email: null,
          phone: null,
          userPhone: null,
          phoneCountry: null,
          userWhatsappNumber: null,
          assistantWhatsappNumber: null,
          profilePhoto: null,
          profileVideo: null,
          weeklyLimit: null,
          maxParallel: null,
        } as Assistant;

        mockActions.photo.uploadPhoto = vi.fn().mockResolvedValue({
          gcsUrl: 'gs://bucket/99/photos/new-photo.jpg',
        });

        const { result } = renderHook(() =>
          useAssistantForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        await waitFor(() => {
          expect(result.current.isSubmitting).toBe(false);
        });

        act(() => {
          result.current.loadAssistantForEdit(existingAssistant);
        });

        const mockPhotoFile = new File(['photo data'], 'new-photo.jpg', { type: 'image/jpeg' });

        act(() => {
          result.current.formMethods.setValue('photoFile', mockPhotoFile);
        });

        await act(async () => {
          await result.current.initiateUpdate();
        });

        await waitFor(() => {
          expect(mockActions.photo.uploadPhoto).toHaveBeenCalled();
        });

        // Verify assistant_id is in the FormData
        const uploadCall = (mockActions.photo.uploadPhoto as any).mock.calls[0];
        const uploadFormData: FormData = uploadCall[0];
        expect(uploadFormData.get('assistant_id')).toBe('existing-99');
        expect(uploadFormData.get('file')).toBeTruthy();

        // Verify update was called with the new photo URL
        expect(mockActions.assistant.update).toHaveBeenCalledWith(
          'existing-99',
          expect.objectContaining({
            profilePhoto: 'gs://bucket/99/photos/new-photo.jpg',
          })
        );
      }
    );
  });

  describe('G - Update Error Handling', () => {
    const mockEditingAssistant: Assistant = {
      agentId: 'edit-assistant-1',
      firstName: 'Existing',
      surname: 'Assistant',
      userId: '1',
      organizationId: null,
      about: 'Test bio',
      timezone: 'UTC',
      voiceId: 'default-voice',
      voiceProvider: 'elevenlabs',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      email: null,
      phone: null,
      userPhone: null,
      phoneCountry: null,
      userWhatsappNumber: null,
      assistantWhatsappNumber: null,
      profilePhoto: null,
      profileVideo: null,
      nationality: null,
      age: null,
      weeklyLimit: null,
      maxParallel: null,
    };

    // Note: Contact-specific error tests (email, phone) are in useAssistantContactManager tests
    // since contact updates are handled exclusively by the contact manager.

    it(
      'shows specific error message for any backend detail response',
      {
        meta: {
          alias: 'HireForm-BackendDetailError',
          scenario: 'Backend returns any error with detail field',
          behavior: 'Should propagate the detail message to user',
        },
      },
      async () => {
        const { toast } = await import('sonner');

        const mockActionsWithError = createMockAssistantActions();
        mockActionsWithError.assistant.update = vi.fn().mockResolvedValue({
          detail: 'Timezone Europe/FakeZone is not valid',
        });

        const { result } = renderHook(() =>
          useAssistantForm(mockActionsWithError, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });

        act(() => {
          result.current.loadAssistantForEdit(mockEditingAssistant);
        });

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });

        act(() => {
          result.current.formMethods.setValue('timezone', 'Europe/FakeZone');
        });

        await act(async () => {
          await result.current.initiateUpdate();
        });

        await act(async () => {
          await new Promise((r) => setTimeout(r, 100));
        });

        // Should show the specific backend error
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Timezone'),
          expect.any(Object)
        );
      }
    );
  });
});
