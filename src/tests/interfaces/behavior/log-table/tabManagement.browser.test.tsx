/**
 * P1-C: Tab Management Behavior Tests
 *
 * Tests tab sidebar interactions using a representative test harness.
 * The harness exercises the same user interactions as the real InterfaceNav
 * component but in isolation.
 * 
 * Covers behaviors from BEHAVIORS.md:
 * - C1: Switch tabs
 * - C2: Create tab
 * - C3: Rename tab
 * - C4: Delete tab
 * - C5: Tab reorder
 * - C6: Tab color
 * - C7: Tab icon
 * - C8: Duplicate tab
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderTabSidebar, createMockTabs, MockTab } from '../fixtures/tabSidebarTestHarness';

// =============================================================================
// P1-C: Tab Management
// =============================================================================

describe('P1-C: Tab Management', () => {
  
  // =========================================================================
  // C1: Switch tabs
  // =========================================================================
  describe('C1: Switch tabs', () => {
    it('renders all tabs in the sidebar', async () => {
      const tabs = createMockTabs(3);
      renderTabSidebar({ initialTabs: tabs });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      // All tabs should be visible
      expect(screen.getByTestId('tab-button-tab-1')).toBeInTheDocument();
      expect(screen.getByTestId('tab-button-tab-2')).toBeInTheDocument();
      expect(screen.getByTestId('tab-button-tab-3')).toBeInTheDocument();
    });

    it('clicking a tab makes it active', async () => {
      const user = userEvent.setup();
      const { getActiveTabId } = renderTabSidebar({
        initialTabs: createMockTabs(3),
        initialActiveTabId: 'tab-1',
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      expect(getActiveTabId()).toBe('tab-1');

      // Click tab 2
      await user.click(screen.getByTestId('tab-button-tab-2'));

      await waitFor(() => {
        expect(getActiveTabId()).toBe('tab-2');
      });
    });

    it('calls onTabClick callback when tab is clicked', async () => {
      const user = userEvent.setup();
      const onTabClick = vi.fn();
      
      renderTabSidebar({
        initialTabs: createMockTabs(3),
        callbacks: { onTabClick },
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('tab-button-tab-2'));

      await waitFor(() => {
        expect(onTabClick).toHaveBeenCalledWith('tab-2');
      });
    });

    it('shows active tab with visual indicator', async () => {
      renderTabSidebar({
        initialTabs: createMockTabs(3),
        initialActiveTabId: 'tab-2',
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      const tab2Item = screen.getByTestId('tab-item-tab-2');
      expect(tab2Item).toHaveAttribute('data-active', 'true');

      const tab1Item = screen.getByTestId('tab-item-tab-1');
      expect(tab1Item).toHaveAttribute('data-active', 'false');
    });
  });

  // =========================================================================
  // C2: Create tab
  // =========================================================================
  describe('C2: Create tab', () => {
    it('shows create button in sidebar', async () => {
      renderTabSidebar({ showCreateButton: true });

      await waitFor(() => {
        expect(screen.getByTestId('create-tab-button')).toBeInTheDocument();
      });
    });

    it('clicking create button shows input form', async () => {
      const user = userEvent.setup();
      renderTabSidebar({ showCreateButton: true });

      await waitFor(() => {
        expect(screen.getByTestId('create-tab-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('create-tab-button'));

      await waitFor(() => {
        expect(screen.getByTestId('create-tab-form')).toBeInTheDocument();
        expect(screen.getByTestId('new-tab-input')).toBeInTheDocument();
      });
    });

    it('creating a tab adds it to the list', async () => {
      const user = userEvent.setup();
      const onCreateTab = vi.fn();
      const { getTabs } = renderTabSidebar({
        initialTabs: createMockTabs(2),
        callbacks: { onCreateTab },
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      expect(getTabs()).toHaveLength(2);

      // Open create form
      await user.click(screen.getByTestId('create-tab-button'));
      
      // Type name and submit
      await user.type(screen.getByTestId('new-tab-input'), 'New Tab');
      await user.click(screen.getByTestId('confirm-create-button'));

      await waitFor(() => {
        expect(getTabs()).toHaveLength(3);
        expect(getTabs().some((t) => t.name === 'New Tab')).toBe(true);
      });

      expect(onCreateTab).toHaveBeenCalledWith('New Tab');
    });

    it('pressing Enter in input creates the tab', async () => {
      const user = userEvent.setup();
      const { getTabs } = renderTabSidebar({
        initialTabs: createMockTabs(1),
      });

      await user.click(screen.getByTestId('create-tab-button'));
      await user.type(screen.getByTestId('new-tab-input'), 'Enter Tab{Enter}');

      await waitFor(() => {
        expect(getTabs()).toHaveLength(2);
        expect(getTabs().some((t) => t.name === 'Enter Tab')).toBe(true);
      });
    });

    it('newly created tab becomes active', async () => {
      const user = userEvent.setup();
      const { getActiveTabId, getTabs } = renderTabSidebar({
        initialTabs: createMockTabs(2),
        initialActiveTabId: 'tab-1',
      });

      await user.click(screen.getByTestId('create-tab-button'));
      await user.type(screen.getByTestId('new-tab-input'), 'Active Tab{Enter}');

      await waitFor(() => {
        const newTab = getTabs().find((t) => t.name === 'Active Tab');
        expect(newTab).toBeDefined();
        expect(getActiveTabId()).toBe(newTab!.id);
      });
    });
  });

  // =========================================================================
  // C3: Rename tab
  // =========================================================================
  describe('C3: Rename tab', () => {
    it('clicking rename button shows rename input', async () => {
      const user = userEvent.setup();
      renderTabSidebar({ initialTabs: createMockTabs(2) });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      // Hover to show buttons (in real UI), then click rename
      await user.click(screen.getByTestId('rename-button-tab-1'));

      await waitFor(() => {
        expect(screen.getByTestId('rename-tab-form')).toBeInTheDocument();
        expect(screen.getByTestId('rename-tab-input')).toBeInTheDocument();
      });
    });

    it('renaming a tab updates its name', async () => {
      const user = userEvent.setup();
      const onRenameTab = vi.fn();
      const { getTabs } = renderTabSidebar({
        initialTabs: createMockTabs(2),
        callbacks: { onRenameTab },
      });

      await user.click(screen.getByTestId('rename-button-tab-1'));
      
      const input = screen.getByTestId('rename-tab-input');
      await user.clear(input);
      await user.type(input, 'Renamed Tab{Enter}');

      await waitFor(() => {
        expect(getTabs().find((t) => t.id === 'tab-1')?.name).toBe('Renamed Tab');
      });

      expect(onRenameTab).toHaveBeenCalledWith('tab-1', 'Renamed Tab');
    });

    it('pressing Escape cancels rename', async () => {
      const user = userEvent.setup();
      const { getTabs } = renderTabSidebar({
        initialTabs: createMockTabs(2),
      });

      const originalName = getTabs().find((t) => t.id === 'tab-1')?.name;

      await user.click(screen.getByTestId('rename-button-tab-1'));
      
      const input = screen.getByTestId('rename-tab-input');
      await user.clear(input);
      await user.type(input, 'Should Not Save{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('rename-tab-form')).not.toBeInTheDocument();
      });

      // Name should be unchanged
      expect(getTabs().find((t) => t.id === 'tab-1')?.name).toBe(originalName);
    });
  });

  // =========================================================================
  // C4: Delete tab
  // =========================================================================
  describe('C4: Delete tab', () => {
    it('clicking delete button removes the tab', async () => {
      const user = userEvent.setup();
      const onDeleteTab = vi.fn();
      const { getTabs } = renderTabSidebar({
        initialTabs: createMockTabs(3),
        callbacks: { onDeleteTab },
      });

      expect(getTabs()).toHaveLength(3);

      await user.click(screen.getByTestId('delete-button-tab-2'));

      await waitFor(() => {
        expect(getTabs()).toHaveLength(2);
        expect(getTabs().some((t) => t.id === 'tab-2')).toBe(false);
      });

      expect(onDeleteTab).toHaveBeenCalledWith('tab-2');
    });

    it('cannot delete the last tab', async () => {
      renderTabSidebar({
        initialTabs: createMockTabs(1),
        allowDelete: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      // Delete button should not be present for the only tab
      expect(screen.queryByTestId('delete-button-tab-1')).not.toBeInTheDocument();
    });

    it('deleting active tab switches to another tab', async () => {
      const user = userEvent.setup();
      const { getActiveTabId } = renderTabSidebar({
        initialTabs: createMockTabs(3),
        initialActiveTabId: 'tab-2',
      });

      expect(getActiveTabId()).toBe('tab-2');

      await user.click(screen.getByTestId('delete-button-tab-2'));

      await waitFor(() => {
        expect(getActiveTabId()).not.toBe('tab-2');
        expect(getActiveTabId()).toBe('tab-1'); // Switches to first available
      });
    });
  });

  // =========================================================================
  // C5: Tab reorder
  // =========================================================================
  describe('C5: Tab reorder', () => {
    it('shows drag handles when reorder is enabled', async () => {
      renderTabSidebar({
        initialTabs: createMockTabs(3),
        allowReorder: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      // Drag handles should exist
      expect(screen.getByTestId('drag-handle-tab-1')).toBeInTheDocument();
      expect(screen.getByTestId('drag-handle-tab-2')).toBeInTheDocument();
    });

    it('getTabOrder returns current order', async () => {
      const { getTabOrder } = renderTabSidebar({
        initialTabs: createMockTabs(3),
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      expect(getTabOrder()).toEqual(['tab-1', 'tab-2', 'tab-3']);
    });

    // Note: Actual drag-and-drop testing requires more complex setup
    // This verifies the infrastructure is in place
    it('has sortable context for drag and drop', async () => {
      renderTabSidebar({
        initialTabs: createMockTabs(3),
        allowReorder: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-list')).toBeInTheDocument();
      });

      // Tab items should be rendered in a sortable container
      const tabList = screen.getByTestId('tab-list');
      expect(tabList.children).toHaveLength(3);
    });
  });

  // =========================================================================
  // C6: Tab color
  // =========================================================================
  describe('C6: Tab color', () => {
    it('clicking color button changes tab color', async () => {
      const user = userEvent.setup();
      const onChangeTabColor = vi.fn();
      const { getTabs } = renderTabSidebar({
        initialTabs: createMockTabs(2),
        callbacks: { onChangeTabColor },
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      // Initial color is undefined
      expect(getTabs().find((t) => t.id === 'tab-1')?.color).toBeUndefined();

      await user.click(screen.getByTestId('color-button-tab-1'));

      await waitFor(() => {
        // Color should cycle to first color
        expect(getTabs().find((t) => t.id === 'tab-1')?.color).toBe('#ff0000');
      });

      expect(onChangeTabColor).toHaveBeenCalledWith('tab-1', '#ff0000');
    });

    it('color cycles through options on repeated clicks', async () => {
      const user = userEvent.setup();
      const { getTabs } = renderTabSidebar({
        initialTabs: createMockTabs(2),
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      const colorButton = screen.getByTestId('color-button-tab-1');

      // Click multiple times to cycle colors
      await user.click(colorButton);
      expect(getTabs().find((t) => t.id === 'tab-1')?.color).toBe('#ff0000');

      await user.click(colorButton);
      expect(getTabs().find((t) => t.id === 'tab-1')?.color).toBe('#00ff00');

      await user.click(colorButton);
      expect(getTabs().find((t) => t.id === 'tab-1')?.color).toBe('#0000ff');

      await user.click(colorButton);
      expect(getTabs().find((t) => t.id === 'tab-1')?.color).toBeUndefined();
    });
  });

  // =========================================================================
  // C7: Tab icon
  // =========================================================================
  describe('C7: Tab icon', () => {
    it('clicking icon button changes tab icon', async () => {
      const user = userEvent.setup();
      const onChangeTabIcon = vi.fn();
      const { getTabs } = renderTabSidebar({
        initialTabs: createMockTabs(2),
        callbacks: { onChangeTabIcon },
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      // Initial icon is undefined
      expect(getTabs().find((t) => t.id === 'tab-1')?.icon).toBeUndefined();

      await user.click(screen.getByTestId('icon-button-tab-1'));

      await waitFor(() => {
        // Icon should cycle to first icon
        expect(getTabs().find((t) => t.id === 'tab-1')?.icon).toBe('📊');
      });

      expect(onChangeTabIcon).toHaveBeenCalledWith('tab-1', '📊');
    });

    it('icon cycles through options on repeated clicks', async () => {
      const user = userEvent.setup();
      const { getTabs } = renderTabSidebar({
        initialTabs: createMockTabs(2),
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      const iconButton = screen.getByTestId('icon-button-tab-1');

      // Click multiple times to cycle icons
      await user.click(iconButton);
      expect(getTabs().find((t) => t.id === 'tab-1')?.icon).toBe('📊');

      await user.click(iconButton);
      expect(getTabs().find((t) => t.id === 'tab-1')?.icon).toBe('📈');

      await user.click(iconButton);
      expect(getTabs().find((t) => t.id === 'tab-1')?.icon).toBe('📉');

      await user.click(iconButton);
      expect(getTabs().find((t) => t.id === 'tab-1')?.icon).toBe('🔍');

      await user.click(iconButton);
      expect(getTabs().find((t) => t.id === 'tab-1')?.icon).toBeUndefined();
    });

    it('displays icon in tab name', async () => {
      const tabsWithIcon: MockTab[] = [
        { id: 'icon-tab', name: 'Icon Tab', icon: '🎯' },
      ];
      renderTabSidebar({
        initialTabs: tabsWithIcon,
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      const tabButton = screen.getByTestId('tab-button-icon-tab');
      expect(tabButton.textContent).toContain('🎯');
      expect(tabButton.textContent).toContain('Icon Tab');
    });
  });

  // =========================================================================
  // C8: Duplicate tab
  // =========================================================================
  describe('C8: Duplicate tab', () => {
    it('clicking duplicate button creates a copy', async () => {
      const user = userEvent.setup();
      const onDuplicateTab = vi.fn();
      const { getTabs } = renderTabSidebar({
        initialTabs: createMockTabs(2),
        callbacks: { onDuplicateTab },
      });

      expect(getTabs()).toHaveLength(2);

      await user.click(screen.getByTestId('duplicate-button-tab-1'));

      await waitFor(() => {
        expect(getTabs()).toHaveLength(3);
        expect(getTabs().some((t) => t.name === 'Tab 1_copy')).toBe(true);
      });

      expect(onDuplicateTab).toHaveBeenCalledWith('tab-1');
    });

    it('duplicated tab copies color and icon', async () => {
      const user = userEvent.setup();
      const tabsWithStyle: MockTab[] = [
        { id: 'styled-tab', name: 'Styled', color: '#ff0000', icon: '🎨' },
      ];
      const { getTabs } = renderTabSidebar({
        initialTabs: tabsWithStyle,
      });

      await user.click(screen.getByTestId('duplicate-button-styled-tab'));

      await waitFor(() => {
        const copy = getTabs().find((t) => t.name === 'Styled_copy');
        expect(copy).toBeDefined();
        expect(copy?.color).toBe('#ff0000');
        expect(copy?.icon).toBe('🎨');
      });
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('Edge cases', () => {
    it('handles empty tabs gracefully', async () => {
      renderTabSidebar({ initialTabs: [] });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText(/No tabs/i)).toBeInTheDocument();
    });

    it('handles many tabs', async () => {
      const manyTabs = createMockTabs(20);
      const { getTabs } = renderTabSidebar({ initialTabs: manyTabs });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      expect(getTabs()).toHaveLength(20);
    });

    it('respects showCreateButton=false', async () => {
      renderTabSidebar({ showCreateButton: false });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('create-tab-button')).not.toBeInTheDocument();
    });

    it('respects allowDelete=false', async () => {
      renderTabSidebar({
        initialTabs: createMockTabs(3),
        allowDelete: false,
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('delete-button-tab-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-button-tab-2')).not.toBeInTheDocument();
    });

    it('respects allowReorder=false', async () => {
      renderTabSidebar({
        initialTabs: createMockTabs(3),
        allowReorder: false,
      });

      await waitFor(() => {
        expect(screen.getByTestId('tab-sidebar-container')).toBeInTheDocument();
      });

      // Drag handles should not be present when reorder is disabled
      expect(screen.queryByTestId('drag-handle-tab-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('drag-handle-tab-2')).not.toBeInTheDocument();
    });
  });
});

