/**
 * Unit tests for src/hooks/Assistants/useAssistantHireForm.ts
 *
 * Tests the hire form hook logic for managing assistant creation/editing.
 * Uses React Testing Library's renderHook with mocked dependencies.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAssistantHireForm } from '@/hooks/Assistants/useAssistantHireForm';
import { AssistantActions, VoiceOption, AssistantPreset } from '@/types/assistants/assistant';

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
    list: vi.fn(),
    status: vi.fn(),
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
    getContactIdByEmail: vi.fn(),
    transcripts: vi.fn(),
    message: vi.fn(),
    triggerContactSync: vi.fn(),
  },
  call: {
    getConnectionDetails: vi.fn(),
    dispatchToCall: vi.fn(),
  },
  voice: {
    list: vi.fn(),
    register: vi.fn().mockResolvedValue({ voiceId: 'v1', info: 'Registered' }),
    delete: vi.fn(),
    clone: vi.fn(),
    generate: vi.fn(),
    designGeneratePreviews: vi.fn(),
    designCreateFromPreview: vi.fn(),
  },
  contact: {
    listAllAssistantEmails: vi.fn().mockResolvedValue([]),
    listAvailablePhoneCountries: vi.fn().mockResolvedValue([
      { code: 'US', name: 'United States', flag: '🇺🇸' },
      { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    ]),
    listAvailableSocialPlatforms: vi.fn(),
    verifySocialAccount: vi.fn(),
    deleteContact: vi.fn(),
  },
  photo: {
    upload: vi.fn().mockResolvedValue({ gcsUrl: 'gs://bucket/photo.jpg' }),
    uploadVideo: vi.fn().mockResolvedValue({ gcsUrl: 'gs://bucket/video.mp4' }),
    download: vi.fn(),
    downloadPresetVideo: vi.fn().mockResolvedValue({ signedUrl: 'https://signed.url/video.mp4' }),
    generate: vi.fn(),
    edit: vi.fn(),
    animate: vi.fn(),
    getAnimationPrediction: vi.fn(),
    cancelAnimationPrediction: vi.fn(),
  },
  secret: {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  task: {
    list: vi.fn(),
    getUniqueFieldValues: vi.fn(),
    update: vi.fn(),
  },
  desktop: {
    getLiveviewUrl: vi.fn(),
    sendSystemEvent: vi.fn(),
  },
  approval: {
    list: vi.fn(),
    respond: vi.fn(),
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

describe('useAssistantHireForm', () => {
  let mockActions: AssistantActions;
  let mockVoices: VoiceOption[];
  let onHireSuccess: ReturnType<typeof vi.fn>;
  let onUpdateSuccess: ReturnType<typeof vi.fn>;

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
      'loads available phone countries on dialog open',
      {
        meta: {
          alias: 'HireForm-LoadCountries',
          scenario: 'Dialog opens',
          behavior: 'Fetches available phone countries',
        },
      },
      async () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        // Assert
        await waitFor(() => {
          expect(mockActions.contact.listAvailablePhoneCountries).toHaveBeenCalled();
          expect(result.current.isLoadingCountries).toBe(false);
        });
      }
    );

    it(
      'loads assistant emails on dialog open',
      {
        meta: {
          alias: 'HireForm-LoadEmails',
          scenario: 'Dialog opens',
          behavior: 'Fetches existing assistant emails',
        },
      },
      async () => {
        // Act
        renderHook(() =>
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        // Assert
        await waitFor(() => {
          expect(mockActions.contact.listAllAssistantEmails).toHaveBeenCalled();
        });
      }
    );

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
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, false)
        );

        // Assert
        expect(mockActions.contact.listAvailablePhoneCountries).not.toHaveBeenCalled();
        expect(mockActions.contact.listAllAssistantEmails).not.toHaveBeenCalled();
      }
    );

    it(
      'exposes available countries after loading',
      {
        meta: {
          alias: 'HireForm-ExposesCountries',
          scenario: 'Countries loaded',
          behavior: 'availablePhoneCountries contains loaded data',
        },
      },
      async () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        // Assert
        await waitFor(() => {
          expect(result.current.availablePhoneCountries).toHaveLength(2);
          expect(result.current.availablePhoneCountries[0].code).toBe('US');
        });
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
          behavior: 'hireFormMethods contains form methods',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() =>
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        // Assert
        expect(result.current.hireFormMethods).toBeDefined();
        expect(result.current.hireFormMethods.setValue).toBeDefined();
        expect(result.current.hireFormMethods.getValues).toBeDefined();
        expect(result.current.hireFormMethods.watch).toBeDefined();
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
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        const values = result.current.hireFormMethods.getValues();

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
      profilePhoto: 'https://example.com/preset-photo.jpg',
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
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        act(() => {
          result.current.selectPreset(mockPreset);
        });

        const values = result.current.hireFormMethods.getValues();

        // Assert
        expect(values.firstName).toBe('PresetFirst');
        expect(values.surname).toBe('PresetLast');
        expect(values.age).toBe(28);
        expect(values.nationality).toBe('Canada');
        expect(values.profilePhotoUrl).toBe('https://example.com/preset-photo.jpg');
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
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        act(() => {
          result.current.selectPreset(mockPreset);
        });

        const values = result.current.hireFormMethods.getValues();

        // Assert
        expect(values.presetOriginalValues).not.toBeNull();
        expect(values.presetOriginalValues?.firstName).toBe('PresetFirst');
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
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
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
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        act(() => {
          result.current.onNewMediaReady(mockFile, 'photo');
        });

        const values = result.current.hireFormMethods.getValues();

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
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        act(() => {
          result.current.onNewMediaReady(mockFile, 'video', { voiceId: 'v1' });
        });

        const values = result.current.hireFormMethods.getValues();

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
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        // Set pristine first
        act(() => {
          result.current.hireFormMethods.setValue('isPresetPristine', true);
        });

        act(() => {
          result.current.onNewMediaReady(mockFile, 'photo');
        });

        const values = result.current.hireFormMethods.getValues();

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
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        // Modify some values
        act(() => {
          result.current.hireFormMethods.setValue('firstName', 'Modified');
          result.current.hireFormMethods.setValue('age', 25);
        });

        // Reset
        act(() => {
          result.current.resetForm();
        });

        const values = result.current.hireFormMethods.getValues();

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
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
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
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
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
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
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
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
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
          useAssistantHireForm(mockActions, mockVoices, onHireSuccess, onUpdateSuccess, true)
        );

        act(() => {
          result.current.setShowInsufficientFundsHint(true);
        });

        // Assert
        expect(result.current.showInsufficientFundsHint).toBe(true);
      }
    );
  });
});
