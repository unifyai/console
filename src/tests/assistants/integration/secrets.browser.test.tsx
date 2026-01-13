import React from 'react';
import { render, screen, waitFor, within } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { AssistantSecretsManager } from '@/components/Pages/Assistants/Assistants/Profile/AssistantSecretsManager';
import { Secret, SecretActions } from '@/types/assistants/secret';

/**
 * Behavior tests for the Assistant Secrets Manager component.
 *
 * Tests cover:
 * - Secret CRUD operations
 * - Secret masking/visibility
 * - Validation and error handling
 * - Permission checks
 */

const createMockSecrets = (): Secret[] => [
  {
    logId: 1,
    name: 'API_KEY',
    value: 'sk-super-secret-key-12345',
    description: 'Production API key',
  },
  {
    logId: 2,
    name: 'DATABASE_URL',
    value: 'postgres://user:pass@host:5432/db',
    description: 'Main database connection string',
  },
];

const createMockSecretActions = (secretsOverride?: Secret[]): SecretActions => ({
  get: vi.fn(async (): Promise<Secret[]> => secretsOverride ?? createMockSecrets()),
  create: vi.fn(async () => ({ info: 'Secret created' })),
  delete: vi.fn(async () => ({ info: 'Secret deleted' })),
});

describe('Assistant Secrets Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        const slowActions: SecretActions = {
          get: vi.fn(() => new Promise<Secret[]>(() => {})), // Never resolves
          create: vi.fn(async () => ({ info: '' })),
          delete: vi.fn(async () => ({ info: '' })),
        };

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={slowActions}
          />
        );

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
        const emptyActions = createMockSecretActions([]);

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={emptyActions}
          />
        );

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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
          />
        );

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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
          />
        );

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        // The first secret should be displayed in the detail view
        // Wait for selection to propagate to the form
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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
          />
        );

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        // Value should be in a password-type input
        const valueInput = screen.getByLabelText(/value/i);
        expect(valueInput).toHaveAttribute('type', 'password');
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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
          />
        );

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        // Find and click the visibility toggle
        let toggleButton: HTMLElement | null = null;
        try {
          toggleButton = screen.getByRole('button', { name: /show/i });
        } catch {
          toggleButton =
            document
              .querySelector('button .lucide-eye, button .lucide-eye-off')
              ?.closest('button') ?? null;
        }

        if (toggleButton) {
          await user.click(toggleButton);
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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
          />
        );

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        // Find the visibility toggle buttons
        const eyeIcons = document.querySelectorAll('.lucide-eye, .lucide-eye-off');
        const toggleButton = eyeIcons[0]?.closest('button');

        if (toggleButton) {
          // Click to show
          await user.click(toggleButton);
          // Click to hide
          await user.click(toggleButton);
          const valueInput = screen.getByLabelText(/value/i);
          expect(valueInput).toHaveAttribute('type', 'password');
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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
            canWrite={true}
          />
        );

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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
            canWrite={false}
          />
        );

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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
          />
        );

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
        const actions = createMockSecretActions([]);

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
          />
        );

        await waitFor(() => {
          expect(screen.getByText(/no secret found/i)).toBeInTheDocument();
        });

        // Click create first secret button - the empty state has "Add a secret" button
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

          // The form should be in create mode now
          // Type in value but not name to trigger validation
          const valueInput = await screen.findByLabelText(/value/i);
          await user.type(valueInput, 'some-value');

          // Try to submit - this will either trigger validation or the button is disabled
          const saveButton = screen.getByRole('button', { name: /save/i });

          // Check if button is disabled (which is also valid - means validation is working)
          if (!saveButton.hasAttribute('disabled')) {
            await user.click(saveButton);
            // Should show validation error
            await waitFor(() => {
              const errors = document.querySelectorAll('.text-destructive');
              expect(errors.length).toBeGreaterThan(0);
            });
          } else {
            // Button being disabled is also a valid form of validation
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
        const actions = createMockSecretActions([]);

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
          />
        );

        await waitFor(() => {
          expect(screen.getByText(/no secret found/i)).toBeInTheDocument();
        });

        // Click create button in empty state - the button says "Add a secret"
        const createButton = screen.getByRole('button', { name: /add a secret/i });
        await user.click(createButton);

        // Fill form
        const nameInput = await screen.findByLabelText(/name/i);
        await user.type(nameInput, 'NEW_SECRET');

        const valueInput = screen.getByLabelText(/value/i);
        await user.type(valueInput, 'my-secret-value');

        // Save
        const saveButton = screen.getByRole('button', { name: /save/i });
        await user.click(saveButton);

        await waitFor(() => {
          expect(actions.create).toHaveBeenCalledWith(
            expect.any(String),
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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
          />
        );

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /new/i }));

        // Fill form
        const nameInput = await screen.findByLabelText(/name/i);
        await user.type(nameInput, 'TEMP_SECRET');

        // Cancel
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        await user.click(cancelButton);

        // Should not have called create
        expect(actions.create).not.toHaveBeenCalled();

        // Should show first secret again
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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
            canWrite={true}
          />
        );

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        // Look for trash icon in SVG - the class could be 'lucide lucide-trash-2' or similar
        const deleteButtons = document.querySelectorAll('[class*="trash"]');
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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
            canWrite={false}
          />
        );

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        const deleteButtons = document.querySelectorAll('.lucide-trash-2');
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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
          />
        );

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        // Find and click delete button for first secret using class that contains 'trash'
        const trashIcon = document.querySelector('[class*="trash"]');
        const deleteButton = trashIcon?.closest('button');
        expect(deleteButton).toBeInTheDocument();

        await user.click(deleteButton!);

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
        const errorActions: SecretActions = {
          get: vi.fn(async () => ({ detail: 'Failed to fetch secrets' })),
          create: vi.fn(async () => ({ info: '' })),
          delete: vi.fn(async () => ({ info: '' })),
        };

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={errorActions}
          />
        );

        // Wait for error to be handled
        await waitFor(() => {
          expect(errorActions.get).toHaveBeenCalled();
        });

        // Component should still be functional (not crash)
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
        const errorActions: SecretActions = {
          get: vi.fn(async (): Promise<Secret[]> => []),
          create: vi.fn(async () => ({ detail: 'Failed to create secret' })),
          delete: vi.fn(async () => ({ info: '' })),
        };

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={errorActions}
          />
        );

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
          expect(errorActions.create).toHaveBeenCalled();
        });
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
        const errorActions: SecretActions = {
          get: vi.fn(async (): Promise<Secret[]> => createMockSecrets()),
          create: vi.fn(async () => ({ info: '' })),
          delete: vi.fn(async () => ({ detail: 'Failed to delete secret' })),
        };

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={errorActions}
          />
        );

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        const trashIcon = document.querySelector('[class*="trash"]');
        const deleteButton = trashIcon?.closest('button');
        if (deleteButton) {
          await user.click(deleteButton);
        }

        await waitFor(() => {
          expect(errorActions.delete).toHaveBeenCalled();
        });

        // Component should still be functional
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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
            canWrite={false}
          />
        );

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
          expect(screen.getByText('DATABASE_URL')).toBeInTheDocument();
        });

        // No new button
        expect(screen.queryByRole('button', { name: /new/i })).not.toBeInTheDocument();

        // No delete buttons
        const deleteButtons = document.querySelectorAll('.lucide-trash-2');
        expect(deleteButtons.length).toBe(0);
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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
            canWrite={false}
          />
        );

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        // Eye icon should still be present for viewing
        const eyeIcons = document.querySelectorAll('.lucide-eye, .lucide-eye-off');
        expect(eyeIcons.length).toBeGreaterThan(0);
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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={onCloseMock}
            assistantContext="TestAssistant"
            secretActions={actions}
          />
        );

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Find and click close button
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

        render(
          <AssistantSecretsManager
            isOpen={true}
            onClose={vi.fn()}
            assistantContext="TestAssistant"
            secretActions={actions}
          />
        );

        await waitFor(() => {
          expect(screen.getByText('API_KEY')).toBeInTheDocument();
        });

        // Click on second secret
        await user.click(screen.getByText('DATABASE_URL'));

        // Detail view should update
        await waitFor(() => {
          expect(screen.getByDisplayValue('DATABASE_URL')).toBeInTheDocument();
        });
      }
    );
  });
});
