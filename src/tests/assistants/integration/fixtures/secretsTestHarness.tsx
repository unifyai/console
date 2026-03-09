/**
 * Secrets Test Harness
 *
 * Provides reusable test utilities and wrapper components
 * for testing the Assistant Secrets Manager component.
 *
 * @example
 * ```tsx
 * import {
 *   SecretsTestHarness,
 *   createMockSecrets,
 *   createMockSecretActions
 * } from './fixtures/secretsTestHarness';
 *
 * const secrets = createMockSecrets();
 * const actions = createMockSecretActions(secrets);
 *
 * render(<SecretsTestHarness secretActions={actions} canWrite={true} />);
 * ```
 */
import * as React from 'react';
import { vi } from 'vitest';
import { AssistantSecretsManager } from '@/components/Pages/Assistants/Assistants/Profile/AssistantSecretsManager';
import { Secret, SecretActions } from '@/types/assistants/secret';

// =============================================================================
// MOCK SECRET FACTORIES
// =============================================================================

let secretIdCounter = 1;

/**
 * Create a mock secret.
 */
export function createMockSecret(overrides: Partial<Secret> = {}): Secret {
  const id = secretIdCounter++;
  return {
    logId: id,
    name: `SECRET_${id}`,
    value: `secret-value-${id}-${Math.random().toString(36).slice(2)}`,
    description: `Description for secret ${id}`,
    ...overrides,
  };
}

/**
 * Create multiple mock secrets.
 */
export function createMockSecrets(count: number = 2): Secret[] {
  return Array.from({ length: count }, (_, i) =>
    createMockSecret({
      logId: i + 1,
      name: i === 0 ? 'API_KEY' : i === 1 ? 'DATABASE_URL' : `SECRET_${i + 1}`,
      value:
        i === 0
          ? 'sk-super-secret-key-12345'
          : i === 1
            ? 'postgres://user:pass@host:5432/db'
            : `secret-value-${i + 1}`,
      description:
        i === 0
          ? 'Production API key'
          : i === 1
            ? 'Main database connection string'
            : `Description ${i + 1}`,
    })
  );
}

/**
 * Reset the secret ID counter (call in beforeEach for consistent IDs).
 */
export function resetSecretIdCounter() {
  secretIdCounter = 1;
}

// =============================================================================
// MOCK SECRET ACTIONS FACTORY
// =============================================================================

export interface MockSecretActionsOptions {
  /** Initial secrets to return from get() */
  initialSecrets?: Secret[];
  /** Whether get should succeed (default: true) */
  getSuccess?: boolean;
  /** Whether create should succeed (default: true) */
  createSuccess?: boolean;
  /** Whether delete should succeed (default: true) */
  deleteSuccess?: boolean;
  /** Custom error message for failures */
  errorMessage?: string;
  /** Delay for async operations in ms */
  delay?: number;
}

/**
 * Create mock secret actions with configurable behavior.
 */
export function createMockSecretActions(options: MockSecretActionsOptions = {}): SecretActions {
  const {
    initialSecrets,
    getSuccess = true,
    createSuccess = true,
    deleteSuccess = true,
    errorMessage = 'Operation failed',
    delay = 0,
  } = options;

  const secrets = initialSecrets ?? createMockSecrets();

  const maybeDelay = async () => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  };

  return {
    get: vi.fn(async (_assistantId: string): Promise<Secret[] | { detail: string }> => {
      await maybeDelay();
      if (!getSuccess) return { detail: errorMessage };
      return secrets;
    }),
    create: vi.fn(
      async (
        _assistantId: string,
        _secret: { name: string; value: string; description?: string }
      ): Promise<{ info?: string; detail?: string }> => {
        await maybeDelay();
        if (!createSuccess) return { detail: errorMessage };
        return { info: 'Secret created' };
      }
    ),
    delete: vi.fn(
      async (_assistantId: string, _logId: number): Promise<{ info?: string; detail?: string }> => {
        await maybeDelay();
        if (!deleteSuccess) return { detail: errorMessage };
        return { info: 'Secret deleted' };
      }
    ),
  };
}

/**
 * Create secret actions that never resolve (for loading state tests).
 */
export function createPendingSecretActions(): SecretActions {
  return {
    get: vi.fn((_assistantId: string) => new Promise<Secret[]>(() => {})), // Never resolves
    create: vi.fn(() => new Promise<{ info: string }>(() => {})),
    delete: vi.fn(() => new Promise<{ info: string }>(() => {})),
  };
}

// =============================================================================
// SECRETS TEST WRAPPER COMPONENT
// =============================================================================

export interface SecretsTestHarnessProps {
  /** Whether the dialog is open */
  isOpen?: boolean;
  /** Callback when dialog is closed */
  onClose?: () => void;
  /** User ID for security filtering */
  userId?: string;
  /** Assistant ID for security filtering */
  assistantId?: string;
  /** Secret actions implementation */
  secretActions?: SecretActions;
  /** Whether the user can write (create/delete) secrets */
  canWrite?: boolean;
}

/**
 * Test wrapper component for secrets manager.
 */
export function SecretsTestHarness({
  isOpen = true,
  onClose,
  userId = 'test-user-id',
  assistantId = 'test-assistant-id',
  secretActions,
  canWrite = true,
}: SecretsTestHarnessProps) {
  const actions = secretActions ?? createMockSecretActions();

  return (
    <AssistantSecretsManager
      isOpen={isOpen}
      onClose={onClose ?? vi.fn()}
      assistantId={assistantId}
      secretActions={actions}
      canWrite={canWrite}
    />
  );
}

// =============================================================================
// QUERY HELPERS
// =============================================================================

/**
 * Get secrets list elements.
 */
export function getSecretsList(screen: {
  queryAllByRole: (role: string) => HTMLElement[];
  queryByText: (text: string | RegExp) => HTMLElement | null;
}) {
  return {
    listItems: screen.queryAllByRole('listitem'),
    emptyState: screen.queryByText(/no secret found/i),
  };
}

/**
 * Get secret form fields.
 */
export function getSecretFormFields(screen: {
  queryByLabelText: (text: string | RegExp) => HTMLElement | null;
}) {
  return {
    nameInput: screen.queryByLabelText(/name/i) as HTMLInputElement | null,
    valueInput: screen.queryByLabelText(/value/i) as HTMLInputElement | null,
    descriptionInput: screen.queryByLabelText(/description/i) as HTMLTextAreaElement | null,
  };
}

/**
 * Get secret action buttons.
 */
export function getSecretButtons(screen: {
  queryByRole: (role: string, options?: { name?: string | RegExp }) => HTMLElement | null;
}) {
  return {
    newButton: screen.queryByRole('button', { name: /new/i }),
    saveButton: screen.queryByRole('button', { name: /save/i }),
    cancelButton: screen.queryByRole('button', { name: /cancel/i }),
    closeButton: screen.queryByRole('button', { name: /close/i }),
    addSecretButton: screen.queryByRole('button', { name: /add a secret/i }),
  };
}

/**
 * Find delete buttons for secrets.
 * Delete buttons are icon buttons in the secrets list (left panel with border-r).
 * They're next to secret name spans within clickable divs.
 */
export function getDeleteButtons(container: HTMLElement): HTMLButtonElement[] {
  // The secrets list is in a div with "border-r" class (left panel)
  // Delete buttons are siblings to spans containing secret names
  const deleteButtons: HTMLButtonElement[] = [];

  // Find all divs that contain secret names (they have a span.truncate with the name)
  const secretRows = container.querySelectorAll('[class*="cursor-pointer"]');

  secretRows.forEach((row) => {
    // Look for buttons with SVG inside this row
    const button = row.querySelector('button');
    if (button && button.querySelector('svg')) {
      deleteButtons.push(button as HTMLButtonElement);
    }
  });

  return deleteButtons;
}

/**
 * Find visibility toggle buttons.
 */
export function getVisibilityToggles(container: HTMLElement): HTMLButtonElement[] {
  const eyeIcons = container.querySelectorAll('.lucide-eye, .lucide-eye-off');
  return Array.from(eyeIcons)
    .map((icon) => icon.closest('button'))
    .filter((btn): btn is HTMLButtonElement => btn !== null);
}

// =============================================================================
// INTERACTION HELPERS
// =============================================================================

/**
 * Create a new secret through the UI.
 */
export async function createSecretViaUI(
  user: {
    click: (el: HTMLElement) => Promise<void>;
    type: (el: HTMLElement, text: string) => Promise<void>;
  },
  screen: {
    getByRole: (role: string, options?: { name?: string | RegExp }) => HTMLElement;
    getByLabelText: (text: string | RegExp) => HTMLElement;
    findByLabelText: (text: string | RegExp) => Promise<HTMLElement>;
  },
  secret: { name: string; value: string; description?: string }
) {
  // Click new button or add secret button
  let createButton: HTMLElement;
  try {
    createButton = screen.getByRole('button', { name: /new/i });
  } catch {
    createButton = screen.getByRole('button', { name: /add a secret/i });
  }
  await user.click(createButton);

  // Fill form
  const nameInput = await screen.findByLabelText(/name/i);
  await user.type(nameInput, secret.name);

  const valueInput = screen.getByLabelText(/value/i);
  await user.type(valueInput, secret.value);

  if (secret.description) {
    const descInput = screen.getByLabelText(/description/i);
    await user.type(descInput, secret.description);
  }

  // Save
  const saveButton = screen.getByRole('button', { name: /save/i });
  await user.click(saveButton);
}

/**
 * Delete a secret through the UI.
 */
export async function deleteSecretViaUI(
  user: { click: (el: HTMLElement) => Promise<void> },
  container: HTMLElement,
  secretIndex: number = 0
) {
  const deleteButtons = getDeleteButtons(container);
  if (deleteButtons[secretIndex]) {
    await user.click(deleteButtons[secretIndex]);
  }
}

/**
 * Toggle secret visibility.
 */
export async function toggleSecretVisibility(
  user: { click: (el: HTMLElement) => Promise<void> },
  container: HTMLElement
) {
  const toggleButtons = getVisibilityToggles(container);
  if (toggleButtons[0]) {
    await user.click(toggleButtons[0]);
  }
}

/**
 * Check if the value input is currently masked (password type).
 */
export function isValueMasked(screen: {
  queryByLabelText: (text: string | RegExp) => HTMLElement | null;
}): boolean {
  const valueInput = screen.queryByLabelText(/value/i) as HTMLInputElement | null;
  return valueInput?.type === 'password';
}
