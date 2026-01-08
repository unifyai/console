/**
 * P2-E: Edit Mode Behavior Tests
 *
 * Tests edit mode interactions including toggle, save, reset,
 * and unsaved changes detection.
 *
 * Covers behaviors from BEHAVIORS.md:
 * - E1: Toggle edit mode
 * - E2: Unsaved changes indicator
 * - E3: Unsaved changes warning
 * - E4: Save changes
 * - E5: Reset changes
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderEditMode } from '../fixtures/editModeTestHarness';

// =============================================================================
// P2-E: Edit Mode
// =============================================================================

describe('P2-E: Edit Mode', () => {
  // =========================================================================
  // E1: Toggle edit mode
  // =========================================================================
  describe('E1: Toggle edit mode', () => {
    it('starts in non-edit mode by default', async () => {
      const { isEditMode } = renderEditMode();

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      expect(isEditMode()).toBe(false);
      expect(screen.getByTestId('edit-mode-toggle')).toHaveAttribute('aria-pressed', 'false');
    });

    it('clicking edit button enables edit mode', async () => {
      const user = userEvent.setup();
      const onToggleEditMode = vi.fn();
      const { isEditMode } = renderEditMode({
        callbacks: { onToggleEditMode },
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('edit-mode-toggle'));

      await waitFor(() => {
        expect(isEditMode()).toBe(true);
      });

      // Callback is called without arguments - tests should query isEditMode() for the new state
      expect(onToggleEditMode).toHaveBeenCalled();
      expect(screen.getByTestId('edit-mode-toggle')).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows drag handles on tiles when in edit mode', async () => {
      const user = userEvent.setup();
      renderEditMode({ tileCount: 3 });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      // No drag handles initially
      expect(screen.queryByTestId('drag-handle-1')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('edit-mode-toggle'));

      await waitFor(() => {
        expect(screen.getByTestId('drag-handle-1')).toBeInTheDocument();
        expect(screen.getByTestId('drag-handle-2')).toBeInTheDocument();
        expect(screen.getByTestId('drag-handle-3')).toBeInTheDocument();
      });
    });

    it('clicking edit button again disables edit mode', async () => {
      const user = userEvent.setup();
      const { isEditMode } = renderEditMode({ initialEditMode: true });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      expect(isEditMode()).toBe(true);

      await user.click(screen.getByTestId('edit-mode-toggle'));

      await waitFor(() => {
        expect(isEditMode()).toBe(false);
      });
    });

    it('shows save and reset buttons only in edit mode', async () => {
      const user = userEvent.setup();
      renderEditMode();

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      // Not visible initially
      expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reset-button')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('edit-mode-toggle'));

      await waitFor(() => {
        expect(screen.getByTestId('save-button')).toBeInTheDocument();
        expect(screen.getByTestId('reset-button')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // E2: Unsaved changes indicator
  // =========================================================================
  describe('E2: Unsaved changes indicator', () => {
    it('shows indicator when changes are made', async () => {
      const user = userEvent.setup();
      const { hasUnsavedChanges } = renderEditMode({ initialEditMode: true });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      expect(hasUnsavedChanges()).toBe(false);
      expect(screen.queryByTestId('unsaved-indicator')).not.toBeInTheDocument();

      // Make a change
      await user.click(screen.getByTestId('change-tile-1'));

      await waitFor(() => {
        expect(hasUnsavedChanges()).toBe(true);
        expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument();
      });
    });

    it('indicator shows correct text', async () => {
      renderEditMode({ initialEditMode: true, initialHasUnsavedChanges: true });

      await waitFor(() => {
        expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument();
      });

      expect(screen.getByTestId('unsaved-indicator')).toHaveTextContent('Unsaved changes');
    });

    it('indicator disappears after save', async () => {
      const user = userEvent.setup();
      const { hasUnsavedChanges } = renderEditMode({ initialEditMode: true });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      // Make a change
      await user.click(screen.getByTestId('change-tile-1'));

      await waitFor(() => {
        expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument();
      });

      // Save
      await user.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(hasUnsavedChanges()).toBe(false);
        expect(screen.queryByTestId('unsaved-indicator')).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // E3: Unsaved changes warning
  // =========================================================================
  describe('E3: Unsaved changes warning', () => {
    it('shows warning dialog when navigating with unsaved changes', async () => {
      const { attemptNavigate } = renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      attemptNavigate();

      await waitFor(() => {
        expect(screen.getByTestId('navigate-warning-dialog')).toBeInTheDocument();
      });
    });

    it('warning dialog has save, discard, and stay options', async () => {
      const { attemptNavigate } = renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      attemptNavigate();

      await waitFor(() => {
        expect(screen.getByTestId('navigate-cancel')).toBeInTheDocument();
        expect(screen.getByTestId('navigate-discard')).toBeInTheDocument();
        expect(screen.getByTestId('navigate-save')).toBeInTheDocument();
      });
    });

    it('clicking Stay closes the dialog', async () => {
      const user = userEvent.setup();
      const { attemptNavigate } = renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      attemptNavigate();

      await waitFor(() => {
        expect(screen.getByTestId('navigate-warning-dialog')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('navigate-cancel'));

      await waitFor(() => {
        expect(screen.queryByTestId('navigate-warning-dialog')).not.toBeInTheDocument();
      });
    });

    it('no warning when navigating without unsaved changes', async () => {
      const { attemptNavigate } = renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: false,
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      const canNavigate = attemptNavigate();

      expect(canNavigate).toBe(true);
      expect(screen.queryByTestId('navigate-warning-dialog')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // E4: Save changes
  // =========================================================================
  describe('E4: Save changes', () => {
    it('clicking save button saves changes', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { hasUnsavedChanges } = renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: true,
        callbacks: { onSave },
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
        expect(hasUnsavedChanges()).toBe(false);
      });
    });

    it('shows loading state during save', async () => {
      const user = userEvent.setup();
      let resolvePromise: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const onSave = vi.fn().mockReturnValue(savePromise);

      const { isSaving } = renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: true,
        callbacks: { onSave },
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(isSaving()).toBe(true);
        expect(screen.getByTestId('save-button')).toHaveTextContent('Saving...');
      });

      resolvePromise!();

      await waitFor(() => {
        expect(isSaving()).toBe(false);
      });
    });

    it('shows success message after save', async () => {
      const user = userEvent.setup();
      renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: true,
        saveSucceeds: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(screen.getByTestId('save-success')).toBeInTheDocument();
      });
    });

    it('shows error message when save fails', async () => {
      const user = userEvent.setup();
      renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: true,
        saveSucceeds: false,
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(screen.getByTestId('save-error')).toBeInTheDocument();
      });
    });

    it('save button is disabled when no changes', async () => {
      renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: false,
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      expect(screen.getByTestId('save-button')).toBeDisabled();
    });
  });

  // =========================================================================
  // E5: Reset changes
  // =========================================================================
  describe('E5: Reset changes', () => {
    it('clicking reset shows confirmation dialog', async () => {
      const user = userEvent.setup();
      renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('reset-button'));

      await waitFor(() => {
        expect(screen.getByTestId('reset-confirm-dialog')).toBeInTheDocument();
      });
    });

    it('confirming reset clears changes', async () => {
      const user = userEvent.setup();
      const onReset = vi.fn();
      const { hasUnsavedChanges } = renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: true,
        callbacks: { onReset },
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('reset-button'));

      await waitFor(() => {
        expect(screen.getByTestId('reset-confirm-dialog')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('reset-confirm'));

      await waitFor(() => {
        expect(hasUnsavedChanges()).toBe(false);
        expect(onReset).toHaveBeenCalled();
        expect(screen.queryByTestId('reset-confirm-dialog')).not.toBeInTheDocument();
      });
    });

    it('canceling reset keeps changes', async () => {
      const user = userEvent.setup();
      const { hasUnsavedChanges } = renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('reset-button'));

      await waitFor(() => {
        expect(screen.getByTestId('reset-confirm-dialog')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('reset-cancel'));

      await waitFor(() => {
        expect(hasUnsavedChanges()).toBe(true);
        expect(screen.queryByTestId('reset-confirm-dialog')).not.toBeInTheDocument();
      });
    });

    it('reset button is disabled when no changes', async () => {
      renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: false,
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      expect(screen.getByTestId('reset-button')).toBeDisabled();
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('Edge cases', () => {
    it('respects initial edit mode state', async () => {
      const { isEditMode } = renderEditMode({ initialEditMode: true });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      expect(isEditMode()).toBe(true);
      expect(screen.getByTestId('save-button')).toBeInTheDocument();
    });

    it('respects initial unsaved changes state', async () => {
      const { hasUnsavedChanges } = renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      expect(hasUnsavedChanges()).toBe(true);
      expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument();
    });

    it('handles multiple changes correctly', async () => {
      const user = userEvent.setup();
      const { hasUnsavedChanges } = renderEditMode({ initialEditMode: true });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('change-tile-1'));
      await user.click(screen.getByTestId('change-tile-2'));
      await user.click(screen.getByTestId('change-tile-3'));

      expect(hasUnsavedChanges()).toBe(true);
    });
  });

  // =========================================================================
  // Error Handling
  // =========================================================================
  describe('Error handling', () => {
    it('shows error message when save fails', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockRejectedValue(new Error('Network error'));

      renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: true,
        saveSucceeds: false,
        callbacks: { onSave },
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(screen.getByTestId('save-error')).toBeInTheDocument();
      });
    });

    it('preserves unsaved changes when save fails', async () => {
      const user = userEvent.setup();
      const { hasUnsavedChanges } = renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: true,
        saveSucceeds: false,
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(screen.getByTestId('save-error')).toBeInTheDocument();
      });

      // Changes should still be marked as unsaved
      expect(hasUnsavedChanges()).toBe(true);
    });

    it('re-enables save button after failed save', async () => {
      const user = userEvent.setup();
      renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: true,
        saveSucceeds: false,
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(screen.getByTestId('save-error')).toBeInTheDocument();
      });

      // Save button should be re-enabled to allow retry
      expect(screen.getByTestId('save-button')).not.toBeDisabled();
    });

    it('handles rapid toggle clicks gracefully', async () => {
      const user = userEvent.setup();
      const { isEditMode } = renderEditMode();

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      // Rapidly toggle edit mode
      const toggleButton = screen.getByTestId('edit-mode-toggle');
      await user.click(toggleButton);
      await user.click(toggleButton);
      await user.click(toggleButton);

      // Should end up in edit mode (odd number of clicks)
      await waitFor(() => {
        expect(isEditMode()).toBe(true);
      });
    });

    it('handles save during rapid changes', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { hasUnsavedChanges } = renderEditMode({
        initialEditMode: true,
        callbacks: { onSave },
      });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-container')).toBeInTheDocument();
      });

      // Make changes and save quickly
      await user.click(screen.getByTestId('change-tile-1'));
      await user.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(hasUnsavedChanges()).toBe(false);
      });
    });
  });
});
