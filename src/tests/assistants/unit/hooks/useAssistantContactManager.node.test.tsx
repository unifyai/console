/**
 * Unit tests for src/hooks/Assistants/useAssistantContactManager.ts
 *
 * Tests the contact manager hook logic for managing assistant contact details.
 * These tests validate that contact data fetching and management is properly
 * encapsulated in the contact manager with its own form state.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as React from 'react';
import {
  AssistantActions,
  Assistant,
  AvailableSocialPlatform,
  AvailablePhoneCountry,
} from '@/types/assistants/assistant';
import { useAssistantContactManager } from '@/hooks/Assistants/useAssistantContactManager';

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

// Factory for mock assistant actions
const createMockAssistantActions = (): AssistantActions => ({
  assistant: {
    list: vi.fn(),
    status: vi.fn(),
    create: vi.fn(),
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
    list: vi.fn(),
    register: vi.fn(),
    delete: vi.fn(),
    clone: vi.fn(),
    generate: vi.fn(),
    preview: vi.fn(),
    design: vi.fn(),
  },
  contact: {
    listAllAssistantEmails: vi.fn().mockResolvedValue(['existing@ora.ai']),
    listAvailablePhoneCountries: vi.fn().mockResolvedValue([
      { code: 'US', name: 'United States', flag: '🇺🇸' },
      { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    ]),
    listAvailableSocialPlatforms: vi.fn().mockResolvedValue([{ name: 'whatsapp', cost: 5.0 }]),
    verifySocialAccount: vi.fn(),
    delete: vi.fn().mockResolvedValue({}),
  },
  photo: {
    upload: vi.fn(),
    uploadVideo: vi.fn(),
    download: vi.fn(),
    downloadPresetVideo: vi.fn(),
    generate: vi.fn(),
    edit: vi.fn(),
    animate: vi.fn(),
    getAnimation: vi.fn(),
    cancelAnimation: vi.fn(),
  },
  secret: {
    get: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  desktop: {
    getLiveviewUrl: vi.fn(),
    sendSystemEvent: vi.fn(),
    listUserDesktops: vi.fn(),
  },
  approval: {
    getProfile: vi.fn(),
    requestAccess: vi.fn(),
    claimToken: vi.fn(),
  },
  spending: {
    getSpend: vi.fn(),
    getLimit: vi.fn(),
    setLimit: vi.fn(),
  },
});

// Factory for mock assistant
const createMockAssistant = (overrides?: Partial<Assistant>): Assistant =>
  ({
    agentId: 'test-agent-1',
    userId: '1',
    organizationId: null,
    firstName: 'Test',
    surname: 'Assistant',
    age: 25,
    nationality: 'United States',
    timezone: 'UTC',
    about: 'A test assistant',
    voiceId: 'voice-1',
    voiceProvider: 'elevenlabs',
    email: null,
    phone: null,
    userPhone: null,
    userWhatsappNumber: null,
    assistantWhatsappNumber: null,
    phoneCountry: 'US',
    profilePhoto: null,
    profileVideo: null,
    signedProfilePhotoUrl: null,
    signedProfileVideoUrl: null,
    weeklyLimit: null,
    maxParallel: null,
    isUserDesktop: false,
    desktopMode: 'ubuntu',
    userDesktopMode: null,
    userDesktopUrl: null,
    userDesktopFilesysSync: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }) as Assistant;

describe('useAssistantContactManager', () => {
  let mockActions: AssistantActions;
  let mockAssistant: Assistant;
  let onSuccess: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockActions = createMockAssistantActions();
    mockAssistant = createMockAssistant();
    onSuccess = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  // ===========================================================================
  // Self-Contained Form Tests
  // These tests verify that the hook manages its own form state
  // ===========================================================================

  describe('Self-Contained Form', () => {
    it(
      'creates its own form and exposes contactFormMethods',
      {
        meta: {
          alias: 'ContactManager-OwnForm',
          scenario: 'Hook is initialized',
          behavior: 'Should expose contactFormMethods for component bindings',
        },
      },
      async () => {
        const { result } = renderHook(() =>
          useAssistantContactManager({
            assistant: mockAssistant,
            isOpen: true,
            assistantActions: mockActions,
            onSuccess,
          })
        );

        // Should expose form methods
        expect(result.current.contactFormMethods).toBeDefined();
        expect(result.current.contactFormMethods.register).toBeDefined();
        expect(result.current.contactFormMethods.setValue).toBeDefined();
        expect(result.current.contactFormMethods.getValues).toBeDefined();
        expect(result.current.contactFormMethods.watch).toBeDefined();
      }
    );

    it(
      'initializes form with values from assistant prop',
      {
        meta: {
          alias: 'ContactManager-InitFromAssistant',
          scenario: 'Assistant has existing email',
          behavior: 'Form should be initialized with assistant data',
        },
      },
      async () => {
        const assistantWithEmail = createMockAssistant({ email: 'existing@unify.ai' });

        const { result } = renderHook(() =>
          useAssistantContactManager({
            assistant: assistantWithEmail,
            isOpen: true,
            assistantActions: mockActions,
            onSuccess,
          })
        );

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });

        // Form should be initialized with assistant's email
        const email = result.current.contactFormMethods.getValues('email');
        expect(email).toBe('existing@unify.ai');
        expect(result.current.contactFormMethods.getValues('isEmailAdded')).toBe(true);
      }
    );

    it(
      'resets form when dialog opens with new assistant data',
      {
        meta: {
          alias: 'ContactManager-ResetOnOpen',
          scenario: 'Dialog opens with different assistant',
          behavior: 'Should reset form to match new assistant',
        },
      },
      async () => {
        const { result, rerender } = renderHook(
          ({ assistant, isOpen }) =>
            useAssistantContactManager({
              assistant,
              isOpen,
              assistantActions: mockActions,
              onSuccess,
            }),
          {
            initialProps: { assistant: mockAssistant, isOpen: false },
          }
        );

        // Form should have default values
        expect(result.current.contactFormMethods.getValues('email')).toBeNull();

        // Open with assistant that has email
        const assistantWithEmail = createMockAssistant({ email: 'new@unify.ai' });
        rerender({ assistant: assistantWithEmail, isOpen: true });

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });

        // Form should be reset with new assistant's data
        expect(result.current.contactFormMethods.getValues('email')).toBe('new@unify.ai');
      }
    );
  });

  // ===========================================================================
  // Data Fetching Responsibility Tests
  // These tests verify that the contact manager handles its own data fetching
  // ===========================================================================

  describe('Data Fetching Responsibility', () => {
    it(
      'fetches available phone countries when contact manager opens',
      {
        meta: {
          alias: 'ContactManager-FetchesPhoneCountries',
          scenario: 'Contact manager dialog opens',
          behavior: 'Should fetch phone countries list',
        },
      },
      async () => {
        const { result } = renderHook(() =>
          useAssistantContactManager({
            assistant: mockAssistant,
            isOpen: true,
            assistantActions: mockActions,
            onSuccess,
            initialTab: 'phone',
          })
        );

        await waitFor(() => {
          expect(mockActions.contact.listAvailablePhoneCountries).toHaveBeenCalled();
        });

        // Wait for state to update
        await waitFor(() => {
          expect(result.current.availablePhoneCountries.length).toBeGreaterThan(0);
        });
      }
    );

    it(
      'fetches assistant emails list when contact manager opens',
      {
        meta: {
          alias: 'ContactManager-FetchesEmails',
          scenario: 'Contact manager opens on email tab',
          behavior: 'Should fetch existing assistant emails for validation',
        },
      },
      async () => {
        const { result } = renderHook(() =>
          useAssistantContactManager({
            assistant: mockAssistant,
            isOpen: true,
            assistantActions: mockActions,
            onSuccess,
            initialTab: 'email',
          })
        );

        await waitFor(() => {
          expect(mockActions.contact.listAllAssistantEmails).toHaveBeenCalled();
        });

        expect(result.current.allAssistantEmails).toContain('existing@ora.ai');
      }
    );

    it(
      'fetches social platforms when contact manager opens',
      {
        meta: {
          alias: 'ContactManager-FetchesSocialPlatforms',
          scenario: 'Contact manager opens',
          behavior: 'Should fetch available social platforms for WhatsApp cost',
        },
      },
      async () => {
        const { result } = renderHook(() =>
          useAssistantContactManager({
            assistant: mockAssistant,
            isOpen: true,
            assistantActions: mockActions,
            onSuccess,
            initialTab: 'whatsapp',
          })
        );

        await waitFor(() => {
          expect(mockActions.contact.listAvailableSocialPlatforms).toHaveBeenCalled();
        });

        expect(result.current.availableSocialPlatforms).toHaveLength(1);
        expect(result.current.creationCost).toBe(5.0);
      }
    );

    it(
      'does NOT fetch data when dialog is closed',
      {
        meta: {
          alias: 'ContactManager-NoFetchWhenClosed',
          scenario: 'Dialog is not open',
          behavior: 'Should not make API calls when dialog is closed',
        },
      },
      async () => {
        renderHook(() =>
          useAssistantContactManager({
            assistant: mockAssistant,
            isOpen: false,
            assistantActions: mockActions,
            onSuccess,
          })
        );

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });

        expect(mockActions.contact.listAvailablePhoneCountries).not.toHaveBeenCalled();
        expect(mockActions.contact.listAllAssistantEmails).not.toHaveBeenCalled();
        expect(mockActions.contact.listAvailableSocialPlatforms).not.toHaveBeenCalled();
      }
    );
  });

  // ===========================================================================
  // Self-Contained Submission Tests
  // ===========================================================================

  describe('Self-Contained Submission', () => {
    it(
      'exposes submitContact method',
      {
        meta: {
          alias: 'ContactManager-SubmitMethod',
          scenario: 'Hook initialized',
          behavior: 'Should expose submitContact for self-contained updates',
        },
      },
      async () => {
        const { result } = renderHook(() =>
          useAssistantContactManager({
            assistant: mockAssistant,
            isOpen: true,
            assistantActions: mockActions,
            onSuccess,
          })
        );

        expect(result.current.submitContact).toBeDefined();
        expect(typeof result.current.submitContact).toBe('function');
        expect(result.current.isSubmittingContact).toBe(false);
      }
    );

    it(
      'submitContact calls assistant.update with email payload',
      {
        meta: {
          alias: 'ContactManager-SubmitEmail',
          scenario: 'User creates email and submits',
          behavior: 'Should call update API with ONLY email field',
        },
      },
      async () => {
        const { result } = renderHook(() =>
          useAssistantContactManager({
            assistant: mockAssistant,
            isOpen: true,
            assistantActions: mockActions,
            onSuccess,
            initialTab: 'email',
          })
        );

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });

        // Set up email data using the hook's form
        act(() => {
          result.current.contactFormMethods.setValue('email', 'newassistant@unify.ai');
          result.current.contactFormMethods.setValue('isEmailAdded', true);
        });

        await act(async () => {
          await result.current.submitContact();
        });

        // Verify assistant.update was called with only email-related payload
        expect(mockActions.assistant.update).toHaveBeenCalledWith(mockAssistant.agentId, {
          email: 'newassistant@unify.ai',
        });
      }
    );

    it(
      'submitContact calls assistant.update with phone payload',
      {
        meta: {
          alias: 'ContactManager-SubmitPhone',
          scenario: 'User verifies phone and submits',
          behavior: 'Should call update API with phone fields',
        },
      },
      async () => {
        const { result } = renderHook(() =>
          useAssistantContactManager({
            assistant: mockAssistant,
            isOpen: true,
            assistantActions: mockActions,
            onSuccess,
            initialTab: 'phone',
          })
        );

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });

        // Set up phone data
        act(() => {
          result.current.contactFormMethods.setValue('userPhone', '+15551234567');
          result.current.contactFormMethods.setValue('userPhoneIsVerified', true);
          result.current.contactFormMethods.setValue('isPhoneNumberAdded', true);
          result.current.contactFormMethods.setValue('phoneCountry', 'US');
        });

        // Switch to phone tab
        act(() => {
          result.current.setActiveTab('phone');
        });

        await act(async () => {
          await result.current.submitContact();
        });

        expect(mockActions.assistant.update).toHaveBeenCalledWith(mockAssistant.agentId, {
          userPhone: '+15551234567',
          phoneCountry: 'US',
        });
      }
    );

    it(
      'submitContact shows success toast on successful update',
      {
        meta: {
          alias: 'ContactManager-SuccessToast',
          scenario: 'Contact update succeeds',
          behavior: 'Should show success toast and call onSuccess',
        },
      },
      async () => {
        const { toast } = await import('sonner');

        const { result } = renderHook(() =>
          useAssistantContactManager({
            assistant: mockAssistant,
            isOpen: true,
            assistantActions: mockActions,
            onSuccess,
            initialTab: 'email',
          })
        );

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });

        act(() => {
          result.current.contactFormMethods.setValue('email', 'test@unify.ai');
          result.current.contactFormMethods.setValue('isEmailAdded', true);
        });

        await act(async () => {
          await result.current.submitContact();
        });

        expect(toast.success).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();
      }
    );

    it(
      'submitContact shows specific error message on failure',
      {
        meta: {
          alias: 'ContactManager-ErrorMessage',
          scenario: 'Backend returns error (e.g., email already exists)',
          behavior: 'Should show the specific backend error message',
        },
      },
      async () => {
        const { toast } = await import('sonner');

        const mockActionsWithError = createMockAssistantActions();
        mockActionsWithError.assistant.update = vi.fn().mockResolvedValue({
          detail: 'Email already exists in the system',
        });

        const { result } = renderHook(() =>
          useAssistantContactManager({
            assistant: mockAssistant,
            isOpen: true,
            assistantActions: mockActionsWithError,
            onSuccess,
            initialTab: 'email',
          })
        );

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });

        act(() => {
          result.current.contactFormMethods.setValue('email', 'taken@unify.ai');
          result.current.contactFormMethods.setValue('isEmailAdded', true);
        });

        await act(async () => {
          await result.current.submitContact();
        });

        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Email already exists'),
          expect.any(Object)
        );
      }
    );

    it(
      'submitContact validates phone is verified before submission',
      {
        meta: {
          alias: 'ContactManager-PhoneValidation',
          scenario: 'User tries to submit unverified phone',
          behavior: 'Should show error if phone is not verified',
        },
      },
      async () => {
        const { toast } = await import('sonner');

        const { result } = renderHook(() =>
          useAssistantContactManager({
            assistant: mockAssistant,
            isOpen: true,
            assistantActions: mockActions,
            onSuccess,
            initialTab: 'phone',
          })
        );

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });

        // Set phone but NOT verified
        act(() => {
          result.current.contactFormMethods.setValue('userPhone', '+15551234567');
          result.current.contactFormMethods.setValue('userPhoneIsVerified', false);
          result.current.contactFormMethods.setValue('isPhoneNumberAdded', true);
          result.current.setActiveTab('phone');
        });

        await act(async () => {
          await result.current.submitContact();
        });

        // Should show validation error
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('verified'),
          expect.any(Object)
        );
        // Should NOT call update
        expect(mockActions.assistant.update).not.toHaveBeenCalled();
      }
    );

    it(
      'tracks isSubmittingContact state during submission',
      {
        meta: {
          alias: 'ContactManager-SubmittingState',
          scenario: 'During contact submission',
          behavior: 'isSubmittingContact should be true during API call',
        },
      },
      async () => {
        // Make update take some time
        mockActions.assistant.update = vi
          .fn()
          .mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve({ info: 'ok' }), 100))
          );

        const { result } = renderHook(() =>
          useAssistantContactManager({
            assistant: mockAssistant,
            isOpen: true,
            assistantActions: mockActions,
            onSuccess,
            initialTab: 'email',
          })
        );

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });

        act(() => {
          result.current.contactFormMethods.setValue('email', 'test@unify.ai');
          result.current.contactFormMethods.setValue('isEmailAdded', true);
        });

        expect(result.current.isSubmittingContact).toBe(false);

        // Start submission (don't await)
        let submitPromise: Promise<void>;
        act(() => {
          submitPromise = result.current.submitContact();
        });

        // Should be submitting now
        expect(result.current.isSubmittingContact).toBe(true);

        // Wait for completion
        await act(async () => {
          await submitPromise;
        });

        expect(result.current.isSubmittingContact).toBe(false);
      }
    );
  });

  // ===========================================================================
  // UI State Tests
  // ===========================================================================

  describe('UI State Management', () => {
    it(
      'shows create button when assistant has no email',
      {
        meta: {
          alias: 'ContactManager-ShowCreateButton',
          scenario: 'Assistant has no email configured',
          behavior: 'showCreateButton should be true for email tab',
        },
      },
      async () => {
        const { result } = renderHook(() =>
          useAssistantContactManager({
            assistant: mockAssistant,
            isOpen: true,
            assistantActions: mockActions,
            onSuccess,
            initialTab: 'email',
          })
        );

        expect(result.current.showCreateButton).toBe(true);
        expect(result.current.showDeleteButton).toBe(false);
      }
    );

    it(
      'shows delete button when assistant has email',
      {
        meta: {
          alias: 'ContactManager-ShowDeleteButton',
          scenario: 'Assistant has existing email',
          behavior: 'showDeleteButton should be true for email tab',
        },
      },
      async () => {
        const assistantWithEmail = createMockAssistant({ email: 'existing@unify.ai' });

        const { result } = renderHook(() =>
          useAssistantContactManager({
            assistant: assistantWithEmail,
            isOpen: true,
            assistantActions: mockActions,
            onSuccess,
            initialTab: 'email',
          })
        );

        expect(result.current.showDeleteButton).toBe(true);
        expect(result.current.showCreateButton).toBe(false);
      }
    );
  });
});
