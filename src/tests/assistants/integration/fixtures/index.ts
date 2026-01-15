/**
 * Test Harnesses Index
 *
 * Re-exports all test harnesses and utilities for convenient imports.
 *
 * @example
 * ```tsx
 * import {
 *   ChatTestHarness,
 *   setupChatMocks,
 *   createMockTask,
 *   SecretsTestHarness,
 * } from '../fixtures';
 * ```
 */

// Chat Test Harness
export {
  // Mocks
  ControllableMockEventSource,
  ControllableMockBroadcastChannel,
  // Setup/Teardown
  setupChatMocks,
  cleanupChatMocks,
  // Factories
  createMockChatActions,
  createMockChatMessage,
  createMockChatHistory,
  resetMessageIdCounter,
  // Component
  ChatTestHarness,
  // Query Helpers
  getChatBubbles,
  getChatInput,
  getSendButton,
  // Types
  type MockChatActionsOptions,
  type ChatTestHarnessProps,
} from './chatTestHarness';

// Call Test Harness
export {
  // LiveKit Mocks
  MockLocalParticipant,
  MockRoom,
  getMockRoom,
  resetMockRoom,
  // Setup
  setupCallMocks,
  setupWorkspaceMock,
  setLiveKitTrackState,
  clearLiveKitTrackState,
  // Component
  CallTestHarness,
  // Helpers
  getTargetAssistant,
  openProfileAndGetCallButton,
  getCallControls,
  // Types
  type LiveKitTrackState,
  type CallTestHarnessProps,
} from './callTestHarness';

// Profile Test Harness
export {
  // Mock Data
  defaultMockVoices,
  // Factories
  createMockProfileState,
  createMockProfileActions,
  // Component
  ProfileTestHarness,
  // Query Helpers
  getProfileFields,
  getProfileButtons,
  getProfileStatus,
  // Validation Helpers
  hasValidationError,
  getValidationErrors,
  // Interaction Helpers
  fillProfileField,
  submitProfileForm,
  enterEditMode,
  cancelEditMode,
  // Types
  type MockProfileState,
  type MockProfileActionsOptions,
  type ProfileTestHarnessProps,
} from './profileTestHarness';

// Secrets Test Harness
export {
  // Factories
  createMockSecret,
  createMockSecrets,
  resetSecretIdCounter,
  createMockSecretActions,
  createPendingSecretActions,
  // Component
  SecretsTestHarness,
  // Query Helpers
  getSecretsList,
  getSecretFormFields,
  getSecretButtons,
  getDeleteButtons,
  getVisibilityToggles,
  // Interaction Helpers
  createSecretViaUI,
  deleteSecretViaUI,
  toggleSecretVisibility,
  isValueMasked,
  // Types
  type MockSecretActionsOptions,
  type SecretsTestHarnessProps,
} from './secretsTestHarness';

// Tasks Test Harness
export {
  // Re-export enums
  Status,
  Priority,
  // Factories
  createMockTask,
  createMockTasks,
  resetTaskIdCounter,
  createMockTaskActions,
  createPendingTaskActions,
  // Components
  TaskTestHarness,
  TasksListTestHarness,
  // Query Helpers
  getTaskElements,
  getTaskEditControls,
  getStatusBadge,
  getPriorityIndicator,
  // Styling Verification
  statusVariantMap,
  priorityClassMap,
  hasPriorityStyling,
  // Interaction Helpers
  editTaskDescription,
  saveTaskChanges,
  discardTaskChanges,
  toggleTaskExpansion,
  // Types
  type MockTaskActionsOptions,
  type TaskTestHarnessProps,
  type TasksListTestHarnessProps,
} from './tasksTestHarness';
