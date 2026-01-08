/**
 * P4: Project Selection Behavior Tests
 *
 * Tests behaviors L1-L5 from BEHAVIORS.md:
 * - L1: List projects
 * - L2: Select project
 * - L3: Create project
 * - L4: Search projects
 * - L5: Delete project
 *
 * Uses the REAL ProjectPicker component from:
 * @/components/Pages/Interfaces/Interface/Nav/ProjectPicker
 */

import { describe, it, expect, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  renderProjectSelection,
  ProjectSelectionTestResult,
} from '../fixtures/projectSelectionTestHarness';

describe('P4-L: Project Selection (Real ProjectPicker)', () => {
  let result: ProjectSelectionTestResult;

  afterEach(() => {
    result?.unmount();
  });

  // ==========================================================================
  // L1: List Projects
  // ==========================================================================
  describe('L1: List projects', () => {
    it('displays all projects in the dropdown', async () => {
      result = renderProjectSelection({
        initialProjects: [
          { id: 'p1', name: 'Alpha Project' },
          { id: 'p2', name: 'Beta Project' },
          { id: 'p3', name: 'Gamma Project' },
        ],
      });

      // Open the picker
      await result.openProjectPicker();

      // All projects should be visible
      await waitFor(() => {
        const visibleProjects = result.getVisibleProjects();
        expect(visibleProjects).toContain('Alpha Project');
        expect(visibleProjects).toContain('Beta Project');
        expect(visibleProjects).toContain('Gamma Project');
      });
    });

    it('shows project picker trigger button', async () => {
      result = renderProjectSelection({
        initialProjects: [{ id: 'p1', name: 'Test Project' }],
      });

      expect(screen.getByTestId('project-picker-trigger')).toBeInTheDocument();
    });

    it('shows empty state when no projects exist', async () => {
      result = renderProjectSelection({
        initialProjects: [],
      });

      await result.openProjectPicker();

      await waitFor(() => {
        expect(result.isEmpty()).toBe(true);
      });
    });

    it('shows selected project name in trigger', async () => {
      result = renderProjectSelection({
        initialProjects: [{ id: 'p1', name: 'Selected Project' }],
        activeProjectId: 'Selected Project',
      });

      const trigger = screen.getByTestId('project-picker-trigger');
      expect(trigger.textContent).toContain('Selected Project');
    });

    it('shows "Select project" when none selected', async () => {
      result = renderProjectSelection({
        initialProjects: [{ id: 'p1', name: 'Available' }],
        activeProjectId: null,
      });

      const trigger = screen.getByTestId('project-picker-trigger');
      expect(trigger.textContent).toContain('Select project');
    });
  });

  // ==========================================================================
  // L2: Select Project
  // ==========================================================================
  describe('L2: Select project', () => {
    it('can select a project by clicking', async () => {
      result = renderProjectSelection({
        initialProjects: [
          { id: 'p1', name: 'My Project' },
          { id: 'p2', name: 'Other Project' },
        ],
      });

      // Initially no project selected
      expect(result.getActiveProject()).toBeNull();

      // Click to select
      await result.clickProject('My Project');

      // Project should be selected
      await waitFor(() => {
        expect(result.getActiveProject()).toBe('My Project');
      });
    });

    it('closes picker after selection', async () => {
      result = renderProjectSelection({
        initialProjects: [{ id: 'p1', name: 'Test Project' }],
      });

      await result.clickProject('Test Project');

      await waitFor(() => {
        expect(result.isPickerOpen()).toBe(false);
      });
    });

    it('updates trigger to show selected project', async () => {
      result = renderProjectSelection({
        initialProjects: [{ id: 'p1', name: 'Selected Project' }],
      });

      await result.clickProject('Selected Project');

      await waitFor(() => {
        const trigger = screen.getByTestId('project-picker-trigger');
        expect(trigger.textContent).toContain('Selected Project');
      });
    });

    it('can change selection to a different project', async () => {
      result = renderProjectSelection({
        initialProjects: [
          { id: 'p1', name: 'First' },
          { id: 'p2', name: 'Second' },
        ],
        activeProjectId: 'First',
      });

      // Initially first is selected
      expect(result.getActiveProject()).toBe('First');

      // Select second
      await result.clickProject('Second');

      await waitFor(() => {
        expect(result.getActiveProject()).toBe('Second');
      });
    });

    it('programmatic selection works', async () => {
      result = renderProjectSelection({
        initialProjects: [{ id: 'p1', name: 'Programmatic' }],
      });

      await result.selectProject('Programmatic');

      expect(result.getActiveProject()).toBe('Programmatic');
    });

    it('updates active project display after selection', async () => {
      result = renderProjectSelection({
        initialProjects: [{ id: 'p1', name: 'Selected Project' }],
      });

      await result.clickProject('Selected Project');

      await waitFor(() => {
        expect(screen.getByTestId('active-project-display')).toBeInTheDocument();
        expect(screen.getByTestId('active-project-display').textContent).toContain(
          'Selected Project'
        );
      });
    });
  });

  // ==========================================================================
  // L3: Create Project
  // ==========================================================================
  describe('L3: Create project', () => {
    it('shows create project button', async () => {
      result = renderProjectSelection();

      expect(screen.getByTestId('create-project-button')).toBeInTheDocument();
    });

    it('opens create dialog when button clicked', async () => {
      result = renderProjectSelection();

      await result.clickCreateButton();

      expect(screen.getByTestId('create-project-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('new-project-name-input')).toBeInTheDocument();
    });

    it('can create a new project', async () => {
      result = renderProjectSelection({
        initialProjects: [],
      });

      const user = userEvent.setup();

      // Open dialog
      await result.clickCreateButton();

      // Enter name
      const input = screen.getByTestId('new-project-name-input');
      await user.type(input, 'Brand New Project');

      // Submit
      await user.click(screen.getByTestId('create-project-submit'));

      // Project should exist
      await waitFor(() => {
        expect(result.getProjects()).toContain('Brand New Project');
      });
    });

    it('new project becomes active after creation', async () => {
      result = renderProjectSelection({
        initialProjects: [{ id: 'p1', name: 'Existing' }],
      });

      const user = userEvent.setup();

      await result.clickCreateButton();
      await user.type(screen.getByTestId('new-project-name-input'), 'New Active');
      await user.click(screen.getByTestId('create-project-submit'));

      await waitFor(() => {
        expect(result.getActiveProject()).toBe('New Active');
      });
    });

    it('can cancel project creation', async () => {
      result = renderProjectSelection({
        initialProjects: [],
      });

      const user = userEvent.setup();

      await result.clickCreateButton();
      await user.type(screen.getByTestId('new-project-name-input'), 'Cancelled');
      await user.click(screen.getByTestId('create-project-cancel'));

      // Dialog should close
      expect(screen.queryByTestId('create-project-dialog')).not.toBeInTheDocument();
      // Project should not exist
      expect(result.getProjects()).not.toContain('Cancelled');
    });

    it('new project appears in picker dropdown', async () => {
      result = renderProjectSelection({
        initialProjects: [{ id: 'p1', name: 'Existing' }],
      });

      await result.createProject('Created Project');

      // Open picker to see new project
      await result.openProjectPicker();

      await waitFor(() => {
        const visible = result.getVisibleProjects();
        expect(visible).toContain('Created Project');
      });
    });
  });

  // ==========================================================================
  // L4: Search Projects
  // ==========================================================================
  describe('L4: Search projects', () => {
    it('shows search input in picker', async () => {
      result = renderProjectSelection();

      await result.openProjectPicker();

      expect(screen.getByTestId('project-search-input')).toBeInTheDocument();
    });

    it('filters projects by search query', async () => {
      result = renderProjectSelection({
        initialProjects: [
          { id: 'p1', name: 'Alpha Project' },
          { id: 'p2', name: 'Beta Project' },
          { id: 'p3', name: 'Gamma Project' },
        ],
      });

      await result.searchProjects('Alpha');

      await waitFor(() => {
        const visible = result.getVisibleProjects();
        expect(visible).toContain('Alpha Project');
        expect(visible).not.toContain('Beta Project');
        expect(visible).not.toContain('Gamma Project');
      });
    });

    it('search is case-insensitive', async () => {
      result = renderProjectSelection({
        initialProjects: [
          { id: 'p1', name: 'MyProject' },
          { id: 'p2', name: 'Other' },
        ],
      });

      await result.searchProjects('myproject');

      await waitFor(() => {
        const visible = result.getVisibleProjects();
        expect(visible).toContain('MyProject');
        expect(visible).not.toContain('Other');
      });
    });

    it('clearing search shows all projects', async () => {
      result = renderProjectSelection({
        initialProjects: [
          { id: 'p1', name: 'Alpha' },
          { id: 'p2', name: 'Beta' },
        ],
      });

      // Search to filter
      await result.searchProjects('Alpha');

      await waitFor(() => {
        expect(result.getVisibleProjects()).toHaveLength(1);
      });

      // Clear search
      await result.searchProjects('');

      await waitFor(() => {
        expect(result.getVisibleProjects()).toHaveLength(2);
      });
    });

    it('partial match works', async () => {
      result = renderProjectSelection({
        initialProjects: [
          { id: 'p1', name: 'Production-US' },
          { id: 'p2', name: 'Production-EU' },
          { id: 'p3', name: 'Staging' },
        ],
      });

      await result.searchProjects('Prod');

      await waitFor(() => {
        const visible = result.getVisibleProjects();
        expect(visible).toContain('Production-US');
        expect(visible).toContain('Production-EU');
        expect(visible).not.toContain('Staging');
      });
    });
  });

  // ==========================================================================
  // L5: Delete Project
  // ==========================================================================
  describe('L5: Delete project', () => {
    it('opens confirmation dialog when delete clicked', async () => {
      result = renderProjectSelection({
        initialProjects: [{ id: 'p1', name: 'To Delete' }],
      });

      await result.clickDeleteButton('To Delete');

      expect(result.isDeleteDialogOpen()).toBe(true);
      expect(screen.getByTestId('delete-project-dialog')).toBeInTheDocument();
    });

    it('shows project name in delete confirmation', async () => {
      result = renderProjectSelection({
        initialProjects: [{ id: 'p1', name: 'Important Project' }],
      });

      await result.clickDeleteButton('Important Project');

      expect(screen.getByTestId('delete-project-dialog').textContent).toContain(
        'Important Project'
      );
    });

    it('can confirm deletion', async () => {
      result = renderProjectSelection({
        initialProjects: [
          { id: 'p1', name: 'Keep Me' },
          { id: 'p2', name: 'Delete Me' },
        ],
      });

      await result.clickDeleteButton('Delete Me');
      await result.confirmDelete();

      await waitFor(() => {
        expect(result.getProjects()).not.toContain('Delete Me');
        expect(result.getProjects()).toContain('Keep Me');
      });
    });

    it('can cancel deletion', async () => {
      result = renderProjectSelection({
        initialProjects: [{ id: 'p1', name: 'Almost Deleted' }],
      });

      await result.clickDeleteButton('Almost Deleted');
      await result.cancelDelete();

      // Dialog should close
      expect(result.isDeleteDialogOpen()).toBe(false);
      // Project should still exist
      expect(result.getProjects()).toContain('Almost Deleted');
    });

    it('deleting active project clears selection', async () => {
      result = renderProjectSelection({
        initialProjects: [
          { id: 'p1', name: 'Active One' },
          { id: 'p2', name: 'Other' },
        ],
        activeProjectId: 'Active One',
      });

      expect(result.getActiveProject()).toBe('Active One');

      await result.clickDeleteButton('Active One');
      await result.confirmDelete();

      await waitFor(() => {
        expect(result.getActiveProject()).toBeNull();
      });
    });

    it('programmatic deletion works', async () => {
      result = renderProjectSelection({
        initialProjects: [{ id: 'p1', name: 'Programmatic Delete' }],
      });

      await result.deleteProject('Programmatic Delete');

      expect(result.getProjects()).not.toContain('Programmatic Delete');
    });

    it('deleted project removed from picker', async () => {
      result = renderProjectSelection({
        initialProjects: [
          { id: 'p1', name: 'Visible' },
          { id: 'p2', name: 'Gone' },
        ],
      });

      await result.clickDeleteButton('Gone');
      await result.confirmDelete();

      // Open picker to verify
      await result.openProjectPicker();

      await waitFor(() => {
        const visible = result.getVisibleProjects();
        expect(visible).not.toContain('Gone');
        expect(visible).toContain('Visible');
      });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('handles projects with special characters in names', async () => {
      result = renderProjectSelection({
        initialProjects: [
          { id: 'p1', name: 'Project (v2.0)' },
          { id: 'p2', name: 'Test & Debug' },
        ],
      });

      await result.openProjectPicker();

      await waitFor(() => {
        const visible = result.getVisibleProjects();
        expect(visible).toContain('Project (v2.0)');
        expect(visible).toContain('Test & Debug');
      });
    });

    it('handles many projects', async () => {
      const manyProjects = Array.from({ length: 50 }, (_, i) => ({
        id: `p${i}`,
        name: `Project ${i.toString().padStart(2, '0')}`,
      }));

      result = renderProjectSelection({
        initialProjects: manyProjects,
      });

      expect(result.getProjects()).toHaveLength(50);
    });

    it('picker can be opened and closed', async () => {
      result = renderProjectSelection({
        initialProjects: [{ id: 'p1', name: 'Test' }],
      });

      // Open
      await result.openProjectPicker();
      expect(result.isPickerOpen()).toBe(true);

      // Close
      await result.closeProjectPicker();

      await waitFor(() => {
        expect(result.isPickerOpen()).toBe(false);
      });
    });

    it('search works with newly created projects', async () => {
      result = renderProjectSelection({
        initialProjects: [{ id: 'p1', name: 'Original' }],
      });

      // Create new project
      await result.createProject('Searchable New');

      // Search for it
      await result.searchProjects('Searchable');

      await waitFor(() => {
        const visible = result.getVisibleProjects();
        expect(visible).toContain('Searchable New');
      });
    });
  });
});
