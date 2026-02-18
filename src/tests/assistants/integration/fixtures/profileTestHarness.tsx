/**
 * Profile Test Harness
 *
 * Provides reusable test utilities and wrapper components
 * for testing assistant profile viewing and editing functionality.
 *
 * @example
 * ```tsx
 * import { ProfileTestHarness, createMockProfileState } from './fixtures/profileTestHarness';
 *
 * render(
 *   <ProfileTestHarness
 *     assistant={createMockAssistant({ firstName: 'Jane' })}
 *     canEdit={true}
 *   />
 * );
 * ```
 */
import * as React from 'react';
import { vi } from 'vitest';
import { AssistantProfilePanel } from '@/components/Pages/Assistants/Assistants/Profile/AssistantProfile';
import { createMockAssistant } from '../../mocks/data';
import { mockAssistantActions } from '../../mocks/actions';
import { AssistantActions, Assistant, VoiceOption } from '@/types/assistants/assistant';
import { ChatMessage } from '@/types/assistants/chat';

// =============================================================================
// MOCK VOICE OPTIONS
// =============================================================================

export const defaultMockVoices: VoiceOption[] = [
  {
    voiceId: 'voice_1',
    name: 'Alice (US)',
    description: 'Friendly American female',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
    isPreset: true,
    isUserVoiceInOrchestra: false,
  },
  {
    voiceId: 'voice_2',
    name: 'Bob (UK)',
    description: 'Professional British male',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
    isPreset: true,
    isUserVoiceInOrchestra: false,
  },
  {
    voiceId: 'voice_3',
    name: 'Speedy (OpenAI)',
    description: 'Low latency voice',
    gender: 'male',
    language: 'en',
    provider: 'openai',
    isPreset: true,
    isUserVoiceInOrchestra: false,
  },
];

// =============================================================================
// PROFILE STATE FACTORY
// =============================================================================

export interface MockProfileState {
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  validationErrors: Record<string, string>;
}

/**
 * Create a mock profile state object.
 */
export function createMockProfileState(
  overrides: Partial<MockProfileState> = {}
): MockProfileState {
  return {
    isEditing: false,
    hasUnsavedChanges: false,
    validationErrors: {},
    ...overrides,
  };
}

// =============================================================================
// PROFILE ACTIONS FACTORY
// =============================================================================

export interface MockProfileActionsOptions {
  /** Whether updates should succeed (default: true) */
  updateSuccess?: boolean;
  /** Custom update response */
  updateResponse?: { info?: string; detail?: string };
  /** Whether delete should succeed (default: true) */
  deleteSuccess?: boolean;
  /** Custom voice list */
  voices?: VoiceOption[];
}

/**
 * Create mock assistant actions for profile tests.
 */
export function createMockProfileActions(options: MockProfileActionsOptions = {}) {
  const {
    updateSuccess = true,
    updateResponse,
    deleteSuccess = true,
    voices = defaultMockVoices,
  } = options;

  const updateFn = vi.fn(async () => {
    if (updateResponse) return updateResponse;
    if (updateSuccess) return { info: 'Assistant updated successfully' };
    return { detail: 'Failed to update assistant' };
  });

  const deleteFn = vi.fn(async () => {
    if (deleteSuccess) return { info: 'Assistant deleted successfully' };
    return { detail: 'Failed to delete assistant' };
  });

  return {
    ...mockAssistantActions,
    assistant: {
      ...mockAssistantActions.assistant,
      update: updateFn,
      delete: deleteFn,
    },
    voice: {
      ...mockAssistantActions.voice,
      list: vi.fn(async () => voices),
    },
  };
}

// =============================================================================
// PROFILE TEST WRAPPER COMPONENT
// =============================================================================

export interface ProfileTestHarnessProps {
  /** The assistant to display */
  assistant?: Assistant;
  /** Override specific assistant actions */
  assistantActionsOverride?: Partial<AssistantActions>;
  /** Whether the user can edit this assistant */
  canEdit?: boolean;
  /** Initial chat histories */
  chatHistories?: Record<string, ChatMessage[]>;
  /** User email for context */
  userEmail?: string;
  /** Callback when close is clicked */
  onClose?: () => void;
  /** Callback when edit mode is toggled */
  onEdit?: () => void;
  /** Callback when contact manager is opened */
  onOpenContactManager?: () => void;
  /** Callback when call is started */
  onStartCall?: () => void;
  /** Whether a call is currently active */
  isCallConnected?: boolean;
  /** Whether a call is connecting */
  isConnectingCall?: boolean;
  /** The assistant ID of the active call */
  activeCallAssistantId?: string | null;
}

/**
 * Test wrapper component for profile functionality.
 * Provides all necessary context and state management.
 */
export function ProfileTestHarness({
  assistant,
  assistantActionsOverride = {},
  chatHistories: initialChatHistories = {},
  userEmail = 'test@example.com',
  onClose,
  onEdit,
  onOpenContactManager,
  onStartCall,
  isCallConnected = false,
  isConnectingCall = false,
  activeCallAssistantId = null,
}: ProfileTestHarnessProps) {
  const defaultAssistant = React.useMemo(
    () =>
      createMockAssistant({
        firstName: 'Test',
        surname: 'Assistant',
        agentId: 'test-assistant-id',
      }),
    []
  );

  const activeAssistant = assistant || defaultAssistant;

  const actions = React.useMemo(
    () => ({
      ...mockAssistantActions,
      ...assistantActionsOverride,
    }),
    [assistantActionsOverride]
  );

  const [chatHistories, setChatHistories] =
    React.useState<Record<string, ChatMessage[]>>(initialChatHistories);

  return (
    <AssistantProfilePanel
      assistant={activeAssistant}
      assistantActions={actions}
      onClose={onClose ?? vi.fn()}
      onEdit={onEdit ?? vi.fn()}
      onOpenContactManager={onOpenContactManager ?? vi.fn()}
      chatHistories={chatHistories}
      setChatHistories={setChatHistories}
      userEmail={userEmail}
      onStartCall={onStartCall ?? vi.fn()}
      activeCallAssistantId={activeCallAssistantId}
      isCallConnected={isCallConnected}
      isConnectingCall={isConnectingCall}
    />
  );
}

// =============================================================================
// QUERY HELPERS
// =============================================================================

/**
 * Get profile form fields.
 */
export function getProfileFields(screen: {
  queryByLabelText: (text: string | RegExp) => HTMLElement | null;
  queryByPlaceholderText: (text: string | RegExp) => HTMLElement | null;
}) {
  return {
    firstName: screen.queryByLabelText(/first name/i) as HTMLInputElement | null,
    surname: screen.queryByLabelText(/surname|last name/i) as HTMLInputElement | null,
    about: screen.queryByPlaceholderText(/about|description/i) as HTMLTextAreaElement | null,
    weeklyLimit: screen.queryByLabelText(/weekly limit|hours/i) as HTMLInputElement | null,
  };
}

/**
 * Get profile action buttons.
 */
export function getProfileButtons(screen: {
  queryByRole: (role: string, options?: { name?: string | RegExp }) => HTMLElement | null;
}) {
  return {
    editButton: screen.queryByRole('button', { name: /edit/i }),
    saveButton: screen.queryByRole('button', { name: /save/i }),
    cancelButton: screen.queryByRole('button', { name: /cancel/i }),
    deleteButton: screen.queryByRole('button', { name: /delete/i }),
    closeButton: screen.queryByRole('button', { name: /close/i }),
  };
}

/**
 * Get profile status indicators.
 */
export function getProfileStatus(container: HTMLElement) {
  return {
    statusBadge: container.querySelector('[data-testid="status-badge"]'),
    loadingSpinner: container.querySelector('.animate-spin'),
    errorMessage: container.querySelector('.text-destructive'),
  };
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Check if a field has a validation error.
 */
export function hasValidationError(container: HTMLElement, fieldName: string): boolean {
  const errorElements = container.querySelectorAll('.text-destructive');
  return Array.from(errorElements).some(
    (el) =>
      el.textContent?.toLowerCase().includes(fieldName.toLowerCase()) ||
      el.closest(`[data-field="${fieldName}"]`) !== null
  );
}

/**
 * Get all validation error messages.
 */
export function getValidationErrors(container: HTMLElement): string[] {
  const errorElements = container.querySelectorAll('.text-destructive');
  return Array.from(errorElements)
    .map((el) => el.textContent)
    .filter((text): text is string => text !== null);
}

// =============================================================================
// FORM INTERACTION HELPERS
// =============================================================================

/**
 * Fill a profile form field.
 */
export async function fillProfileField(
  user: {
    clear: (el: HTMLElement) => Promise<void>;
    type: (el: HTMLElement, text: string) => Promise<void>;
  },
  field: HTMLInputElement | HTMLTextAreaElement | null,
  value: string
) {
  if (!field) return;
  await user.clear(field);
  await user.type(field, value);
}

/**
 * Submit the profile form.
 */
export async function submitProfileForm(
  user: { click: (el: HTMLElement) => Promise<void> },
  screen: { getByRole: (role: string, options?: { name?: string | RegExp }) => HTMLElement }
) {
  const saveButton = screen.getByRole('button', { name: /save/i });
  await user.click(saveButton);
}

/**
 * Enter edit mode.
 */
export async function enterEditMode(
  user: { click: (el: HTMLElement) => Promise<void> },
  screen: { getByRole: (role: string, options?: { name?: string | RegExp }) => HTMLElement }
) {
  const editButton = screen.getByRole('button', { name: /edit/i });
  await user.click(editButton);
}

/**
 * Cancel edit mode.
 */
export async function cancelEditMode(
  user: { click: (el: HTMLElement) => Promise<void> },
  screen: { getByRole: (role: string, options?: { name?: string | RegExp }) => HTMLElement }
) {
  const cancelButton = screen.getByRole('button', { name: /cancel/i });
  await user.click(cancelButton);
}
