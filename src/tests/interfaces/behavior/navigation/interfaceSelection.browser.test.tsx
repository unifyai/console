/**
 * P4: Interface Selection Behavior Tests
 *
 * Tests behaviors M1-M4 from BEHAVIORS.md:
 * - M1: List interfaces
 * - M2: Switch interface
 * - M3: Create interface
 * - M4: Delete interface
 *
 * Uses the REAL InterfacePicker component from:
 * @/components/Pages/Interfaces/Interface/Nav/InterfacePicker
 */

import { describe, it, expect, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  renderInterfaceSelection,
  InterfaceSelectionTestResult,
} from '../fixtures/interfaceSelectionTestHarness';

describe('P4-M: Interface Selection (Real InterfacePicker)', () => {
  let result: InterfaceSelectionTestResult;

  afterEach(() => {
    result?.unmount();
  });

  // ==========================================================================
  // M1: List Interfaces
  // ==========================================================================
  describe('M1: List interfaces', () => {
    it('displays all interfaces in the dropdown', async () => {
      result = renderInterfaceSelection({
        projectId: 'my-project',
        initialInterfaces: [
          { id: 'i1', name: 'Dashboard', projectId: 'my-project' },
          { id: 'i2', name: 'Analytics', projectId: 'my-project' },
          { id: 'i3', name: 'Settings', projectId: 'my-project' },
        ],
      });

      await result.openInterfacePicker();

      await waitFor(() => {
        const visible = result.getVisibleInterfaces();
        expect(visible).toContain('Dashboard');
        expect(visible).toContain('Analytics');
        expect(visible).toContain('Settings');
      });
    });

    it('shows interface picker trigger button', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [
          { id: 'i1', name: 'Test Interface', projectId: 'test-project' },
        ],
      });

      expect(screen.getByTestId('interface-picker-trigger')).toBeInTheDocument();
    });

    it('shows empty state when no interfaces exist', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [],
      });

      await result.openInterfacePicker();

      await waitFor(() => {
        expect(result.isEmpty()).toBe(true);
      });
    });

    it('shows project name in header', async () => {
      result = renderInterfaceSelection({
        projectId: 'my-awesome-project',
      });

      expect(screen.getByText(/my-awesome-project/)).toBeInTheDocument();
    });

    it('shows selected interface name in trigger', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [
          { id: 'i1', name: 'Active Interface', projectId: 'test-project' },
        ],
        activeInterfaceId: 'i1',
      });

      const trigger = screen.getByTestId('interface-picker-trigger');
      expect(trigger.textContent).toContain('Active Interface');
    });

    it('shows "Select interface" when none selected', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [
          { id: 'i1', name: 'Available', projectId: 'test-project' },
        ],
        activeInterfaceId: null,
      });

      const trigger = screen.getByTestId('interface-picker-trigger');
      expect(trigger.textContent).toContain('Select interface');
    });
  });

  // ==========================================================================
  // M2: Switch Interface
  // ==========================================================================
  describe('M2: Switch interface', () => {
    it('can select an interface by clicking', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [
          { id: 'i1', name: 'First', projectId: 'test-project' },
          { id: 'i2', name: 'Second', projectId: 'test-project' },
        ],
      });

      // Initially no interface selected
      expect(result.getActiveInterface()).toBeNull();

      // Click to select
      await result.clickInterface('First');

      await waitFor(() => {
        expect(result.getActiveInterface()).toBe('i1');
      });
    });

    it('closes picker after selection', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [
          { id: 'i1', name: 'Test', projectId: 'test-project' },
        ],
      });

      await result.clickInterface('Test');

      await waitFor(() => {
        expect(result.isPickerOpen()).toBe(false);
      });
    });

    it('can switch between interfaces', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [
          { id: 'i1', name: 'Interface A', projectId: 'test-project' },
          { id: 'i2', name: 'Interface B', projectId: 'test-project' },
        ],
        activeInterfaceId: 'i1',
      });

      expect(result.getActiveInterface()).toBe('i1');

      await result.clickInterface('Interface B');

      await waitFor(() => {
        expect(result.getActiveInterface()).toBe('i2');
      });
    });

    it('updates trigger to show selected interface', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [
          { id: 'i1', name: 'Selected Interface', projectId: 'test-project' },
        ],
      });

      await result.clickInterface('Selected Interface');

      await waitFor(() => {
        const trigger = screen.getByTestId('interface-picker-trigger');
        expect(trigger.textContent).toContain('Selected Interface');
      });
    });

    it('updates active display after selection', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [
          { id: 'i1', name: 'Selected Interface', projectId: 'test-project' },
        ],
      });

      await result.clickInterface('Selected Interface');

      await waitFor(() => {
        expect(screen.getByTestId('active-interface-display')).toBeInTheDocument();
        expect(screen.getByTestId('active-interface-display').textContent).toContain('Selected Interface');
      });
    });

    it('programmatic selection works', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [
          { id: 'i1', name: 'Programmatic', projectId: 'test-project' },
        ],
      });

      await result.selectInterface('i1');

      expect(result.getActiveInterface()).toBe('i1');
    });

    it('preserves project selection when switching interfaces', async () => {
      result = renderInterfaceSelection({
        projectId: 'persistent-project',
        initialInterfaces: [
          { id: 'i1', name: 'First', projectId: 'persistent-project' },
          { id: 'i2', name: 'Second', projectId: 'persistent-project' },
        ],
      });

      await result.clickInterface('First');
      await result.clickInterface('Second');

      // Project header should still show the project
      expect(screen.getByText(/persistent-project/)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // M3: Create Interface
  // ==========================================================================
  describe('M3: Create interface', () => {
    it('shows create interface button', async () => {
      result = renderInterfaceSelection();

      expect(screen.getByTestId('create-interface-button')).toBeInTheDocument();
    });

    it('opens create dialog when button clicked', async () => {
      result = renderInterfaceSelection();

      await result.clickCreateButton();

      expect(screen.getByTestId('create-interface-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('new-interface-name-input')).toBeInTheDocument();
    });

    it('can create a new interface', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [],
      });

      const user = userEvent.setup();

      await result.clickCreateButton();
      await user.type(screen.getByTestId('new-interface-name-input'), 'New Interface');
      await user.click(screen.getByTestId('create-interface-submit'));

      await waitFor(() => {
        expect(result.getInterfaces()).toContain('New Interface');
      });
    });

    it('new interface becomes active after creation', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [{ id: 'i1', name: 'Existing', projectId: 'test-project' }],
      });

      const user = userEvent.setup();

      await result.clickCreateButton();
      await user.type(screen.getByTestId('new-interface-name-input'), 'Fresh Interface');
      await user.click(screen.getByTestId('create-interface-submit'));

      await waitFor(() => {
        expect(result.getActiveInterface()).not.toBeNull();
        const activeId = result.getActiveInterface();
        const iface = result.getInterfaceById(activeId!);
        expect(iface?.name).toBe('Fresh Interface');
      });
    });

    it('can cancel interface creation', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [],
      });

      const user = userEvent.setup();

      await result.clickCreateButton();
      await user.type(screen.getByTestId('new-interface-name-input'), 'Cancelled');
      await user.click(screen.getByTestId('create-interface-cancel'));

      expect(screen.queryByTestId('create-interface-dialog')).not.toBeInTheDocument();
      expect(result.getInterfaces()).not.toContain('Cancelled');
    });

    it('new interface appears in picker', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [{ id: 'i1', name: 'Original', projectId: 'test-project' }],
      });

      await result.createInterface('Added Interface');

      await result.openInterfacePicker();

      await waitFor(() => {
        const visible = result.getVisibleInterfaces();
        expect(visible).toContain('Added Interface');
      });
    });
  });

  // ==========================================================================
  // M4: Delete Interface
  // ==========================================================================
  describe('M4: Delete interface', () => {
    it('opens confirmation dialog when delete clicked', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [{ id: 'i1', name: 'To Delete', projectId: 'test-project' }],
      });

      await result.clickDeleteButton('To Delete');

      expect(result.isDeleteDialogOpen()).toBe(true);
    });

    it('shows interface name in delete confirmation', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [{ id: 'i1', name: 'Important Interface', projectId: 'test-project' }],
      });

      await result.clickDeleteButton('Important Interface');

      expect(screen.getByTestId('delete-interface-dialog').textContent).toContain('Important Interface');
    });

    it('can confirm deletion', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [
          { id: 'i1', name: 'Keep', projectId: 'test-project' },
          { id: 'i2', name: 'Remove', projectId: 'test-project' },
        ],
      });

      await result.clickDeleteButton('Remove');
      await result.confirmDelete();

      await waitFor(() => {
        expect(result.getInterfaces()).not.toContain('Remove');
        expect(result.getInterfaces()).toContain('Keep');
      });
    });

    it('can cancel deletion', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [{ id: 'i1', name: 'Almost Gone', projectId: 'test-project' }],
      });

      await result.clickDeleteButton('Almost Gone');
      await result.cancelDelete();

      expect(result.isDeleteDialogOpen()).toBe(false);
      expect(result.getInterfaces()).toContain('Almost Gone');
    });

    it('deleting active interface clears selection', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [
          { id: 'i1', name: 'Active', projectId: 'test-project' },
          { id: 'i2', name: 'Other', projectId: 'test-project' },
        ],
        activeInterfaceId: 'i1',
      });

      expect(result.getActiveInterface()).toBe('i1');

      await result.clickDeleteButton('Active');
      await result.confirmDelete();

      await waitFor(() => {
        expect(result.getActiveInterface()).toBeNull();
      });
    });

    it('deleted interface removed from picker', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [
          { id: 'i1', name: 'Stays', projectId: 'test-project' },
          { id: 'i2', name: 'Goes', projectId: 'test-project' },
        ],
      });

      await result.clickDeleteButton('Goes');
      await result.confirmDelete();

      await result.openInterfacePicker();

      await waitFor(() => {
        const visible = result.getVisibleInterfaces();
        expect(visible).not.toContain('Goes');
        expect(visible).toContain('Stays');
      });
    });

    it('remaining interfaces still exist after deletion', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [
          { id: 'i1', name: 'Deleted', projectId: 'test-project' },
          { id: 'i2', name: 'Remaining', projectId: 'test-project' },
        ],
        activeInterfaceId: 'i1',
      });

      await result.deleteInterface('i1');

      await waitFor(() => {
        expect(result.getInterfaces()).toContain('Remaining');
        expect(result.getInterfaces()).not.toContain('Deleted');
      });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('handles interface with no tabs', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [
          { id: 'i1', name: 'Empty Interface', projectId: 'test-project', tabIds: [] },
        ],
      });

      await result.openInterfacePicker();

      await waitFor(() => {
        expect(result.getVisibleInterfaces()).toContain('Empty Interface');
      });
    });

    it('handles many interfaces', async () => {
      const manyInterfaces = Array.from({ length: 20 }, (_, i) => ({
        id: `i${i}`,
        name: `Interface ${i.toString().padStart(2, '0')}`,
        projectId: 'test-project',
      }));

      result = renderInterfaceSelection({
        initialInterfaces: manyInterfaces,
      });

      expect(result.getInterfaces()).toHaveLength(20);
    });

    it('picker can be opened and closed', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [{ id: 'i1', name: 'Test', projectId: 'test-project' }],
      });

      // Open
      await result.openInterfacePicker();
      expect(result.isPickerOpen()).toBe(true);

      // Close
      await result.closeInterfacePicker();

      await waitFor(() => {
        expect(result.isPickerOpen()).toBe(false);
      });
    });

    it('search filters interfaces', async () => {
      result = renderInterfaceSelection({
        initialInterfaces: [
          { id: 'i1', name: 'Dashboard', projectId: 'test-project' },
          { id: 'i2', name: 'Analytics', projectId: 'test-project' },
          { id: 'i3', name: 'Settings', projectId: 'test-project' },
        ],
      });

      await result.searchInterfaces('Dash');

      await waitFor(() => {
        const visible = result.getVisibleInterfaces();
        expect(visible).toContain('Dashboard');
        expect(visible).not.toContain('Analytics');
        expect(visible).not.toContain('Settings');
      });
    });
  });
});
