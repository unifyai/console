/**
 * Tab Sidebar Test Harness
 * 
 * A reusable wrapper that provides all the mocking and state management
 * needed to test tab management behaviors in isolation.
 * 
 * Since InterfaceNav is extremely complex (3000+ lines with many dependencies),
 * we test a simplified but representative tab sidebar component that exercises
 * the same user interactions.
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
import React, { useState, useCallback } from 'react';
import { render, RenderResult } from '@testing-library/react';
import { vi } from 'vitest';
import { DndContext, closestCenter, DragEndEvent, useSensor, useSensors, MouseSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, Edit2, Palette, Copy, Smile } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

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
}

export interface TabSidebarTestResult extends RenderResult {
  /** Get current tabs */
  getTabs: () => MockTab[];
  /** Get active tab ID */
  getActiveTabId: () => string | null;
  /** Get tab order (IDs) */
  getTabOrder: () => string[];
  /** Programmatically set active tab */
  setActiveTab: (tabId: string) => void;
  /** Programmatically add a tab */
  addTab: (tab: MockTab) => void;
  /** Programmatically remove a tab */
  removeTab: (tabId: string) => void;
}

// =============================================================================
// Mock Data Factories
// =============================================================================

/**
 * Creates mock tab data.
 */
export function createMockTabs(count: number = 3): MockTab[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `tab-${i + 1}`,
    name: `Tab ${i + 1}`,
    color: undefined,
    icon: undefined,
  }));
}

// =============================================================================
// Internal State Container
// =============================================================================

interface StateContainer {
  getTabs: () => MockTab[];
  getActiveTabId: () => string | null;
  getTabOrder: () => string[];
  setActiveTab: (tabId: string) => void;
  addTab: (tab: MockTab) => void;
  removeTab: (tabId: string) => void;
}

// =============================================================================
// Sortable Tab Item Component
// =============================================================================

interface SortableTabProps {
  tab: MockTab;
  isActive: boolean;
  onTabClick: (tabId: string) => void;
  onRename: (tabId: string) => void;
  onDelete: (tabId: string) => void;
  onDuplicate: (tabId: string) => void;
  onChangeColor: (tabId: string) => void;
  onChangeIcon: (tabId: string) => void;
  allowDelete: boolean;
  allowReorder: boolean;
}

function SortableTab({
  tab,
  isActive,
  onTabClick,
  onRename,
  onDelete,
  onDuplicate,
  onChangeColor,
  onChangeIcon,
  allowDelete,
  allowReorder,
}: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id, disabled: !allowReorder });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group ${
        isActive ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'
      }`}
      data-testid={`tab-item-${tab.id}`}
      data-active={isActive}
    >
      {allowReorder && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab opacity-0 group-hover:opacity-100"
          aria-label={`Drag ${tab.name}`}
          data-testid={`drag-handle-${tab.id}`}
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </button>
      )}
      
      <button
        className="flex-1 text-left truncate"
        onClick={() => onTabClick(tab.id)}
        aria-label={tab.name}
        data-testid={`tab-button-${tab.id}`}
        style={{ color: tab.color }}
      >
        {tab.icon && <span className="mr-1">{tab.icon}</span>}
        {tab.name}
      </button>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onRename(tab.id); }}
          aria-label={`Rename ${tab.name}`}
          data-testid={`rename-button-${tab.id}`}
          className="p-1 hover:bg-gray-200 rounded"
        >
          <Edit2 className="h-3 w-3" />
        </button>
        
        <button
          onClick={(e) => { e.stopPropagation(); onChangeColor(tab.id); }}
          aria-label={`Change color of ${tab.name}`}
          data-testid={`color-button-${tab.id}`}
          className="p-1 hover:bg-gray-200 rounded"
        >
          <Palette className="h-3 w-3" />
        </button>
        
        <button
          onClick={(e) => { e.stopPropagation(); onChangeIcon(tab.id); }}
          aria-label={`Change icon of ${tab.name}`}
          data-testid={`icon-button-${tab.id}`}
          className="p-1 hover:bg-gray-200 rounded"
        >
          <Smile className="h-3 w-3" />
        </button>
        
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(tab.id); }}
          aria-label={`Duplicate ${tab.name}`}
          data-testid={`duplicate-button-${tab.id}`}
          className="p-1 hover:bg-gray-200 rounded"
        >
          <Copy className="h-3 w-3" />
        </button>

        {allowDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(tab.id); }}
            aria-label={`Delete ${tab.name}`}
            data-testid={`delete-button-${tab.id}`}
            className="p-1 hover:bg-red-100 rounded text-red-600"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Tab Sidebar Wrapper Component
// =============================================================================

interface TabSidebarWrapperProps extends TabSidebarTestOptions {
  stateContainerRef: React.MutableRefObject<StateContainer | null>;
}

function TabSidebarWrapper({
  initialTabs = createMockTabs(3),
  initialActiveTabId,
  callbacks = {},
  showCreateButton = true,
  allowDelete = true,
  allowReorder = true,
  stateContainerRef,
}: TabSidebarWrapperProps) {
  const [tabs, setTabs] = useState<MockTab[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(
    initialActiveTabId ?? initialTabs[0]?.id ?? null
  );
  const [isCreating, setIsCreating] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // DnD sensors
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } })
  );

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    callbacks.onTabClick?.(tabId);
  }, [callbacks]);

  const handleCreateTab = useCallback(() => {
    if (!newTabName.trim()) return;
    
    const newTab: MockTab = {
      id: `tab-${Date.now()}`,
      name: newTabName.trim(),
    };
    
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setNewTabName('');
    setIsCreating(false);
    callbacks.onCreateTab?.(newTab.name);
  }, [newTabName, callbacks]);

  const handleStartRename = useCallback((tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      setRenamingTabId(tabId);
      setRenameValue(tab.name);
    }
  }, [tabs]);

  const handleFinishRename = useCallback(() => {
    if (!renamingTabId || !renameValue.trim()) {
      setRenamingTabId(null);
      return;
    }
    
    setTabs((prev) =>
      prev.map((t) =>
        t.id === renamingTabId ? { ...t, name: renameValue.trim() } : t
      )
    );
    callbacks.onRenameTab?.(renamingTabId, renameValue.trim());
    setRenamingTabId(null);
  }, [renamingTabId, renameValue, callbacks]);

  const handleDeleteTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId);
      // If deleting active tab, switch to first available
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[0].id);
      }
      return newTabs;
    });
    callbacks.onDeleteTab?.(tabId);
  }, [activeTabId, callbacks]);

  const handleDuplicateTab = useCallback((tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      const newTab: MockTab = {
        id: `tab-${Date.now()}`,
        name: `${tab.name}_copy`,
        color: tab.color,
        icon: tab.icon,
      };
      setTabs((prev) => [...prev, newTab]);
      callbacks.onDuplicateTab?.(tabId);
    }
  }, [tabs, callbacks]);

  const handleChangeColor = useCallback((tabId: string) => {
    // For testing, we just cycle through some colors
    const colors = ['#ff0000', '#00ff00', '#0000ff', undefined];
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId) {
          const currentIndex = colors.indexOf(t.color);
          const nextColor = colors[(currentIndex + 1) % colors.length];
          callbacks.onChangeTabColor?.(tabId, nextColor || '');
          return { ...t, color: nextColor };
        }
        return t;
      })
    );
  }, [callbacks]);

  const handleChangeIcon = useCallback((tabId: string) => {
    // For testing, we cycle through some icons
    const icons = ['📊', '📈', '📉', '🔍', undefined];
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId) {
          const currentIndex = icons.indexOf(t.icon);
          const nextIcon = icons[(currentIndex + 1) % icons.length];
          callbacks.onChangeTabIcon?.(tabId, nextIcon || '');
          return { ...t, icon: nextIcon };
        }
        return t;
      })
    );
  }, [callbacks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTabs((prev) => {
        const oldIndex = prev.findIndex((t) => t.id === active.id);
        const newIndex = prev.findIndex((t) => t.id === over.id);
        const newTabs = arrayMove(prev, oldIndex, newIndex);
        callbacks.onReorderTabs?.(newTabs);
        return newTabs;
      });
    }
  }, [callbacks]);

  // ==========================================================================
  // Expose state to test via ref
  // ==========================================================================

  // Update ref on every render to capture latest state
  React.useEffect(() => {
    stateContainerRef.current = {
      getTabs: () => tabs,
      getActiveTabId: () => activeTabId,
      getTabOrder: () => tabs.map((t) => t.id),
      setActiveTab: setActiveTabId,
      addTab: (tab) => setTabs((prev) => [...prev, tab]),
      removeTab: (tabId) => setTabs((prev) => prev.filter((t) => t.id !== tabId)),
    };
  });

  // Also set immediately for first render
  if (!stateContainerRef.current) {
    stateContainerRef.current = {
      getTabs: () => tabs,
      getActiveTabId: () => activeTabId,
      getTabOrder: () => tabs.map((t) => t.id),
      setActiveTab: setActiveTabId,
      addTab: (tab) => setTabs((prev) => [...prev, tab]),
      removeTab: (tabId) => setTabs((prev) => prev.filter((t) => t.id !== tabId)),
    };
  }

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div
      data-testid="tab-sidebar-container"
      className="w-64 bg-white border-r p-2"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">Tabs</h3>
        {showCreateButton && (
          <button
            onClick={() => setIsCreating(true)}
            aria-label="Create new tab"
            data-testid="create-tab-button"
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Create tab input */}
      {isCreating && (
        <div className="mb-2 flex gap-1" data-testid="create-tab-form">
          <input
            type="text"
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateTab();
              if (e.key === 'Escape') setIsCreating(false);
            }}
            placeholder="Tab name"
            className="flex-1 px-2 py-1 text-sm border rounded"
            autoFocus
            data-testid="new-tab-input"
          />
          <button
            onClick={handleCreateTab}
            className="px-2 py-1 bg-blue-500 text-white text-sm rounded"
            data-testid="confirm-create-button"
          >
            Add
          </button>
        </div>
      )}

      {/* Rename input (shown inline when renaming) */}
      {renamingTabId && (
        <div className="mb-2 flex gap-1" data-testid="rename-tab-form">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFinishRename();
              if (e.key === 'Escape') setRenamingTabId(null);
            }}
            onBlur={handleFinishRename}
            className="flex-1 px-2 py-1 text-sm border rounded"
            autoFocus
            data-testid="rename-tab-input"
          />
        </div>
      )}

      {/* Tab list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={tabs.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1" role="tablist" data-testid="tab-list">
            {tabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onTabClick={handleTabClick}
                onRename={handleStartRename}
                onDelete={handleDeleteTab}
                onDuplicate={handleDuplicateTab}
                onChangeColor={handleChangeColor}
                onChangeIcon={handleChangeIcon}
                allowDelete={allowDelete && tabs.length > 1}
                allowReorder={allowReorder}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Empty state */}
      {tabs.length === 0 && (
        <div className="text-center text-gray-500 py-4" data-testid="empty-state">
          No tabs. Create one to get started.
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Export: renderTabSidebar
// =============================================================================

/**
 * Renders a tab sidebar component with all required mocking and state.
 * 
 * @example
 * ```tsx
 * const { getByTestId, getTabs, getActiveTabId } = renderTabSidebar({
 *   callbacks: { onTabClick: vi.fn() }
 * });
 * 
 * // Click a tab
 * await userEvent.click(getByTestId('tab-button-tab-1'));
 * 
 * // Check state
 * expect(getActiveTabId()).toBe('tab-1');
 * ```
 */
export function renderTabSidebar(options: TabSidebarTestOptions = {}): TabSidebarTestResult {
  const stateContainerRef: React.MutableRefObject<StateContainer | null> = { current: null };

  const renderResult = render(
    <TabSidebarWrapper {...options} stateContainerRef={stateContainerRef} />
  );

  return {
    ...renderResult,
    getTabs: () => stateContainerRef.current?.getTabs() ?? [],
    getActiveTabId: () => stateContainerRef.current?.getActiveTabId() ?? null,
    getTabOrder: () => stateContainerRef.current?.getTabOrder() ?? [],
    setActiveTab: (tabId) => stateContainerRef.current?.setActiveTab(tabId),
    addTab: (tab) => stateContainerRef.current?.addTab(tab),
    removeTab: (tabId) => stateContainerRef.current?.removeTab(tabId),
  };
}

// createMockTabs is already exported above
