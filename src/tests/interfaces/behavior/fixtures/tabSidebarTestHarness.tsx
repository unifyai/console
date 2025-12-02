/**
 * Tab Sidebar Test Harness
 * 
 * A reusable wrapper that provides all the mocking and state management
 * needed to test tab management behaviors in isolation.
 * 
 * Uses REAL components:
 * - TabList component from @/components/Pages/Interfaces/Interface/Nav/TabList
 * - Zustand store for tab state management
 * - useInterfaceData hook for tab operations (addTab, removeTab, renameTab)
 * - Store actions for direct state manipulation
 * 
 * Usage:
 *   import { renderTabSidebar, createMockTabs } from '../fixtures/tabSidebarTestHarness';
 *   
 *   it('switches tabs', async () => {
 *     const onTabClick = vi.fn();
 *     renderTabSidebar({ callbacks: { onTabClick } });
 *     await user.click(screen.getByRole('button', { name: /Tab 1/i }));
 *     expect(onTabClick).toHaveBeenCalledWith('tab-1');
 *   });
 */
import React, { useState, useCallback, useMemo } from 'react';
import { render, RenderResult, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

// Shared test utilities
import { TestProviders, useStateContainer } from '../utils';

// REAL Component Import
import { TabList, TabItem } from '@/components/Pages/Interfaces/Interface/Nav';

// Real Store Imports
import { useStoreApiContext, useStoreContext } from '@/contexts/providers/StoreProvider';
import { IStoreState } from '@/contexts/store';
import { useInterfaceData } from '@/contexts/hooks/interface/useInterfaceData';
import { initTab, Tab } from '@/contexts/slices/selectors/tab';
import { initInterface } from '@/contexts/slices/selectors/interface';

// Constants for test IDs
const PROJECT_ID = 'test-project';
const INTERFACE_ID = 'test-interface';

// =============================================================================
// Types
// =============================================================================

// Re-export Tab type for external use
export type { Tab };
export interface MockTab {
  id: string;
  name: string;
  color?: string;
  icon?: string;
}

export interface TabSidebarCallbacks {
  onTabClick?: (tabId: string) => void;
  onCreateTab?: (name: string) => void;
  onRenameTab?: (tabId: string, newName: string) => void;
  onDeleteTab?: (tabId: string) => void;
  onReorderTabs?: (tabs: MockTab[]) => void;
  onChangeTabColor?: (tabId: string, color: string) => void;
  onChangeTabIcon?: (tabId: string, icon: string) => void;
  onDuplicateTab?: (tabId: string) => void;
}

export interface TabSidebarTestOptions {
  /** Initial tabs */
  initialTabs?: MockTab[];
  /** Initially active tab ID */
  initialActiveTabId?: string;
  /** Callbacks for actions */
  callbacks?: TabSidebarCallbacks;
  /** Whether to show create button */
  showCreateButton?: boolean;
  /** Whether to allow deletion */
  allowDelete?: boolean;
  /** Whether to allow reordering */
  allowReorder?: boolean;
  /** Project ID */
  projectId?: string;
  /** Interface ID */
  interfaceId?: string;
  /** Whether sidebar is collapsed */
  isCollapsed?: boolean;
}

export interface TabSidebarTestResult extends RenderResult {
  user: ReturnType<typeof userEvent.setup>;
  /** Get current tabs */
  getTabs: () => MockTab[];
  /** Get active tab ID */
  getActiveTabId: () => string | null;
  /** Get active tab name */
  getActiveTabName: () => string | null;
  /** Get tab order (IDs) */
  getTabOrder: () => string[];
  /** Programmatically set active tab */
  setActiveTab: (tabId: string) => void;
  /** Programmatically add a tab */
  addTab: (tab: MockTab) => void;
  /** Programmatically remove a tab */
  removeTab: (tabId: string) => void;
  /** Click on a tab in the UI */
  clickTab: (tabName: string) => Promise<void>;
  /** Click the create tab button */
  clickCreateButton: () => Promise<void>;
  /** Open tab context menu */
  openTabMenu: (tabName: string) => Promise<void>;
  /** Check if tab list is loading */
  isLoading: () => boolean;
  /** Check if tab list is empty */
  isEmpty: () => boolean;
  /** Get visible tab names */
  getVisibleTabs: () => string[];
}

// =============================================================================
// Mock Data Factories
// =============================================================================

/**
 * Creates mock tab data.
 */
function createMockTabsInternal(count: number = 3): MockTab[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `tab-${i + 1}`,
    name: `Tab ${i + 1}`,
    color: undefined,
    icon: undefined,
  }));
}

export const createMockTabs = createMockTabsInternal;

// =============================================================================
// Internal State Container
// =============================================================================

interface StateContainer {
  getTabs: () => MockTab[];
  getActiveTabId: () => string | null;
  getActiveTabName: () => string | null;
  getTabOrder: () => string[];
  setActiveTab: (tabId: string) => void;
  addTab: (tab: MockTab) => void;
  removeTab: (tabId: string) => void;
}

// =============================================================================
// Tab Sidebar Wrapper Component (uses REAL TabList)
// =============================================================================

interface TabSidebarWrapperProps extends TabSidebarTestOptions {
  stateContainerRef: React.MutableRefObject<StateContainer | null>;
}

function TabSidebarWrapper({
  initialTabs = createMockTabs(3),
  callbacks = {},
  showCreateButton = true,
  allowDelete = true,
  stateContainerRef,
  interfaceId = INTERFACE_ID,
  isCollapsed = false,
}: TabSidebarWrapperProps) {
  // Use REAL hooks for interface data and tab operations
  const { dataActions: interfaceDataActions, tabNames, tabIds } = useInterfaceData(interfaceId);
  const storeApi = useStoreApiContext();
  
  // Get store state directly for tab details
  const tabsById = useStoreContext(state => state.tabsById);
  const activeTabIdFromStore = useStoreContext(state => state.activeTabId);
  
  // Local state
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tabToDelete, setTabToDelete] = useState<TabItem | null>(null);
  
  // Build tabs array from store state
  const tabs = useMemo<TabItem[]>(() => {
    return tabIds.map(id => {
      const tab = tabsById[id];
      return {
        id: tab?.id || id,
        name: tab?.name || id,
        color: tab?.color,
        icon: (tab as any)?.icon,
      };
    });
  }, [tabIds, tabsById]);
  
  // Get active tab name
  const activeTabName = useMemo(() => {
    if (!activeTabIdFromStore) return null;
    const tab = tabsById[activeTabIdFromStore];
    return tab?.name || null;
  }, [activeTabIdFromStore, tabsById]);

  // ==========================================================================
  // Handlers (Using REAL store actions)
  // ==========================================================================

  const handleTabClick = useCallback((tab: TabItem) => {
    storeApi.getState().setActiveTab(interfaceId, tab.id);
    callbacks.onTabClick?.(tab.id);
  }, [callbacks, storeApi, interfaceId]);

  const handleCreateTab = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleSubmitCreate = useCallback(() => {
    if (!newTabName.trim()) return;
    
    const trimmedName = newTabName.trim();
    const newTabId = `tab-${Date.now()}`;
    
    interfaceDataActions.addTab(trimmedName, { id: newTabId });
    storeApi.getState().setActiveTab(interfaceId, newTabId);
    
    setNewTabName('');
    setCreateDialogOpen(false);
    callbacks.onCreateTab?.(trimmedName);
  }, [newTabName, callbacks, interfaceDataActions, storeApi, interfaceId]);

  const handleSaveTab = useCallback((tab: TabItem) => {
    // Mock save action
  }, []);

  const handleResetTab = useCallback((tab: TabItem) => {
    // Mock reset action
  }, []);

  const handleRenameTab = useCallback((tab: TabItem) => {
    setSelectedTab(tab);
    setRenameValue(tab.name);
    setRenameDialogOpen(true);
  }, []);

  const handleSubmitRename = useCallback(() => {
    if (!selectedTab || !renameValue.trim()) {
      setRenameDialogOpen(false);
      return;
    }
    
    // Use store directly to ensure rename works
    storeApi.getState().renameTab(interfaceId, selectedTab.name, renameValue.trim());
    callbacks.onRenameTab?.(selectedTab.id, renameValue.trim());
    setRenameDialogOpen(false);
    setSelectedTab(null);
  }, [selectedTab, renameValue, callbacks, interfaceId, storeApi]);

  const handleChangeTabIcon = useCallback((tab: TabItem) => {
    callbacks.onChangeTabIcon?.(tab.id, '📊');
  }, [callbacks]);

  const handleChangeTabColor = useCallback((tab: TabItem) => {
    callbacks.onChangeTabColor?.(tab.id, '#ff0000');
  }, [callbacks]);

  const handleSetTabContext = useCallback((tab: TabItem) => {
    // Mock set context action
  }, []);

  const handleDeleteTab = useCallback((tab: TabItem) => {
    setTabToDelete(tab);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!tabToDelete) return;
    
    interfaceDataActions.removeTab(tabToDelete.name);
    
    // If deleting active tab, switch to first available
    const remainingTabs = tabs.filter(t => t.id !== tabToDelete.id);
    if (activeTabIdFromStore === tabToDelete.id && remainingTabs.length > 0) {
      storeApi.getState().setActiveTab(interfaceId, remainingTabs[0].id);
    }
    
    callbacks.onDeleteTab?.(tabToDelete.id);
    setDeleteDialogOpen(false);
    setTabToDelete(null);
  }, [tabToDelete, tabs, activeTabIdFromStore, callbacks, interfaceDataActions, storeApi, interfaceId]);

  const handleTabReorder = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = tabs.findIndex((t) => t.id === active.id);
      const newIndex = tabs.findIndex((t) => t.id === over.id);
      const reorderedTabs = arrayMove(tabs, oldIndex, newIndex);
      
      interfaceDataActions.setTabIds(reorderedTabs.map(t => t.id));
      interfaceDataActions.setTabNames(reorderedTabs.map(t => t.name));
      
      callbacks.onReorderTabs?.(reorderedTabs);
    }
  }, [tabs, callbacks, interfaceDataActions]);

  // ==========================================================================
  // Expose state to test via ref
  // ==========================================================================

  useStateContainer(stateContainerRef, () => ({
    getTabs: () => tabs,
    getActiveTabId: () => activeTabIdFromStore,
    getActiveTabName: () => activeTabName,
    getTabOrder: () => tabs.map((t) => t.id),
    setActiveTab: (tabId: string) => storeApi.getState().setActiveTab(interfaceId, tabId),
    addTab: (tab: MockTab) => interfaceDataActions.addTab(tab.name, { id: tab.id, color: tab.color }),
    removeTab: (tabId: string) => {
      const tab = tabs.find(t => t.id === tabId);
      if (tab) interfaceDataActions.removeTab(tab.name);
    },
  }), [tabs, activeTabIdFromStore, activeTabName, storeApi, interfaceId, interfaceDataActions]);

  // ==========================================================================
  // Render with REAL TabList component
  // ==========================================================================

  return (
    <div data-testid="tab-sidebar-container" className="w-64 bg-white border-r">
      {/* REAL TabList Component */}
      <TabList
        tabs={tabs}
        activeTabName={activeTabName}
        isCollapsed={isCollapsed}
        isLoading={isLoading}
        isError={isError}
        isTabLoading={() => false}
        onTabClick={handleTabClick}
        onTabReorder={handleTabReorder}
        onCreateTab={handleCreateTab}
        onSaveTab={handleSaveTab}
        onResetTab={handleResetTab}
        onRenameTab={handleRenameTab}
        onChangeTabIcon={handleChangeTabIcon}
        onChangeTabColor={handleChangeTabColor}
        onSetTabContext={handleSetTabContext}
        onDeleteTab={handleDeleteTab}
        onRetry={() => { setIsLoading(true); setTimeout(() => setIsLoading(false), 100); }}
      />

      {/* Create Tab Dialog */}
      {createDialogOpen && (
        <div data-testid="create-tab-dialog" role="dialog">
          <h3>Create New Tab</h3>
          <input
            data-testid="new-tab-name-input"
            type="text"
            placeholder="Tab name"
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitCreate();
              if (e.key === 'Escape') setCreateDialogOpen(false);
            }}
            autoFocus
          />
          <button data-testid="create-tab-submit" onClick={handleSubmitCreate}>Create</button>
          <button data-testid="create-tab-cancel" onClick={() => setCreateDialogOpen(false)}>Cancel</button>
        </div>
      )}

      {/* Rename Tab Dialog */}
      {renameDialogOpen && selectedTab && (
        <div data-testid="rename-tab-dialog" role="dialog">
          <h3>Rename Tab</h3>
          <input
            data-testid="rename-tab-input"
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitRename();
              if (e.key === 'Escape') setRenameDialogOpen(false);
            }}
            autoFocus
          />
          <button data-testid="rename-tab-submit" onClick={handleSubmitRename}>Rename</button>
          <button data-testid="rename-tab-cancel" onClick={() => setRenameDialogOpen(false)}>Cancel</button>
        </div>
      )}

      {/* Delete Tab Dialog */}
      {deleteDialogOpen && tabToDelete && (
        <div data-testid="delete-tab-dialog" role="alertdialog">
          <h3>Delete Tab</h3>
          <p>Are you sure you want to delete &quot;{tabToDelete.name}&quot;?</p>
          <button data-testid="delete-tab-confirm" onClick={handleConfirmDelete}>Delete</button>
          <button data-testid="delete-tab-cancel" onClick={() => setDeleteDialogOpen(false)}>Cancel</button>
        </div>
      )}

      {/* Test controls */}
      <div data-testid="test-controls" style={{ display: 'none' }}>
        <button data-testid="set-loading" onClick={() => setIsLoading(true)}>Set Loading</button>
        <button data-testid="set-error" onClick={() => setIsError(true)}>Set Error</button>
        <button data-testid="clear-states" onClick={() => { setIsLoading(false); setIsError(false); }}>Clear</button>
      </div>
    </div>
  );
}

// =============================================================================
// Initial Store State Builder
// =============================================================================

function createInitialStoreState(
  initialTabs: MockTab[],
  initialActiveTabId: string | null,
  projectId: string,
  interfaceId: string
): Partial<IStoreState> {
  // Build tabs state
  const tabsById: Record<string, Tab> = {};
  const tabIds: string[] = [];
  const tabNames: string[] = [];

  initialTabs.forEach(mockTab => {
    const tab = initTab(mockTab.id, {
      name: mockTab.name,
      color: mockTab.color,
      interfaceId,
    } as any);
    // Add icon separately since it's not part of the base Tab type
    if (mockTab.icon) {
      (tab as any).icon = mockTab.icon;
    }
    tabsById[mockTab.id] = tab;
    tabIds.push(mockTab.id);
    tabNames.push(mockTab.name);
  });

  // Build interface state
  const interfaceState = initInterface(interfaceId, {
    name: 'Test Interface',
    projectId,
    tabIds,
    tabNames,
    activeTabId: initialActiveTabId || tabIds[0] || null,
  });

  return {
    // Project state
    projects: [projectId],
    projectsById: {
      [projectId]: {
        id: projectId,
        name: projectId,
        description: '',
        contexts: [],
        interfaceIds: [interfaceId],
        activeInterfaceId: interfaceId,
      },
    },
    activeProjectId: projectId,
    
    // Interface state
    interfacesById: {
      [interfaceId]: interfaceState,
    },
    activeInterfaceId: interfaceId,
    
    // Tab state
    tabsById,
    activeTabId: initialActiveTabId || tabIds[0] || null,
    
    // Empty tiles
    tilesById: {},
  };
}

// =============================================================================
// Main Export: renderTabSidebar
// =============================================================================

/**
 * Renders a tab sidebar component with the REAL TabList component.
 * 
 * Uses REAL Zustand store for tab state management and the
 * REAL TabList component from the Nav directory.
 */
export function renderTabSidebar(options: TabSidebarTestOptions = {}): TabSidebarTestResult {
  const stateContainerRef: React.MutableRefObject<StateContainer | null> = { current: null };
  const user = userEvent.setup();
  const {
    initialTabs = createMockTabs(3),
    initialActiveTabId,
    projectId = PROJECT_ID,
    interfaceId = INTERFACE_ID,
    ...innerOptions
  } = options;

  // Create initial store state with tabs
  const initialState = createInitialStoreState(
    initialTabs,
    initialActiveTabId || null,
    projectId,
    interfaceId
  );

  const renderResult = render(
    <TestProviders initialState={initialState}>
      <TabSidebarWrapper 
        {...innerOptions} 
        initialTabs={initialTabs}
        initialActiveTabId={initialActiveTabId}
        interfaceId={interfaceId}
        stateContainerRef={stateContainerRef} 
      />
    </TestProviders>
  );

  return {
    ...renderResult,
    user,
    getTabs: () => stateContainerRef.current?.getTabs() ?? [],
    getActiveTabId: () => stateContainerRef.current?.getActiveTabId() ?? null,
    getActiveTabName: () => stateContainerRef.current?.getActiveTabName() ?? null,
    getTabOrder: () => stateContainerRef.current?.getTabOrder() ?? [],
    setActiveTab: (tabId) => stateContainerRef.current?.setActiveTab(tabId),
    addTab: (tab) => stateContainerRef.current?.addTab(tab),
    removeTab: (tabId) => stateContainerRef.current?.removeTab(tabId),
    
    // UI interactions - use tab ID for test IDs
    clickTab: async (tabId: string) => {
      const button = screen.getByTestId(`tab-button-${tabId}`);
      await user.click(button);
    },
    
    clickCreateButton: async () => {
      const button = screen.queryByTestId('create-tab-button') || 
                     screen.queryByTestId('create-tab-button-collapsed');
      if (button) await user.click(button);
    },
    
    openTabMenu: async (tabId: string) => {
      const menuButton = screen.getByTestId(`tab-menu-${tabId}`);
      await user.click(menuButton);
    },
    
    isLoading: () => screen.queryByTestId('tab-list-loading') !== null,
    isEmpty: () => screen.queryByTestId('tab-list-empty') !== null,
    
    getVisibleTabs: () => {
      const tabList = screen.queryByTestId('tab-list');
      if (!tabList) return [];
      const tabs = within(tabList).queryAllByTestId(/^tab-item-/);
      return tabs.map(tab => {
        const testId = tab.getAttribute('data-testid') || '';
        return testId.replace('tab-item-', '');
      });
    },
  };
}
