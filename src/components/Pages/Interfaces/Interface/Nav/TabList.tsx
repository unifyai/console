"use client"

import React, { useState } from 'react'
import { cn } from '@/utils/misc/cn'
import { 
  Plus,
  MoreHorizontal,
  Loader2,
  Save,
  RotateCcw,
  Edit3,
  Settings,
  Palette,
  FolderTree,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/UI/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/UI/tooltip'
import { ScrollArea } from '@/components/UI/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/UI/dropdown-menu"
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { renderSidebarIcon } from './utils'

// ============================================================================
// Types
// ============================================================================

export interface TabItem {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

export interface TabListProps {
  /** List of tabs */
  tabs: TabItem[];
  /** Currently active tab name */
  activeTabName: string | null;
  /** Whether the sidebar is collapsed */
  isCollapsed: boolean;
  /** Whether tabs are loading */
  isLoading: boolean;
  /** Whether there was an error loading tabs */
  isError: boolean;
  /** Function to check if a specific tab is loading */
  isTabLoading?: (tabId: string) => boolean;
  /** Callback when a tab is clicked */
  onTabClick: (tab: TabItem) => void;
  /** Callback when tabs are reordered */
  onTabReorder: (event: DragEndEvent) => void;
  /** Callback to create a new tab */
  onCreateTab: () => void;
  /** Callback to save a tab */
  onSaveTab: (tab: TabItem) => void;
  /** Callback to reset a tab */
  onResetTab: (tab: TabItem) => void;
  /** Callback to rename a tab */
  onRenameTab: (tab: TabItem) => void;
  /** Callback to change tab icon */
  onChangeTabIcon: (tab: TabItem) => void;
  /** Callback to change tab color */
  onChangeTabColor: (tab: TabItem) => void;
  /** Callback to set tab context */
  onSetTabContext: (tab: TabItem) => void;
  /** Callback to delete a tab */
  onDeleteTab: (tab: TabItem) => void;
  /** Callback to retry loading tabs on error */
  onRetry?: () => void;
}

// ============================================================================
// SortableTab Component
// ============================================================================

interface SortableTabProps {
  tab: TabItem;
  isActive: boolean;
  isCollapsed: boolean;
  isTabLoading: boolean;
  onTabClick: (tab: TabItem) => void;
  onSaveTab: (tab: TabItem) => void;
  onResetTab: (tab: TabItem) => void;
  onRenameTab: (tab: TabItem) => void;
  onChangeTabIcon: (tab: TabItem) => void;
  onChangeTabColor: (tab: TabItem) => void;
  onSetTabContext: (tab: TabItem) => void;
  onDeleteTab: (tab: TabItem) => void;
}

const SortableTab = React.memo(function SortableTab({
  tab,
  isActive,
  isCollapsed,
  isTabLoading,
  onTabClick,
  onSaveTab,
  onResetTab,
  onRenameTab,
  onChangeTabIcon,
  onChangeTabColor,
  onSetTabContext,
  onDeleteTab,
}: SortableTabProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id || tab.name })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 999 : 'auto',
  } as React.CSSProperties

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "group relative flex items-center animate-in fade-in slide-in-from-bottom-1 duration-200 w-full", 
        isDragging && "z-50"
      )}
      data-testid={`tab-item-${tab.id}`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={() => onTabClick(tab)}
        className={cn(
          "flex-1 min-w-0 flex items-center gap-2 py-1.5 text-body-sm rounded-md transition-all cursor-pointer overflow-hidden",
          isCollapsed ? "px-0 justify-center" : "px-3 pr-10 justify-start",
          isActive
            ? "text-primary text-strong hover:bg-black/5 dark:hover:bg-white/5"
            : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5",
          isDragging && "cursor-grabbing"
        )}
        data-testid={`tab-button-${tab.id}`}
        aria-selected={isActive}
        role="tab"
      >
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="flex items-center justify-center w-full relative"
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  onChangeTabIcon(tab)
                }}
              >
                {renderSidebarIcon(tab.icon, "h-3 w-3", "tab")}
                {isTabLoading && (
                  <div className="absolute -top-1 -right-1">
                    <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <div>
                <div>{tab.name}</div>
                <div className="text-caption text-muted-foreground mt-1">Hold and drag to reorder</div>
                <div className="text-caption text-muted-foreground">Double-click to change icon</div>
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden w-full">
            <div 
              className="w-4 h-4 flex-shrink-0 flex items-center justify-center"
              onDoubleClick={(e) => {
                e.stopPropagation()
                onChangeTabIcon(tab)
              }}
            >
              {renderSidebarIcon(tab.icon, "h-3 w-3", "tab")}
            </div>
            <span 
              className="text-body-sm block max-w-full min-w-0 w-0 flex-1 overflow-hidden truncate text-left select-none" 
              title={tab.name}
              onDoubleClick={(e) => {
                e.stopPropagation()
                onRenameTab(tab)
              }}
            >
              {tab.name}
            </span>
            {isTabLoading && (
              <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
            )}
          </div>
        )}
      </button>
      {!isCollapsed && (
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-8 w-8 transition-opacity absolute right-1 top-1/2 -translate-y-1/2",
                dropdownOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
              data-testid={`tab-menu-${tab.id}`}
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="max-w-[200px]">
            <DropdownMenuItem onSelect={() => onSaveTab(tab)} className="text-body-sm" data-testid={`tab-save-${tab.id}`}>
              <Save className="h-4 w-4 mr-2" />
              Save Tab
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onResetTab(tab)} className="text-body-sm" data-testid={`tab-reset-${tab.id}`}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Tab
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onRenameTab(tab)} className="text-body-sm" data-testid={`tab-rename-${tab.id}`}>
              <Edit3 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onChangeTabIcon(tab)} className="text-body-sm" data-testid={`tab-icon-${tab.id}`}>
              <Settings className="h-4 w-4 mr-2" />
              Change Icon
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onChangeTabColor(tab)} className="text-body-sm" data-testid={`tab-color-${tab.id}`}>
              <Palette className="h-4 w-4 mr-2" />
              Change Color
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSetTabContext(tab)} className="text-body-sm" data-testid={`tab-context-${tab.id}`}>
              <FolderTree className="h-4 w-4 mr-2" />
              Set Tab Context
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onDeleteTab(tab)} className="text-destructive text-body-sm" data-testid={`tab-delete-${tab.id}`}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
})

// ============================================================================
// TabList Component
// ============================================================================

export function TabList({
  tabs,
  activeTabName,
  isCollapsed,
  isLoading,
  isError,
  isTabLoading = () => false,
  onTabClick,
  onTabReorder,
  onCreateTab,
  onSaveTab,
  onResetTab,
  onRenameTab,
  onChangeTabIcon,
  onChangeTabColor,
  onSetTabContext,
  onDeleteTab,
  onRetry,
}: TabListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  )

  return (
    <div 
      className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500"
      data-testid="tab-list-container"
    >
      {/* Tab list header with add button */}
      {!isCollapsed && (
        <div className="px-2 pt-1.5 pb-1 flex-shrink-0">
          <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200">
            <label className="text-body-sm text-muted-foreground flex items-center leading-none flex-shrink-0 select-none">Tabs:</label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCreateTab}
                  className="h-6 w-6"
                  data-testid="create-tab-button"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Tab</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Tab list content */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <ScrollArea className="h-full">
          <div className={cn(
            "space-y-0.5 h-full",
            isCollapsed ? "px-1" : "px-2"
          )}>
            {isError ? (
              <div className="p-3 text-center animate-in fade-in duration-300" data-testid="tab-list-error">
                <p className="text-body text-destructive mb-2">Failed to load tabs</p>
                {onRetry && (
                  <Button size="sm" variant="ghost" onClick={onRetry}>
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                )}
              </div>
            ) : isLoading ? (
              <div className="space-y-1 animate-in fade-in duration-200" data-testid="tab-list-loading">
                {[1, 2, 3].map((i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "flex items-center gap-2 py-2 animate-in fade-in duration-200",
                      isCollapsed ? "px-0 justify-center" : "px-3"
                    )}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    {isCollapsed ? (
                      <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                    ) : (
                      <>
                        <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                        <div className="flex-1 h-4 bg-muted animate-pulse rounded" style={{ width: `${60 + i * 20}%` }} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : tabs.length === 0 ? (
              <div 
                className={cn(
                  "text-body text-muted-foreground text-center animate-in fade-in duration-300",
                  isCollapsed ? "py-4" : "py-6 px-2"
                )}
                data-testid="tab-list-empty"
              >
                <div className="mb-2">
                  <svg className="h-8 w-8 mx-auto text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="block break-words select-none">No tabs yet</span>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onTabReorder}
              >
                <SortableContext
                  items={tabs.map(tab => tab.id || tab.name)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="w-full space-y-1" role="tablist" data-testid="tab-list">
                    {tabs.map((tab) => (
                      <SortableTab
                        key={tab.id || tab.name}
                        tab={tab}
                        isActive={activeTabName === tab.name}
                        isCollapsed={isCollapsed}
                        isTabLoading={isTabLoading(tab.id)}
                        onTabClick={onTabClick}
                        onSaveTab={onSaveTab}
                        onResetTab={onResetTab}
                        onRenameTab={onRenameTab}
                        onChangeTabIcon={onChangeTabIcon}
                        onChangeTabColor={onChangeTabColor}
                        onSetTabContext={onSetTabContext}
                        onDeleteTab={onDeleteTab}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </ScrollArea>
        {/* Fade gradients */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none z-10",
          isCollapsed ? "h-8 mx-1" : "h-2 mx-2"
        )} />
        <div className={cn(
          "absolute top-0 left-0 right-0 bg-gradient-to-b from-background via-background/60 to-transparent pointer-events-none z-10",
          isCollapsed ? "h-3 mx-1" : "h-2 mx-2"
        )} />
      </div>

      {/* Add tab button for collapsed mode */}
      {isCollapsed && (
        <div className="p-1 animate-in fade-in slide-in-from-bottom-1 duration-300">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCreateTab}
                className="h-7 w-7 w-full"
                data-testid="create-tab-button-collapsed"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Add Tab</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  )
}

export default TabList;

