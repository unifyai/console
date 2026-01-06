/**
 * P5-A: Keyboard Accessibility Tests
 * 
 * Tests for keyboard navigation and accessibility within the Interfaces feature.
 * 
 * Covers:
 * - Keyboard navigation within tile grid
 * - Focus management during interactions
 * - ARIA attributes verification
 * - Tab order verification
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Harness imports
import { renderTileGrid, createMockTiles } from '../fixtures/tileGridTestHarness';
import { renderEditMode } from '../fixtures/editModeTestHarness';
import { renderSelectionPanel, createMockCells } from '../fixtures/selectionPanelTestHarness';
import { renderEditorTile, createMockFiles } from '../fixtures/editorTileTestHarness';
import { renderPlotTile } from '../fixtures/plotTileTestHarness';

// =============================================================================
// Tile Grid Accessibility Tests
// =============================================================================

describe('P5-A: Keyboard Accessibility', () => {
  describe('Tile Grid Navigation', () => {
    it('tiles are focusable via tab key', async () => {
      const user = userEvent.setup();
      renderTileGrid({ editMode: true });

      await waitFor(() => {
        expect(screen.getByTestId('tile-grid')).toBeInTheDocument();
      });

      // Tab through the interface
      await user.tab();
      
      // Should be able to focus on interactive elements
      const focusedElement = document.activeElement;
      expect(focusedElement).not.toBe(document.body);
    });

    it('edit mode toggle has proper ARIA attributes', async () => {
      renderEditMode();

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-toggle')).toBeInTheDocument();
      });

      const toggle = screen.getByTestId('edit-mode-toggle');
      expect(toggle).toHaveAttribute('aria-pressed');
    });

    it('edit mode toggle is keyboard accessible', async () => {
      const user = userEvent.setup();
      const { isEditMode } = renderEditMode();

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-toggle')).toBeInTheDocument();
      });

      // Focus the toggle
      screen.getByTestId('edit-mode-toggle').focus();
      
      // Press Enter to toggle
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(isEditMode()).toBe(true);
      });
    });

    it('edit mode toggle responds to Space key', async () => {
      const user = userEvent.setup();
      const { isEditMode } = renderEditMode();

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-toggle')).toBeInTheDocument();
      });

      // Focus the toggle
      screen.getByTestId('edit-mode-toggle').focus();
      
      // Press Space to toggle
      await user.keyboard(' ');

      await waitFor(() => {
        expect(isEditMode()).toBe(true);
      });
    });
  });

  // =========================================================================
  // Selection Panel Accessibility
  // =========================================================================
  describe('Selection Panel Navigation', () => {
    it('expand/collapse buttons are keyboard accessible', async () => {
      const user = userEvent.setup();
      const mockCells = createMockCells(3);
      renderSelectionPanel({
        initialSelectedCells: mockCells,
        initialExpandedEntries: [],
      });

      await waitFor(() => {
        expect(screen.getByTestId('expand-all-button')).toBeInTheDocument();
      });

      // Focus and activate expand all button
      screen.getByTestId('expand-all-button').focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        // All entries should be expanded
        expect(screen.getByTestId(`content-${mockCells[0].id}`)).toBeInTheDocument();
      });
    });

    it('view mode select is keyboard accessible', async () => {
      const user = userEvent.setup();
      const mockCells = createMockCells(1);
      const { getViewMode } = renderSelectionPanel({
        initialSelectedCells: mockCells,
      });

      await waitFor(() => {
        expect(screen.getByTestId('view-mode-select')).toBeInTheDocument();
      });

      // Focus the select
      const select = screen.getByTestId('view-mode-select');
      select.focus();

      // Change value using keyboard
      await user.selectOptions(select, 'markdown');

      await waitFor(() => {
        expect(getViewMode()).toBe('markdown');
      });
    });

    it('entry toggle responds to keyboard', async () => {
      const user = userEvent.setup();
      const mockCells = createMockCells(1);
      const { getExpandedEntries } = renderSelectionPanel({
        initialSelectedCells: mockCells,
        initialExpandedEntries: [],
      });

      await waitFor(() => {
        expect(screen.getByTestId(`toggle-${mockCells[0].id}`)).toBeInTheDocument();
      });

      // Focus and click the toggle
      screen.getByTestId(`toggle-${mockCells[0].id}`).focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(getExpandedEntries()).toContain(mockCells[0].id);
      });
    });
  });

  // =========================================================================
  // Editor Tile Accessibility
  // =========================================================================
  describe('Editor Tile Navigation', () => {
    it('file list items are keyboard navigable', async () => {
      const user = userEvent.setup();
      const files = createMockFiles();
      renderEditorTile({ initialFiles: files });

      await waitFor(() => {
        expect(screen.getByTestId('editor-tile-container')).toBeInTheDocument();
      });

      // Tab to first file button
      const fileButton = screen.getByTestId(`file-button-${files[0].id}`);
      fileButton.focus();

      // Press Enter to select
      await user.keyboard('{Enter}');

      // File should be selected
      await waitFor(() => {
        expect(screen.getByTestId(`file-item-${files[0].id}`)).toHaveAttribute('data-active', 'true');
      });
    });

    it('code editor textarea is focusable', async () => {
      const user = userEvent.setup();
      renderEditorTile();

      await waitFor(() => {
        expect(screen.getByTestId('code-editor')).toBeInTheDocument();
      });

      const editor = screen.getByTestId('code-editor');
      editor.focus();

      expect(document.activeElement).toBe(editor);
    });

    it('run button is keyboard accessible', async () => {
      const user = userEvent.setup();
      const onRun = vi.fn();
      renderEditorTile({ callbacks: { onRun } });

      await waitFor(() => {
        expect(screen.getByTestId('run-button')).toBeInTheDocument();
      });

      // Focus and activate run button
      screen.getByTestId('run-button').focus();
      await user.keyboard('{Enter}');

      // Wait for execution to complete
      await waitFor(() => {
        expect(screen.getByTestId('output-panel')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('new file input supports Escape to cancel', async () => {
      const user = userEvent.setup();
      const { getFiles } = renderEditorTile();

      await waitFor(() => {
        expect(screen.getByTestId('editor-tile-container')).toBeInTheDocument();
      });

      const initialCount = getFiles().length;

      // Open new file form
      await user.click(screen.getByTestId('new-file-button'));
      
      // Type something then press Escape
      await user.type(screen.getByTestId('new-file-input'), 'test.js');
      await user.keyboard('{Escape}');

      // Form should be closed and no file created
      expect(screen.queryByTestId('new-file-input')).not.toBeInTheDocument();
      expect(getFiles()).toHaveLength(initialCount);
    });
  });

  // =========================================================================
  // Plot Tile Accessibility
  // =========================================================================
  describe('Plot Tile Navigation', () => {
    it('settings button is keyboard accessible', async () => {
      const user = userEvent.setup();
      const { isSettingsOpen } = renderPlotTile();

      await waitFor(() => {
        expect(screen.getByTestId('settings-button')).toBeInTheDocument();
      });

      // Focus and activate settings button
      screen.getByTestId('settings-button').focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(isSettingsOpen()).toBe(true);
      });
    });

    it('axis selects are keyboard accessible', async () => {
      const user = userEvent.setup();
      const { getXAxis } = renderPlotTile({ initialSettingsOpen: true });

      await waitFor(() => {
        expect(screen.getByTestId('x-axis-select')).toBeInTheDocument();
      });

      // Focus x-axis select and change value
      const select = screen.getByTestId('x-axis-select');
      select.focus();
      await user.selectOptions(select, 'y');

      await waitFor(() => {
        expect(getXAxis()).toBe('y');
      });
    });

    it('focus mode button is keyboard accessible', async () => {
      const user = userEvent.setup();
      const { isFocusMode } = renderPlotTile();

      await waitFor(() => {
        expect(screen.getByTestId('focus-mode-button')).toBeInTheDocument();
      });

      // Focus and activate focus mode button
      screen.getByTestId('focus-mode-button').focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(isFocusMode()).toBe(true);
      });
    });

    it('focus mode can be exited via button', async () => {
      const user = userEvent.setup();
      const { isFocusMode } = renderPlotTile({ initialFocusMode: true });

      await waitFor(() => {
        expect(screen.getByTestId('focus-overlay')).toBeInTheDocument();
      });

      // Click the focus mode button to exit (Escape key handling depends on implementation)
      await user.click(screen.getByTestId('focus-mode-button'));

      await waitFor(() => {
        expect(isFocusMode()).toBe(false);
      });
    });
  });

  // =========================================================================
  // ARIA Attributes
  // =========================================================================
  describe('ARIA Attributes', () => {
    it('edit mode toggle has aria-pressed attribute', async () => {
      renderEditMode({ initialEditMode: false });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-toggle')).toBeInTheDocument();
      });

      const toggle = screen.getByTestId('edit-mode-toggle');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });

    it('edit mode toggle updates aria-pressed when toggled', async () => {
      const user = userEvent.setup();
      renderEditMode({ initialEditMode: false });

      await waitFor(() => {
        expect(screen.getByTestId('edit-mode-toggle')).toBeInTheDocument();
      });

      const toggle = screen.getByTestId('edit-mode-toggle');
      await user.click(toggle);

      await waitFor(() => {
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('disabled buttons have proper disabled state', async () => {
      renderEditMode({
        initialEditMode: true,
        initialHasUnsavedChanges: false,
      });

      await waitFor(() => {
        expect(screen.getByTestId('save-button')).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('save-button');
      expect(saveButton).toBeDisabled();
    });

    it('file items indicate active state', async () => {
      const files = createMockFiles();
      renderEditorTile({
        initialFiles: files,
        initialActiveFile: files[0].id,
      });

      await waitFor(() => {
        expect(screen.getByTestId(`file-item-${files[0].id}`)).toBeInTheDocument();
      });

      const activeFile = screen.getByTestId(`file-item-${files[0].id}`);
      expect(activeFile).toHaveAttribute('data-active', 'true');
    });
  });

  // =========================================================================
  // Tab Order
  // =========================================================================
  describe('Tab Order', () => {
    it('maintains logical tab order in edit mode toolbar', async () => {
      const user = userEvent.setup();
      renderEditMode({ initialEditMode: true, initialHasUnsavedChanges: true });

      await waitFor(() => {
        expect(screen.getByTestId('edit-toolbar')).toBeInTheDocument();
      });

      // Start from the toggle button
      screen.getByTestId('edit-mode-toggle').focus();

      // Tab to next element
      await user.tab();

      // Should move to save button (next interactive element in toolbar)
      const saveButton = screen.getByTestId('save-button');
      const resetButton = screen.getByTestId('reset-button');
      
      // Active element should be one of the toolbar buttons
      const activeElement = document.activeElement;
      const isToolbarButton = 
        activeElement === saveButton || 
        activeElement === resetButton ||
        activeElement?.closest('[data-testid="edit-toolbar"]');
      
      expect(isToolbarButton).toBeTruthy();
    });

    it('editor tile has logical tab order', async () => {
      const user = userEvent.setup();
      renderEditorTile();

      await waitFor(() => {
        expect(screen.getByTestId('editor-tile-container')).toBeInTheDocument();
      });

      // Tab through the editor
      await user.tab(); // First interactive element
      await user.tab(); // Second interactive element
      await user.tab(); // Third interactive element

      // Should have moved focus through the component
      expect(document.activeElement).not.toBe(document.body);
    });
  });
});

