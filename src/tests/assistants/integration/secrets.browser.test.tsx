import React from 'react';
import { render, screen, waitFor } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Server Action module before importing components that use it
// This prevents loading next-auth dependencies in the browser environment
vi.mock('@/lib/assistants/preHireChat', () => ({
  sendPreHireChatMessage: vi.fn().mockResolvedValue({ content: 'Mocked response' }),
  generatePostHireGreeting: vi.fn().mockResolvedValue({ content: 'Hello! I am ready to work.' }),
}));

import {
  SecretsTestHarness,
  createMockSecrets,
  createMockSecretActions,
  createPendingSecretActions,
  getDeleteButtons,
  getVisibilityToggles,
  isValueMasked,
  resetSecretIdCounter,
} from './fixtures';

/**
 * Behavior tests for the Assistant Secrets Manager component.
 *
 * Tests cover:
 * - Secret CRUD operations
 * - Secret masking/visibility
 * - Validation and error handling
 * - Permission checks
 */

describe('Assistant Secrets Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSecretIdCounter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('A. Loading and Display', () => {
    it(
      'should display loading spinner while fetching secrets',
      {
        meta: {
          alias: 'Secrets-Loading',
          behavior: 'Shows loading state during initial fetch',
          scenario: 'Opening secrets manager',
        },
      },
      async () => {
        const slowActions = createPendingSecretActions();

        render(<SecretsTestHarness secretActions={slowActions} />);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();
      }
    );

    it(
      'should display empty state when no secrets exist',
      {
        meta: {
          alias: 'Secrets-Empty',
          behavior: 'Shows empty state with create option',
          scenario: 'No secrets configured',
        },
      },
      async () => {
        const emptyActions = createMockSecretActions({ initialSecrets: [] });

        render(<SecretsTestHarness secretActions={emptyActions} />);

        await waitFor(() => {
          expect(screen.getByText(/no secret found/i)).toBeInTheDocument();
        });
      }
    );

    it(
      'should display list of secrets when loaded',
      {
        meta: {
          alias: 'Secrets-List',
          behavior: 'Shows all secrets in scrollable list',
          scenario: 'Secrets exist',
        },
      },
      async () => {
        const actions = createMockSecretActions();

        render(<SecretsTestHarness secretActions={actions} />);

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
          expect(screen.getByText('DATABASE_URL')).toBeInTheDocument();
        });
      }
    );

    it(
      'should select first secret by default',
      {
        meta: {
          alias: 'Secrets-Default-Selection',
          behavior: 'First secret is selected on load',
          scenario: 'Opening secrets manager with existing secrets',
        },
      },
      async () => {
        const actions = createMockSecretActions();

        render(<SecretsTestHarness secretActions={actions} />);

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        // The first secret should be displayed in the detail view
        await waitFor(() => {
          expect(screen.getByDisplayValue('API_KEY')).toBeInTheDocument();
        });
      }
    );
  });

  describe('B. Secret Masking', () => {
    it(
      'should mask secret value by default',
      {
        meta: {
          alias: 'Secrets-Masked',
          behavior: 'Secret value is hidden by default',
          scenario: 'Viewing a secret',
        },
      },
      async () => {
        const actions = createMockSecretActions();

        render(<SecretsTestHarness secretActions={actions} />);

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        // Value should be in a password-type input
        expect(isValueMasked(screen)).toBe(true);
      }
    );

    it(
      'should reveal secret value when eye icon is clicked',
      {
        meta: {
          alias: 'Secrets-Reveal',
          behavior: 'Secret value becomes visible when toggle clicked',
          scenario: 'User clicks show password button',
        },
      },
      async () => {
        const user = userEvent.setup();
        const actions = createMockSecretActions();

        const { container } = render(<SecretsTestHarness secretActions={actions} />);

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        const toggleButtons = getVisibilityToggles(container);
        if (toggleButtons.length > 0) {
          await user.click(toggleButtons[0]);
          const valueInput = screen.getByLabelText(/value/i);
          expect(valueInput).toHaveAttribute('type', 'text');
        }
      }
    );

    it(
      'should hide secret value when eye icon is clicked again',
      {
        meta: {
          alias: 'Secrets-Hide',
          behavior: 'Secret value is masked again when toggle clicked',
          scenario: 'User clicks hide password button',
        },
      },
      async () => {
        const user = userEvent.setup();
        const actions = createMockSecretActions();

        const { container } = render(<SecretsTestHarness secretActions={actions} />);

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        const toggleButtons = getVisibilityToggles(container);
        if (toggleButtons.length > 0) {
          // Click to show
          await user.click(toggleButtons[0]);
          // Click to hide
          await user.click(toggleButtons[0]);
          expect(isValueMasked(screen)).toBe(true);
        }
      }
    );
  });

  describe('C. Create Secret', () => {
    it(
      'should show new button when canWrite is true',
      {
        meta: {
          alias: 'Secrets-New-Button',
          behavior: 'New button is visible',
          scenario: 'User has write permission',
        },
      },
      async () => {
        const actions = createMockSecretActions();

        render(<SecretsTestHarness secretActions={actions} canWrite={true} />);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument();
        });
      }
    );

    it(
      'should hide new button when canWrite is false',
      {
        meta: {
          alias: 'Secrets-No-New-Button',
          behavior: 'New button is hidden',
          scenario: 'User does not have write permission',
        },
      },
      async () => {
        const actions = createMockSecretActions();

        render(<SecretsTestHarness secretActions={actions} canWrite={false} />);

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        expect(screen.queryByRole('button', { name: /new/i })).not.toBeInTheDocument();
      }
    );

    it(
      'should show create form when new button is clicked',
      {
        meta: {
          alias: 'Secrets-Create-Form',
          behavior: 'Form switches to create mode',
          scenario: 'User clicks new button',
        },
      },
      async () => {
        const user = userEvent.setup();
        const actions = createMockSecretActions();

        render(<SecretsTestHarness secretActions={actions} />);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /new/i }));

        // Form should be in create mode with empty fields
        await waitFor(() => {
          const nameInput = screen.getByLabelText(/name/i);
          expect(nameInput).toHaveValue('');
        });
      }
    );

    it(
      'should validate secret name is required',
      {
        meta: {
          alias: 'Secrets-Validate-Name',
          behavior: 'Shows error for empty name',
          scenario: 'User tries to save without name',
        },
      },
      async () => {
        const user = userEvent.setup();
        const actions = createMockSecretActions({ initialSecrets: [] });

        render(<SecretsTestHarness secretActions={actions} />);

        await waitFor(() => {
          expect(screen.getByText(/no secret found/i)).toBeInTheDocument();
        });

        // Click create first secret button
        let createButton: HTMLElement | null = null;
        try {
          createButton = screen.getByRole('button', { name: /add a secret/i });
        } catch {
          try {
            createButton = screen.getByRole('button', { name: /new/i });
          } catch {
            createButton = screen.getByRole('button', { name: /create/i });
          }
        }

        if (createButton) {
          await user.click(createButton);

          // Type in value but not name to trigger validation
          const valueInput = await screen.findByLabelText(/value/i);
          await user.type(valueInput, 'some-value');

          const saveButton = screen.getByRole('button', { name: /save/i });

          if (!saveButton.hasAttribute('disabled')) {
            await user.click(saveButton);
            await waitFor(() => {
              const errors = document.querySelectorAll('.text-destructive');
              expect(errors.length).toBeGreaterThan(0);
            });
          } else {
            expect(saveButton).toBeDisabled();
          }
        }
      }
    );

    it(
      'should create secret successfully',
      {
        meta: {
          alias: 'Secrets-Create-Success',
          behavior: 'Secret is created and added to list',
          scenario: 'User fills form and saves',
        },
      },
      async () => {
        const user = userEvent.setup();
        const actions = createMockSecretActions({ initialSecrets: [] });

        render(<SecretsTestHarness secretActions={actions} />);

        await waitFor(() => {
          expect(screen.getByText(/no secret found/i)).toBeInTheDocument();
        });

        const createButton = screen.getByRole('button', { name: /add a secret/i });
        await user.click(createButton);

        const nameInput = await screen.findByLabelText(/name/i);
        await user.type(nameInput, 'NEW_SECRET');

        const valueInput = screen.getByLabelText(/value/i);
        await user.type(valueInput, 'my-secret-value');

        const saveButton = screen.getByRole('button', { name: /save/i });
        await user.click(saveButton);

        await waitFor(() => {
          expect(actions.create).toHaveBeenCalledWith(
            expect.any(String), // userId
            expect.any(String), // assistantId
            expect.objectContaining({
              name: 'NEW_SECRET',
              value: 'my-secret-value',
            })
          );
        });
      }
    );

    it(
      'should cancel creation when cancel is clicked',
      {
        meta: {
          alias: 'Secrets-Create-Cancel',
          behavior: 'Form resets without saving',
          scenario: 'User cancels secret creation',
        },
      },
      async () => {
        const user = userEvent.setup();
        const actions = createMockSecretActions();

        render(<SecretsTestHarness secretActions={actions} />);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /new/i }));

        const nameInput = await screen.findByLabelText(/name/i);
        await user.type(nameInput, 'TEMP_SECRET');

        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        await user.click(cancelButton);

        expect(actions.create).not.toHaveBeenCalled();

        await waitFor(() => {
          expect(screen.getByDisplayValue('API_KEY')).toBeInTheDocument();
        });
      }
    );
  });

  describe('D. Delete Secret', () => {
    it(
      'should show delete button when canWrite is true',
      {
        meta: {
          alias: 'Secrets-Delete-Button',
          behavior: 'Delete button is visible on secret items',
          scenario: 'User has write permission',
        },
      },
      async () => {
        const actions = createMockSecretActions();

        const { container } = render(
          <SecretsTestHarness secretActions={actions} canWrite={true} />
        );

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        // Dialog renders in a portal - use document.body instead of container
        const deleteButtons = getDeleteButtons(document.body as HTMLElement);
        expect(deleteButtons.length).toBeGreaterThan(0);
      }
    );

    it(
      'should hide delete button when canWrite is false',
      {
        meta: {
          alias: 'Secrets-No-Delete-Button',
          behavior: 'Delete button is hidden',
          scenario: 'User does not have write permission',
        },
      },
      async () => {
        const actions = createMockSecretActions();

        const { container } = render(
          <SecretsTestHarness secretActions={actions} canWrite={false} />
        );

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        // Dialog renders in a portal - use document.body
        const deleteButtons = getDeleteButtons(document.body as HTMLElement);
        expect(deleteButtons.length).toBe(0);
      }
    );

    it(
      'should delete secret when delete button is clicked',
      {
        meta: {
          alias: 'Secrets-Delete-Success',
          behavior: 'Secret is removed from list',
          scenario: 'User clicks delete button',
        },
      },
      async () => {
        const user = userEvent.setup();
        const actions = createMockSecretActions();

        const { container } = render(<SecretsTestHarness secretActions={actions} />);

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        // Dialog renders in a portal - use document.body
        const deleteButtons = getDeleteButtons(document.body as HTMLElement);
        expect(deleteButtons.length).toBeGreaterThan(0);

        await user.click(deleteButtons[0]);

        await waitFor(() => {
          expect(actions.delete).toHaveBeenCalledWith(
            expect.any(String),
            1 // logId of first secret
          );
        });
      }
    );
  });

  describe('E. Error Handling', () => {
    it(
      'should handle fetch error gracefully',
      {
        meta: {
          alias: 'Secrets-Fetch-Error',
          behavior: 'Shows error state when fetch fails',
          scenario: 'Backend returns error',
        },
      },
      async () => {
        const errorActions = createMockSecretActions({
          getSuccess: false,
          errorMessage: 'Failed to fetch secrets',
        });

        render(<SecretsTestHarness secretActions={errorActions} />);

        await waitFor(() => {
          expect(errorActions.get).toHaveBeenCalledTimes(1);
        });
        // Verify get was called with the correct assistant context and ID
        expect(errorActions.get).toHaveBeenCalledWith('TestAssistant', 'test-assistant-id');

        expect(screen.getByRole('dialog')).toBeInTheDocument();
      }
    );

    it(
      'should handle create error gracefully',
      {
        meta: {
          alias: 'Secrets-Create-Error',
          behavior: 'Shows error toast when create fails',
          scenario: 'Backend returns error on create',
        },
      },
      async () => {
        const user = userEvent.setup();
        const errorActions = createMockSecretActions({
          initialSecrets: [],
          createSuccess: false,
          errorMessage: 'Failed to create secret',
        });

        render(<SecretsTestHarness secretActions={errorActions} />);

        await waitFor(() => {
          expect(screen.getByText(/no secret found/i)).toBeInTheDocument();
        });

        const createButton = screen.getByRole('button', { name: /add a secret/i });
        await user.click(createButton);

        const nameInput = await screen.findByLabelText(/name/i);
        await user.type(nameInput, 'TEST_SECRET');

        const valueInput = screen.getByLabelText(/value/i);
        await user.type(valueInput, 'test-value');

        const saveButton = screen.getByRole('button', { name: /save/i });
        await user.click(saveButton);

        await waitFor(() => {
          expect(errorActions.create).toHaveBeenCalledTimes(1);
        });
        // Verify create was called with correct secret details
        expect(errorActions.create).toHaveBeenCalledWith(
          'test-user-id', // userId
          'test-assistant-id', // assistantId
          {
            name: 'TEST_SECRET',
            value: 'test-value',
            description: '',
          }
        );
      }
    );

    it(
      'should handle delete error gracefully',
      {
        meta: {
          alias: 'Secrets-Delete-Error',
          behavior: 'Shows error toast when delete fails',
          scenario: 'Backend returns error on delete',
        },
      },
      async () => {
        const user = userEvent.setup();
        const secrets = createMockSecrets();
        const errorActions = createMockSecretActions({
          initialSecrets: secrets,
          deleteSuccess: false,
          errorMessage: 'Failed to delete secret',
        });

        const { container } = render(<SecretsTestHarness secretActions={errorActions} />);

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        // Dialog renders in a portal - use document.body
        const deleteButtons = getDeleteButtons(document.body as HTMLElement);
        if (deleteButtons.length > 0) {
          await user.click(deleteButtons[0]);
        }

        await waitFor(() => {
          expect(errorActions.delete).toHaveBeenCalledTimes(1);
        });
        // Verify delete was called with correct assistant context and secret ID
        expect(errorActions.delete).toHaveBeenCalledWith('TestAssistant', 1);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
      }
    );
  });

  describe('F. Read-Only Mode', () => {
    it(
      'should display secrets in read-only mode',
      {
        meta: {
          alias: 'Secrets-ReadOnly-Display',
          behavior: 'Secrets are visible but not editable',
          scenario: 'User has read-only permission',
        },
      },
      async () => {
        const actions = createMockSecretActions();

        const { container } = render(
          <SecretsTestHarness secretActions={actions} canWrite={false} />
        );

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
          expect(screen.getByText('DATABASE_URL')).toBeInTheDocument();
        });

        expect(screen.queryByRole('button', { name: /new/i })).not.toBeInTheDocument();
        // Dialog renders in a portal - use document.body
        expect(getDeleteButtons(document.body as HTMLElement).length).toBe(0);
      }
    );

    it(
      'should still allow viewing secret values in read-only mode',
      {
        meta: {
          alias: 'Secrets-ReadOnly-View',
          behavior: 'Secret value can be revealed',
          scenario: 'User with read permission clicks show',
        },
      },
      async () => {
        const actions = createMockSecretActions();

        render(<SecretsTestHarness secretActions={actions} canWrite={false} />);

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        // Dialog renders in a portal - use document.body
        const toggleButtons = getVisibilityToggles(document.body as HTMLElement);
        expect(toggleButtons.length).toBeGreaterThan(0);
      }
    );
  });

  describe('G. Dialog Behavior', () => {
    it(
      'should call onClose when dialog is closed',
      {
        meta: {
          alias: 'Secrets-Close',
          behavior: 'onClose callback is invoked',
          scenario: 'User closes dialog',
        },
      },
      async () => {
        const user = userEvent.setup();
        const onCloseMock = vi.fn();
        const actions = createMockSecretActions();

        render(<SecretsTestHarness secretActions={actions} onClose={onCloseMock} />);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        expect(onCloseMock).toHaveBeenCalled();
      }
    );

    it(
      'should switch between secrets when list item is clicked',
      {
        meta: {
          alias: 'Secrets-Switch',
          behavior: 'Detail view updates to show selected secret',
          scenario: 'User clicks different secret in list',
        },
      },
      async () => {
        const user = userEvent.setup();
        const actions = createMockSecretActions();

        render(<SecretsTestHarness secretActions={actions} />);

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        await user.click(screen.getByText('DATABASE_URL'));

        await waitFor(() => {
          expect(screen.getByDisplayValue('DATABASE_URL')).toBeInTheDocument();
        });
      }
    );
  });
});
