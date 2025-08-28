"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/misc/cn'
import { 
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeft,
  Edit3,
  Trash2,
  Hammer,
  SquareMousePointer,
  Loader2,
  Star,
  Plus,
  RefreshCw,
  CheckCircle,
  Palette,
  Terminal,
  ChevronLeft,
  ChevronsUpDown,
  Download,
  Settings,
  Save,
  RotateCcw,
  Upload,
  FileInput,
  FileOutput,
  Check,
  FolderTree
} from 'lucide-react'
import { 
  DndContext, 
  closestCenter, 
  type DragEndEvent, 
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor
} from '@dnd-kit/core'
import { 
  SortableContext, 
  arrayMove, 
  useSortable, 
  verticalListSortingStrategy,
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { Switch } from '@/components/UI/switch'
import { Button } from '@/components/UI/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/UI/dropdown-menu'
import { Separator } from '@/components/UI/separator'
import { ScrollArea } from '@/components/UI/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useStoreContext, useStoreApiContext } from '@/contexts/providers/StoreProvider'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { selectActiveTab } from '@/contexts/selectors/tab'
import BaseDialog from '@/components/Common/Dialogs/Base'
import { Input } from '@/components/UI/input'
import { Label } from '@/components/UI/label'
import { Icon } from '@/components/UI/icon-picker'
import { IconSelector } from '@/components/UI/icon-selector'
import SubmitButton from '@/components/Common/Buttons/Submit'
import { HexColorPicker } from "react-colorful"
import { showLoadingToast, showSuccessToast, showErrorToast } from '@/components/Common/Toasts/notifications'
import { 
  ProjectsActions,
  GranularInterfaceActions,
  GranularTabActions,
  GranularTileActions,
  FileActions,
  LogsActions,
  ContextActions,
  CodeActions,
  FavouritesActions,
  Favourite,
  FieldsActions,
  TemplateExportResponse,
  InterfaceTemplateSchema
} from '@/types/interfaces/grid'
import {
  createProject,
  renameProject,
  deleteProject,
  createInterface,
  renameInterface,
  deleteInterface,
  toggleFavourite,
  DeleteProjectOption,
  exportInterfaceTemplate,
  importInterfaceTemplate
} from './actions'
import { withLoadingToast } from '@/components/Common/Toasts/notifications'
import ColorPicker from '@/components/Common/Misc/ColorPicker'
import ActionButton from '@/components/Common/Buttons/Action'
import { debounce } from 'lodash'
import { CSSProperties } from 'react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/UI/popover'
import { useTheme } from 'next-themes'
import { createInterface as createInterfaceAction } from './actions';
import { useSidebarResize } from '@/hooks/InterfaceNav/useSidebarResize'
import { getCookie } from '@/hooks/InterfaceNav/getCookie'
import { useTabStreamingQuery } from '@/hooks/Interfaces/Query/useTabStreamingQuery'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/UI/command"
import { FileUpload } from './Buttons/FileUpload'
import { useListContextsQuery } from '@/hooks/Interfaces/Query/useContextsQuery'
import { CreateProjectDialog } from './Dialogs/CreateProjectDialog'
import { CreateInterfaceDialog } from './Dialogs/CreateInterfaceDialog'
import { CreateTabDialog } from './Dialogs/CreateTabDialog'
import { RenameProjectDialog } from './Dialogs/RenameProjectDialog'

interface ProjectInterface {
  id: string;
  name: string;
  icon?: string;
  order?: number;
  tabs?: ProjectTab[];
}

interface ProjectTab {
  id?: string;
  name: string;
  order?: number;
  color?: string | null;
  icon?: string;
}

interface InterfaceNavProps {
  interfaceId: string
  projectId: string
  isEditMode: boolean
  isCommandMode: boolean
  onEditModeToggle: () => void
  onCommandModeToggle: () => void
  onCreateProject?: () => void
  onNavCollapseChange?: (isCollapsed: boolean) => void
  onRefresh: () => void
  refreshStatus: 'idle' | 'loading' | 'success'
  projectActions: ProjectsActions
  interfaceActions: GranularInterfaceActions
  tabActions: GranularTabActions
  tileActions: GranularTileActions
  fileActions: FileActions
  logsActions: LogsActions
  contextActions: ContextActions
  codeActions: CodeActions
  favouritesActions: FavouritesActions
  initialFavourites: Favourite[]
  setIsSwitchingInterface: React.Dispatch<React.SetStateAction<boolean>>
  setLoadingMessage: React.Dispatch<React.SetStateAction<string>>
  onAddTile: () => void
  fieldsActions: FieldsActions
  syncedInterfaceUIActions?: {
    setActiveTab: (tabIdOrName: string | null) => void
  } | null
}



// Helper to render emoji vs lucide icon with defaults
function renderSidebarIcon(iconStr: string | undefined | null, className: string, type: 'project' | 'interface' | 'tab' = 'tab') {
  // Default icons for each type
  const defaultIcons: Record<string, string> = {
    project: 'folder',      // Default project icon
    interface: 'layout-grid', // Default interface icon
    tab: 'file-text'        // Default tab icon
  };
  
  // Ensure we have a valid type
  const validType = type in defaultIcons ? type : 'tab';
  const defaultIcon = defaultIcons[validType];
  
  // Clean and validate the icon string
  let icon = iconStr;
  if (!icon || typeof icon !== 'string' || icon.trim() === '' || 
      icon === 'null' || icon === 'undefined' || icon === 'none') {
    icon = defaultIcon;
  } else {
    icon = icon.trim();
  }
  
  // Check if it's an emoji or special character
  if (/[^a-zA-Z0-9_-]/.test(icon)) {
    return <span className={cn(className, "inline-flex items-center justify-center")}>{icon}</span>;
  }
  
  // Simple mapping: if icon is "tab", use the default
  if (icon.toLowerCase() === 'tab') {
    icon = defaultIcon;
  }
  
  // Just render the icon directly
  return <Icon name={icon as any} className={className} />;
}

// Sortable Tab Component (hoisted and memoized to avoid remounts during sidebar resize)
interface SortableTabProps {
  tab: ProjectTab;
  isActive: boolean;
  isCollapsed: boolean;
  isTabLoading: boolean;
  onTabClick: (tab: ProjectTab) => void;
  onSaveTab: (tab: ProjectTab) => void;
  onResetTab: (tab: ProjectTab) => void;
  onRenameTab: (tab: ProjectTab) => void;
  onChangeTabIcon: (tab: ProjectTab) => void;
  onChangeTabColor: (tab: ProjectTab) => void;
  onSetTabContext: (tab: ProjectTab) => void;
  onDeleteTab: (tab: ProjectTab) => void;
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
    opacity: isDragging ? 0 : 1, // Hide original element while dragging
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
    >
      <button
        {...attributes}
        {...listeners}
        onClick={() => onTabClick(tab)}
        className={cn(
          "flex-1 min-w-0 flex items-center gap-2 py-2 text-sm rounded-md transition-all cursor-pointer overflow-hidden",
          isCollapsed ? "px-0 justify-center" : "px-3 pr-10 justify-start",
          isActive
            ? "text-primary font-medium hover:bg-black/5 dark:hover:bg-white/5"
            : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5",
          isDragging && "cursor-grabbing"
        )}
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
                {renderSidebarIcon(tab.icon, "h-4 w-4", "tab")}
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
                <div className="text-xs text-muted-foreground mt-1">Hold and drag to reorder</div>
                <div className="text-xs text-muted-foreground">Double-click to change icon</div>
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
              {renderSidebarIcon(tab.icon, "h-4 w-4", "tab")}
            </div>
            <span 
              className="text-sm block max-w-full min-w-0 w-0 flex-1 overflow-hidden truncate text-left select-none" 
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
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="max-w-[200px]">
            <DropdownMenuItem onSelect={() => onSaveTab(tab)}>
              <Save className="h-4 w-4 mr-2" />
              Save Tab
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onResetTab(tab)}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Tab
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onRenameTab(tab)}>
              <Edit3 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onChangeTabIcon(tab)}>
              <Settings className="h-4 w-4 mr-2" />
              Change Icon
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onChangeTabColor(tab)}>
              <Palette className="h-4 w-4 mr-2" />
              Change Color
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSetTabContext(tab)}>
              <FolderTree className="h-4 w-4 mr-2" />
              Set Tab Context
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onDeleteTab(tab)} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
})

export default function InterfaceNav({
  interfaceId,
  projectId,
  isEditMode,
  isCommandMode,
  onEditModeToggle,
  onCommandModeToggle,
  onCreateProject,
  onNavCollapseChange,
  projectActions,
  interfaceActions,
  tabActions,
  tileActions,
  fileActions,
  logsActions,
  contextActions,
  codeActions,
  favouritesActions,
  initialFavourites,
  setIsSwitchingInterface,
  setLoadingMessage,
  onAddTile,
  onRefresh,
  refreshStatus,
  fieldsActions,
  syncedInterfaceUIActions
}: InterfaceNavProps) {

  // Initialize sidebar state from cookies
  const savedCollapsedState = getCookie('sidebar:lastCollapsedState')
  const savedSidebarState = getCookie('sidebar:state')
  
  // Sidebar state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return savedSidebarState === 'collapsed' || savedSidebarState === 'hidden'
  })
  const [isCompletelyHidden, setIsCompletelyHidden] = useState(() => {
    return savedSidebarState === 'hidden'
  })
  const [lastCollapsedState, setLastCollapsedState] = useState<'collapsed' | 'hidden'>(() => {
    return (savedCollapsedState === 'hidden' || savedCollapsedState === 'collapsed') ? savedCollapsedState : 'collapsed'
  })
  
  // Resizable sidebar state
  const defaultWidth = getCookie('sidebar:width') || '16rem'
  const savedLastExpandedWidth = getCookie('sidebar:lastExpandedWidth') || defaultWidth
  const [sidebarWidth, setSidebarWidth] = useState(defaultWidth)
  const [lastExpandedWidth, setLastExpandedWidth] = useState(savedLastExpandedWidth)
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false)
  
  const [favourites, setFavourites] = useState<Favourite[]>(initialFavourites || [])
  const [projectsRefreshing, setProjectsRefreshing] = useState(false)
  
  // New state for the dropdown-based navigation
  const [selectedProject, setSelectedProject] = useState(projectId)
  const [selectedInterface, setSelectedInterface] = useState<string | null>(null)
  
  // Loading states for project and interface transitions
  const [isChangingProject, setIsChangingProject] = useState(false)
  const [isChangingInterface, setIsChangingInterface] = useState(false)
  const [transitioningToProject, setTransitioningToProject] = useState<string | null>(null)
  const [transitioningToInterface, setTransitioningToInterface] = useState<string | null>(null)
  
  // Popover control states
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false)
  const [interfacePopoverOpen, setInterfacePopoverOpen] = useState(false)
  
  // rAF-throttled resize handler to minimize re-renders during drag
  const rafIdRef = useRef<number | null>(null)
  const pendingWidthRef = useRef<string>(defaultWidth)
  const handleResize = useCallback((newWidth: string) => {
    pendingWidthRef.current = newWidth
    if (rafIdRef.current == null) {
      rafIdRef.current = requestAnimationFrame(() => {
        setSidebarWidth(pendingWidthRef.current)
        if (!isCollapsed || parseFloat(pendingWidthRef.current) >= 12) {
          setLastExpandedWidth(pendingWidthRef.current)
        }
        rafIdRef.current = null
      })
    }
  }, [isCollapsed])

  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current)
      // Clean up transition states on unmount
      setIsChangingProject(false)
      setIsChangingInterface(false)
      setTransitioningToProject(null)
      setTransitioningToInterface(null)
      // Don't force close popovers on unmount
    }
  }, [])
  
  // Dialog states
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  
  // Project action states
  const [activeProject, setActiveProject] = useState<string | null>(null)
  const [renameProjectOpen, setRenameProjectOpen] = useState(false)
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false)
  const [isDeletingProject, setIsDeletingProject] = useState(false)
  
  // Interface action states
  const [createInterfaceOpen, setCreateInterfaceOpen] = useState(false)
  const [selectedInterfaceForAction, setSelectedInterfaceForAction] = useState<ProjectInterface | null>(null)
  const [renameInterfaceOpen, setRenameInterfaceOpen] = useState(false)
  const [deleteInterfaceOpen, setDeleteInterfaceOpen] = useState(false)
  const [isRenamingInterface, setIsRenamingInterface] = useState(false)
  const [isDeletingInterface, setIsDeletingInterface] = useState(false)
  const [newInterfaceName, setNewInterfaceName] = useState('') // For rename dialog
  
  // Save as new interface state
  const [saveAsNewInterfaceOpen, setSaveAsNewInterfaceOpen] = useState(false)
  const [saveAsNewInterfaceName, setSaveAsNewInterfaceName] = useState('')
  const [isSavingAsNewInterface, setIsSavingAsNewInterface] = useState(false)
  
  // Tab dialog states
  const [createTabOpen, setCreateTabOpen] = useState(false)
  const [renameTabOpen, setRenameTabOpen] = useState(false)
  const [deleteTabOpen, setDeleteTabOpen] = useState(false)
  const [selectedTab, setSelectedTab] = useState<ProjectTab | null>(null)
  const [newTabName, setNewTabName] = useState('') // For rename dialog
  const [isRenamingTab, setIsRenamingTab] = useState(false)
  const [isDeletingTab, setIsDeletingTab] = useState(false)
  const [tabColorOpen, setTabColorOpen] = useState(false)
  const [newTabColor, setNewTabColor] = useState('')
  const [isSavingTabColor, setIsSavingTabColor] = useState(false)
  
  // Theme dialog state
  const [themeColor, setThemeColor] = useState<string>("")
  const [isSavingTheme, setIsSavingTheme] = useState(false)
  
  // Icon editing states
  const [projectIconOpen, setProjectIconOpen] = useState(false)
  const [newProjectIconEdit, setNewProjectIconEdit] = useState<string>('')
  const [isSavingProjectIcon, setIsSavingProjectIcon] = useState(false)
  const [interfaceIconOpen, setInterfaceIconOpen] = useState(false)
  const [newInterfaceIcon, setNewInterfaceIcon] = useState<string>('')
  const [isSavingInterfaceIcon, setIsSavingInterfaceIcon] = useState(false)
  const [tabIconOpen, setTabIconOpen] = useState(false)
  const [newTabIcon, setNewTabIcon] = useState<string>('')
  const [isSavingTabIcon, setIsSavingTabIcon] = useState(false)
  
  // Import interface states
  const [importInterfaceOpen, setImportInterfaceOpen] = useState(false)
  const [importProjectName, setImportProjectName] = useState<string | null>(null)
  const [isImportingInterface, setIsImportingInterface] = useState(false)
  
  // Drag and drop state
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [initialOffset, setInitialOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 }) // Offset to maintain cursor position during drag
  

  
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  // Get active tab from store instead of URL - reactive
  const activeTabName = useStoreContext((state) => {
    const activeTab = selectActiveTab(state, interfaceId)
    return activeTab?.name || null
  })
  
  // Store hooks for save/reset functionality
  const setSaveInterfaceOpen = useStoreContext((state) => state.setSaveInterfaceOpen)
  const setGlobalContextOpen = useStoreContext((state) => state.setGlobalContextOpen)
  const storeCommands = useStoreContext((state) => state.commands)
  const fileUploadOpen = useStoreContext((state) => state.fileUploadOpen)
  const setFileUploadOpen = useStoreContext((state) => state.setFileUploadOpen)
  const storeAddTab = useStoreContext((state) => state.addTab)
  
  // Fetch project tree using React Query for better caching
  const { data: projectTree = [], isLoading: projectTreeLoading, isFetching: projectTreeFetching, isError: projectTreeError, refetch: refetchProjectTree } = useQuery<
    Array<{project:string; icon:string; interfaces:ProjectInterface[]; favorite:boolean; position:number|null}>
  >({
    queryKey: ['projects', 'tree'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/projects/tree')
        
        if (!res.ok) {
          // Try to get error message from response
          let errorMessage = `Failed to fetch project tree: ${res.status}`
          try {
            const errorData = await res.json()
            if (errorData.detail) {
              errorMessage = errorData.detail
            }
          } catch {
            // Ignore JSON parse errors, use default message
          }
          throw new Error(errorMessage)
        }
        
        const data = await res.json()
        
        // Validate response is actually an array
        if (!Array.isArray(data)) {
          console.error('Invalid project tree response:', data)
          throw new Error('Invalid project tree format')
        }
        
        return data
      } catch (error) {
        console.error('Failed to fetch project tree:', error)
        throw error instanceof Error ? error : new Error('Failed to fetch project tree')
      }
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
  
  // Fetch contexts for file upload
  const { data: contexts = [] } = useListContextsQuery(selectedProject, contextActions)
  
  // Update selected project and interface based on props
  useEffect(() => {
    setSelectedProject(projectId)
    // Reset loading states when project changes (navigation completed)
    setIsChangingProject(false)
    setTransitioningToProject(null)
    // Keep popover open to allow multiple selections
  }, [projectId])
  
  // Reset interface loading states when interface changes
  useEffect(() => {
    setIsChangingInterface(false)
    setTransitioningToInterface(null)
    // Keep popover open to allow multiple selections
  }, [interfaceId])
  
  // Find current interface data
  const currentProjectData = useMemo(() => {
    return projectTree.find(p => p.project === selectedProject)
  }, [projectTree, selectedProject])
  
  const currentInterfaces = useMemo(() => {
    return currentProjectData?.interfaces || []
  }, [currentProjectData])
  
  // Find the current interface from the project tree
  const currentInterface = useMemo(() => {
    // Wait for project tree to load
    if (projectTree.length === 0) return null
    
    if (!interfaceId || !currentInterfaces.length) return null
    
    // Try to find by ID first
    let found = currentInterfaces.find(i => i.id === interfaceId)
    
    // If not found by ID, try to find by matching the current interface parameter from URL
    if (!found) {
      const interfaceParam = searchParams.get('interface')
      if (interfaceParam) {
        found = currentInterfaces.find(i => i.name === interfaceParam)
      }
    }
    
    return found
  }, [interfaceId, currentInterfaces, searchParams, projectTree])
  
  // Use the interfaceId prop directly - parent component handles URL parsing
  useEffect(() => {
    if (interfaceId) {
      setSelectedInterface(interfaceId)
    } else {
      setSelectedInterface(null)
    }
  }, [interfaceId])
  
  // Fetch tabs for the current interface using React Query
  const { data: currentTabs = [], isLoading: tabsLoading, isFetching: tabsFetching, isError: tabsError, error: tabsErrorDetails, refetch: refetchTabs } = useQuery<ProjectTab[]>({
    queryKey: ['tabs', interfaceId],
    queryFn: async () => {
      if (!interfaceId) return []
      
      try {
        const tabs = await tabActions.list(interfaceId)
        
        // Handle various error response formats
        if (!tabs) {
          console.warn('No tabs data returned for interface:', interfaceId)
          return []
        }
        
        // Check if it's an error object instead of array
        if (typeof tabs === 'object' && !Array.isArray(tabs)) {
          // Handle both {error: "..."} and {detail: "..."} formats
          const errorMessage = (tabs as any).error || (tabs as any).detail || 'Invalid response format'
          console.error('Tab fetch error:', errorMessage)
          throw new Error(errorMessage)
        }
        
        // Ensure it's actually an array
        if (!Array.isArray(tabs)) {
          console.error('Invalid tabs response type:', typeof tabs, tabs)
          throw new Error('Expected array of tabs but received ' + typeof tabs)
        }
        
        // Safe to sort now
        return tabs.sort((a, b) => (a.order || 0) - (b.order || 0))
      } catch (error) {
        console.error('Failed to fetch tabs:', error)
        // Re-throw to let React Query handle retries
        throw error instanceof Error ? error : new Error('Failed to fetch tabs')
      }
    },
    enabled: !!interfaceId,
    staleTime: 2 * 60 * 1000, // Consider tabs fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  })
  
  // Tabs loading should check both isLoading (initial) and isFetching (refetch/retry)
  const loadingTabs = tabsLoading || tabsFetching
  
  // Prefetch current tab - must be called unconditionally for React hooks rules
  useTabStreamingQuery(
    interfaceId || '',
    activeTabName,
    selectedProject,
    {
      tabActions,
      tileActions: tileActions as any,
      fieldsActions: fieldsActions as any,
      logsActions: logsActions as any,
      projectsActions: projectActions as any,
      contextActions: contextActions as any,
    }
  )
  
  // Prefetch adjacent tabs for faster navigation
  React.useEffect(() => {
    if (!interfaceId || !activeTabName || !selectedProject) return
    
    const currentTabIndex = currentTabs.findIndex(t => t.name === activeTabName)
    if (currentTabIndex > 0) {
      const prevTab = currentTabs[currentTabIndex - 1]
      // Use the same query key structure as useTabStreamingQuery
      queryClient.prefetchQuery({
        queryKey: ['tabCompleteData', interfaceId, prevTab.name, selectedProject],
        queryFn: async () => {
          // The actual fetching will be done by useTabStreamingQuery when the tab is activated
          // This just ensures the query is registered for prefetching
          return null
        },
        staleTime: Infinity,
        gcTime: Infinity,
      })
    }
    if (currentTabIndex < currentTabs.length - 1) {
      const nextTab = currentTabs[currentTabIndex + 1]
      // Use the same query key structure as useTabStreamingQuery
      queryClient.prefetchQuery({
        queryKey: ['tabCompleteData', interfaceId, nextTab.name, selectedProject],
        queryFn: async () => {
          // The actual fetching will be done by useTabStreamingQuery when the tab is activated
          // This just ensures the query is registered for prefetching
          return null
        },
        staleTime: Infinity,
        gcTime: Infinity,
      })
    }
  }, [interfaceId, activeTabName, selectedProject, currentTabs, queryClient])
  
  // Navigation handlers
  const navigateSoft = useCallback((url: string) => {
    setIsSwitchingInterface(true)
    router.push(url)
  }, [router, setIsSwitchingInterface])
  
  // Navigate without triggering the loading screen (for tab switches)
  const navigateTab = useCallback((url: string) => {
    router.push(url)
  }, [router])
  
  const handleProjectChange = async (newProject: string) => {
    // Check if clicking on already selected project to unselect
    if (selectedProject === newProject) {
      setIsChangingProject(true)
      setTransitioningToProject(newProject)
      setSelectedProject('')
      setSelectedInterface(null)
      setLoadingMessage('Loading projects...')
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.delete('project')
      newParams.delete('interface')
      newParams.delete('tab')
      newParams.set('selectProject', 'true') // Flag to show project selection instead of redirecting
      try {
        navigateSoft(`/interfaces?${newParams.toString()}`)
      } finally {
        // Loading states will be reset in useEffect when projectId prop changes
      }
      return
    }

    setIsChangingProject(true)
    setTransitioningToProject(newProject)
    setLoadingMessage('Loading project...')
    try {
      setSelectedProject(newProject)
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.set('project', newProject)
      newParams.delete('selectProject') // Clear the project selection screen flag
      
      // Find interfaces for the new project
      const projectData = projectTree.find(p => p.project === newProject)
      const interfaces = projectData?.interfaces || []
      
      if (interfaces.length === 1) {
        // Auto-select the only interface
        newParams.set('interface', interfaces[0].name)
      } else if (interfaces.length > 1) {
        // Clear interface selection to show dropdown
        newParams.delete('interface')
        setSelectedInterface(null)
      }
      
      newParams.delete('tab') // Clear tab selection
      navigateSoft(`/interfaces?${newParams.toString()}`)
    } finally {
      // Loading states will be reset in useEffect when projectId prop changes
    }
  }
  
  const handleInterfaceChange = async (newInterfaceName: string) => {
    const iface = currentInterfaces.find(i => i.name === newInterfaceName)
    if (!iface) return
    
    // Check if clicking on already selected interface to unselect
    if (currentInterface?.name === newInterfaceName) {
      setIsChangingInterface(true)
      setTransitioningToInterface(newInterfaceName)
      setLoadingMessage('Loading interfaces...')
      try {
        setSelectedInterface(null)
        const newParams = new URLSearchParams(searchParams.toString())
        newParams.delete('interface')
        newParams.delete('tab')
        newParams.set('selectInterface', 'true') // Flag to show interface selection instead of auto-selecting
        navigateSoft(`/interfaces?${newParams.toString()}`)
          } finally {
      // Loading states will be reset in useEffect when interfaceId prop changes
    }
      return
    }

    setIsChangingInterface(true)
    setTransitioningToInterface(newInterfaceName)
    setLoadingMessage('Loading interface...')
    try {
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.set('interface', iface.name)
      newParams.delete('selectInterface') // Clear the interface selection screen flag
      newParams.delete('tab') // Clear tab selection
      navigateSoft(`/interfaces?${newParams.toString()}`)
          } finally {
        // Loading states will be reset in useEffect when interfaceId prop changes
      }
  }
  
  const handleTabClick = useCallback((tab: ProjectTab) => {
    // Use the interface sync action to switch tabs instantly
    if (syncedInterfaceUIActions?.setActiveTab) {
      syncedInterfaceUIActions.setActiveTab(tab.name)
      
      // Also update URL for consistency (without triggering navigation)
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.set('tab', tab.name)
      window.history.replaceState(null, '', `?${newParams.toString()}`)
    } else {
      // Fallback to URL navigation if sync actions not available
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.set('tab', tab.name)
      navigateTab(`?${newParams.toString()}`)
    }
  }, [syncedInterfaceUIActions, searchParams, navigateTab])
  
  const handleCreateTab = useCallback(async (tabName: string, tabIcon?: string) => {
    if (!interfaceId) throw new Error('No active interface')
    
    try {
      // Create the tab
      const newTab = await tabActions.create(interfaceId, tabName, {})
      
      // If an icon was provided, update the tab with it
      if (tabIcon && newTab.id) {
        try {
          await tabActions.update({
            id: newTab.id,
            interface_id: interfaceId,
            name: tabName,
            data: { icon: tabIcon }
          })
        } catch (error) {
          console.error('Failed to set tab icon:', error)
        }
      }
      
      showSuccessToast(`Tab "${tabName}" created successfully`)
      
      // Ensure the new tab exists in the local store immediately
      storeAddTab(interfaceId, newTab.name, {
        id: newTab.id,
        name: newTab.name,
        visible: true,
        active: true,
        icon: tabIcon,
      } as any)
      
      // Optimistically update tabs cache so it appears immediately
      queryClient.setQueryData(['tabs', interfaceId], (oldData: ProjectTab[] | undefined) => {
        const previous = Array.isArray(oldData) ? oldData : []
        const exists = previous.some(t => (t.id && (newTab as any).id ? t.id === (newTab as any).id : t.name === newTab.name))
        const next = exists ? previous : [...previous, { ...newTab, icon: tabIcon }]
        return next.sort((a, b) => (a.order || 0) - (b.order || 0))
      })
      
      setCreateTabOpen(false)
      const tabNameToNavigate = newTab.name
      
      // Switch to the new tab immediately
      if (syncedInterfaceUIActions) {
        syncedInterfaceUIActions.setActiveTab(tabNameToNavigate)
      } else {
        const newParams = new URLSearchParams(searchParams.toString())
        newParams.set('tab', tabNameToNavigate)
        navigateTab(`?${newParams.toString()}`)
      }
      
      // Background refresh to reconcile with server
      void queryClient.invalidateQueries({ queryKey: ['tabs', interfaceId] })
      void queryClient.invalidateQueries({ queryKey: ['projects', 'tree'] })
    } catch (error) {
      console.error('Failed to create tab:', error)
      throw error instanceof Error ? error : new Error('Failed to create tab')
    }
  }, [interfaceId, tabActions, storeAddTab, queryClient, syncedInterfaceUIActions, searchParams, navigateTab])
  
  const handleRenameTab = async () => {
    if (!selectedTab || !newTabName.trim() || !interfaceId) return
    
    setIsRenamingTab(true)
    try {
      await tabActions.update({
        id: selectedTab.id,
        interface_id: interfaceId,
        name: selectedTab.name,
        data: { name: newTabName.trim() }
      })
      
      showSuccessToast('Tab renamed successfully')
      
      // Navigate to renamed tab if it's active
      if (activeTabName === selectedTab.name) {
        const newParams = new URLSearchParams(searchParams.toString())
        newParams.set('tab', newTabName.trim())
        navigateSoft(`?${newParams.toString()}`)
      }
      
      setRenameTabOpen(false)
      
      // Invalidate both tabs and project tree cache to refresh the list
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tabs', interfaceId] }),
        queryClient.invalidateQueries({ queryKey: ['projects', 'tree'] })
      ])
    } catch (error) {
      console.error('Failed to rename tab:', error)
      showErrorToast('Failed to rename tab')
    } finally {
      setIsRenamingTab(false)
    }
  }
  
  const handleDeleteTab = async () => {
    if (!selectedTab || !interfaceId) return
    
    setIsDeletingTab(true)
    try {
      await tabActions.delete({
        id: selectedTab.id,
        interface_id: interfaceId,
        name: selectedTab.name
      })
      
      showSuccessToast('Tab deleted successfully')
      
      // Navigate away if this was the active tab
      if (activeTabName === selectedTab.name) {
        const newParams = new URLSearchParams(searchParams.toString())
        newParams.delete('tab')
        navigateSoft(`?${newParams.toString()}`)
      }
      
      setDeleteTabOpen(false)
      
      // Invalidate both tabs and project tree cache to refresh the list
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tabs', interfaceId] }),
        queryClient.invalidateQueries({ queryKey: ['projects', 'tree'] })
      ])
    } catch (error) {
      console.error('Failed to delete tab:', error)
      showErrorToast('Failed to delete tab')
    } finally {
      setIsDeletingTab(false)
    }
  }
  
  const handleSaveTabColor = async () => {
    if (!selectedTab || !interfaceId) return
    
    setIsSavingTabColor(true)
    try {
      await tabActions.update({
        id: selectedTab.id,
        interface_id: interfaceId,
        name: selectedTab.name,
        data: { color: newTabColor || undefined }
      })
      
      showSuccessToast('Tab color updated successfully')
      setTabColorOpen(false)
      
      // Invalidate both tabs and project tree cache to refresh the list
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tabs', interfaceId] }),
        queryClient.invalidateQueries({ queryKey: ['projects', 'tree'] })
      ])
    } catch (error) {
      console.error('Failed to update tab color:', error)
      showErrorToast('Failed to update tab color')
    } finally {
      setIsSavingTabColor(false)
    }
  }
  
  const handleCreateProject = useCallback(async (projectName: string, projectIcon?: string) => {
    const result = await createProject(projectName, projectActions, projectTree.map(p => p.project), projectIcon)
    
    if (result.success && result.projectName) {
      // Create default interface
      const existingIfaces: any[] = []
      const ifaceRes = await createInterface(
        'Default',
        result.projectName,
        queryClient,
        { interfaces: interfaceActions, tabs: tabActions, tiles: tileActions },
        existingIfaces
      )

      // Navigate to new project
      const newParams = new URLSearchParams(window.location.search)
      newParams.set('project', result.projectName)
      if (ifaceRes.success && ifaceRes.interface?.name) {
        newParams.set('interface', ifaceRes.interface.name)
      }
      navigateSoft(`/interfaces?${newParams.toString()}`)

      // Refresh
      await refetchProjectTree()
      setCreateProjectOpen(false)
    } else {
      throw new Error(result.error || 'Failed to create project')
    }
  }, [projectTree, projectActions, queryClient, interfaceActions, tabActions, tileActions, navigateSoft, refetchProjectTree])
  
  const handleSaveProjectIcon = async () => {
    if (!activeProject) return
    
    setIsSavingProjectIcon(true)
    try {
      await projectActions.update(activeProject, { icon: newProjectIconEdit || undefined })
      
      showSuccessToast('Project icon updated successfully')
      setProjectIconOpen(false)
      
      // Refresh project tree to show updated icon
      await refetchProjectTree()
    } catch (error) {
      console.error('Failed to update project icon:', error)
      showErrorToast('Failed to update project icon')
    } finally {
      setIsSavingProjectIcon(false)
    }
  }
  
  const handleSaveInterfaceIcon = async () => {
    if (!selectedInterfaceForAction) return
    
    setIsSavingInterfaceIcon(true)
    try {
      await interfaceActions.update({
        interface_id: selectedInterfaceForAction.id,
        data: { icon: newInterfaceIcon || undefined }
      })
      
      showSuccessToast('Interface icon updated successfully')
      setInterfaceIconOpen(false)
      
      // Refresh project tree to show updated icon
      await refetchProjectTree()
    } catch (error) {
      console.error('Failed to update interface icon:', error)
      showErrorToast('Failed to update interface icon')
    } finally {
      setIsSavingInterfaceIcon(false)
    }
  }
  
  const handleSaveTabIcon = async () => {
    if (!selectedTab || !interfaceId) return
    
    setIsSavingTabIcon(true)
    try {
      await tabActions.update({
        id: selectedTab.id,
        interface_id: interfaceId,
        name: selectedTab.name,
        data: { icon: newTabIcon || undefined }
      })
      
      showSuccessToast('Tab icon updated successfully')
      setTabIconOpen(false)
      
      // Invalidate both tabs and project tree cache to refresh the list
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tabs', interfaceId] }),
        queryClient.invalidateQueries({ queryKey: ['projects', 'tree'] })
      ])
    } catch (error) {
      console.error('Failed to update tab icon:', error)
      showErrorToast('Failed to update tab icon')
    } finally {
      setIsSavingTabIcon(false)
    }
  }
  
  const handleToggleFavourite = async () => {
    const currentFavourite = favourites.find(f => f.project === selectedProject) || null
    const result = await toggleFavourite(selectedProject, currentFavourite, favouritesActions, favourites)
    if (result.success && result.newFavourites) {
      setFavourites(result.newFavourites)
      await refetchProjectTree()
    }
  }
  
  const handleExportInterface = async (interfaceId: string) => {
    const iface = currentInterfaces.find(i => i.id === interfaceId)
    if (!iface) return
    
    try {
      await withLoadingToast(
        async () => {
          const result = await interfaceActions.exportTemplate({ interface_id: interfaceId })
          if (result && typeof result === 'object' && 'template' in result) {
            const blob = new Blob([JSON.stringify(result.template, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${iface.name.toLowerCase().replace(/\s+/g, '-')}-template.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          } else {
            throw new Error('Invalid response format')
          }
        },
        {
          loading: 'Exporting interface template...',
          success: 'Template exported successfully!',
          error: 'Failed to export template'
        }
      )
    } catch (error) {
      console.error('Failed to export interface:', error)
    }
  }
  
  const handleRenameProject = useCallback(async (newName: string) => {
    if (!activeProject) throw new Error('No active project')
    
    const result = await renameProject(activeProject, newName, projectActions, projectTree.map(p => p.project))
    
    if (result.success) {
      await refetchProjectTree()
      
      // Navigate to renamed project
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.set('project', newName)
      navigateSoft(`?${newParams.toString()}`)
      
      setRenameProjectOpen(false)
    } else {
      throw new Error(result.error || 'Failed to rename project')
    }
  }, [activeProject, projectActions, projectTree, searchParams, navigateSoft, refetchProjectTree])
  
  const handleDeleteProject = async () => {
    if (!activeProject) return
    
    setIsDeletingProject(true)
    const result = await deleteProject(activeProject, 'project', { project: projectActions.delete })
    
    if (result.success) {
      await refetchProjectTree()
      navigateSoft('/interfaces')
      setDeleteProjectOpen(false)
    } else {
      showErrorToast('Failed to delete project')
    }
    setIsDeletingProject(false)
  }
  
  const handleCreateInterface = useCallback(async (interfaceName: string, interfaceIcon?: string) => {
    if (!activeProject) throw new Error('No active project')
    
    const result = await createInterface(
      interfaceName,
      activeProject,
      queryClient,
      { interfaces: interfaceActions, tabs: tabActions, tiles: tileActions },
      []
    )
    
    if (result.success && result.interface) {
      // If an icon was provided, update the interface with it
      if (interfaceIcon && result.interface.id) {
        try {
          await interfaceActions.update({
            interface_id: result.interface.id,
            data: { icon: interfaceIcon }
          })
        } catch (error) {
          console.error('Failed to set interface icon:', error)
        }
      }
      
      await refetchProjectTree()
      
      // Navigate to new interface
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.set('project', activeProject)
      newParams.set('interface', result.interface.name)
      navigateSoft(`?${newParams.toString()}`)
      
      setCreateInterfaceOpen(false)
    } else {
      throw new Error(result.error || 'Failed to create interface')
    }
  }, [activeProject, queryClient, interfaceActions, tabActions, tileActions, searchParams, navigateSoft, refetchProjectTree])
  
  const handleSaveAsNewInterface = async () => {
    if (!selectedInterfaceForAction || !saveAsNewInterfaceName.trim() || !selectedProject) return
    
    setIsSavingAsNewInterface(true)
    try {
      // First export the current interface as a template
      const exportResult = await interfaceActions.exportTemplate({ interface_id: selectedInterfaceForAction.id })
      if (!exportResult || !('template' in exportResult)) {
        throw new Error('Failed to export interface')
      }
      
      // Then import it with the new name
      const importResult = await importInterfaceTemplate(
        exportResult,
        selectedProject,
        saveAsNewInterfaceName.trim(),
        interfaceActions,
        currentInterfaces
      )
      
      if (importResult.success && importResult.importedInterface) {
        await refetchProjectTree()
        
        // Navigate to the new interface
        const newParams = new URLSearchParams(searchParams.toString())
        newParams.set('project', selectedProject)
        newParams.set('interface', importResult.importedInterface.name)
        navigateSoft(`?${newParams.toString()}`)
        
        setSaveAsNewInterfaceOpen(false)
        setSaveAsNewInterfaceName('')
        showSuccessToast(`Interface "${importResult.importedInterface.name}" created successfully`)
      } else {
        throw new Error(importResult.error || 'Failed to create interface copy')
      }
    } catch (error) {
      console.error('Failed to save as new interface:', error)
      showErrorToast(error instanceof Error ? error.message : 'Failed to save as new interface')
    } finally {
      setIsSavingAsNewInterface(false)
    }
  }
  
  const handleRenameInterface = async () => {
    if (!selectedInterfaceForAction || !newInterfaceName.trim()) return
    
    setIsRenamingInterface(true)
    const result = await renameInterface(
      selectedInterfaceForAction.id,
      selectedInterfaceForAction.name,
      newInterfaceName.trim(),
      interfaceActions,
      currentInterfaces
    )
    
    if (result.success) {
      await refetchProjectTree()
      
      // Navigate to renamed interface
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.set('interface', newInterfaceName.trim())
      navigateSoft(`?${newParams.toString()}`)
      
      setRenameInterfaceOpen(false)
    } else {
      showErrorToast(result.error || 'Failed to rename interface')
    }
    setIsRenamingInterface(false)
  }
  
  const handleDeleteInterface = async () => {
    if (!selectedInterfaceForAction) return
    
    setIsDeletingInterface(true)
    const result = await deleteInterface(selectedInterfaceForAction.id, selectedInterfaceForAction.name, interfaceActions)
    
    if (result.success) {
      await refetchProjectTree()
      
      // Navigate to project if this was the active interface
      if (selectedInterface === selectedInterfaceForAction.id) {
        const newParams = new URLSearchParams(searchParams.toString())
        newParams.delete('interface')
        navigateSoft(`?${newParams.toString()}`)
      }
      
      setDeleteInterfaceOpen(false)
    } else {
      showErrorToast(result.error || 'Failed to delete interface')
    }
    setIsDeletingInterface(false)
  }
  
  const handleExportTemplate = async () => {
    if (!selectedInterfaceForAction) return
    
    const result = await exportInterfaceTemplate(
      selectedInterfaceForAction.id,
      selectedInterfaceForAction.name,
      selectedProject,
      interfaceActions
    )
    
    if (!result.success) {
      showErrorToast(result.error || 'Failed to export template')
    }
  }
  
  const handleImportTemplate = async (templateData: TemplateExportResponse<InterfaceTemplateSchema>) => {
    if (!importProjectName || !templateData) return
    
    setIsImportingInterface(true)
    const result = await importInterfaceTemplate(
      templateData,
      importProjectName,
      templateData.template?.name || 'Imported Interface',
      interfaceActions,
      currentInterfaces
    )
    
    if (result.success && result.importedInterface) {
      await refetchProjectTree()
      
      // Navigate to imported interface
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.set('project', importProjectName)
      newParams.set('interface', result.importedInterface.name)
      navigateSoft(`?${newParams.toString()}`)
      
      setImportInterfaceOpen(false)
      showSuccessToast(`Interface "${result.importedInterface.name}" imported successfully`)
    } else {
      showErrorToast(result.error || 'Failed to import template')
    }
    setIsImportingInterface(false)
  }
  
  // Sidebar resize hook
  const toggleSidebar = () => {
    if (!isCollapsed && !isCompletelyHidden) {
      setLastExpandedWidth(sidebarWidth)
      
      if (lastCollapsedState === 'hidden') {
        setIsCompletelyHidden(true)
        setIsCollapsed(true)
      } else {
        setIsCollapsed(true)
      }
    } else {
      setIsCollapsed(false)
      setIsCompletelyHidden(false)
      setSidebarWidth(lastExpandedWidth)
    }
  }

  const toggleCompletelyHidden = () => {
    setIsCompletelyHidden(prev => !prev)
    if (!isCompletelyHidden) {
      setIsCollapsed(true)
      setLastCollapsedState('hidden')
      document.cookie = `sidebar:lastCollapsedState=hidden; path=/; max-age=${60 * 60 * 24 * 7}`
    } else {
      setIsCollapsed(true)
      setLastCollapsedState('collapsed')
      document.cookie = `sidebar:lastCollapsedState=collapsed; path=/; max-age=${60 * 60 * 24 * 7}`
    }
  }

  const { dragRef, handleMouseDown } = useSidebarResize({
    direction: "right",
    currentWidth: sidebarWidth,
    onResize: handleResize,
    onToggle: toggleSidebar,
    onCompletelyHide: toggleCompletelyHidden,
    isCollapsed,
    isCompletelyHidden,
    minResizeWidth: "12rem",
    maxResizeWidth: "30rem",
    enableAutoCollapse: true,
    autoCollapseThreshold: 0.6,
    completelyHideThreshold: 0.3,
    expandThreshold: 0.15,
    enableDrag: true,
    setIsDragging: setIsDraggingSidebar,
    widthCookieName: "sidebar:width",
    widthCookieMaxAge: 60 * 60 * 24 * 7,
  })
  
  // Theme handling
  const { resolvedTheme } = useTheme()
  
  const debouncedUpdateTheme = useRef(
    debounce(async (color: string) => {
      try {
        await interfaceActions.update({ interface_id: interfaceId, data: { color } })
        await queryClient.invalidateQueries({ predicate: (q) => q.queryKey?.[0] === 'interfaces' })
      } catch (err) {
        console.error('Failed to update interface theme', err)
      }
    }, 250)
  ).current

  const handleThemeChange = (color: string) => {
    setThemeColor(color)
    debouncedUpdateTheme(color)
  }

  const handleThemeReset = async () => {
    setThemeColor('')
    try {
      await interfaceActions.update({ interface_id: interfaceId, data: { color: null as any } })
      await queryClient.invalidateQueries({ predicate: (q) => q.queryKey?.[0] === 'interfaces' })
    } catch (err) {
      console.error('Failed to reset theme colour', err)
    }
  }
  
  useEffect(() => {
    const loadInterfaceColor = async () => {
      if (!interfaceId) return
      try {
        const iface = await interfaceActions.get({ interface_id: interfaceId })
        if (iface && typeof iface.color === 'string' && iface.color.trim() !== '') {
          setThemeColor(iface.color.trim())
        } else {
          setThemeColor('')
        }
      } catch (err) {
        console.error('Failed to fetch interface colour', err)
      }
    }

    loadInterfaceColor()
  }, [interfaceId, interfaceActions])
  
  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    if (themeColor && themeColor.trim() !== '') {
      root.style.setProperty('--primary', themeColor.trim())
      root.style.setProperty('--accent', themeColor.trim())
    } else {
      root.style.removeProperty('--primary')
      root.style.removeProperty('--accent')
    }
  }, [themeColor])
  
  useEffect(() => {
    const root = document.documentElement
    if (isCompletelyHidden) {
      root.style.setProperty('--interface-nav-width', '0px')
    } else if (isCollapsed) {
      root.style.setProperty('--interface-nav-width', '48px')
    } else {
      root.style.setProperty('--interface-nav-width', sidebarWidth)
    }
    
    onNavCollapseChange?.(isCollapsed && !isCompletelyHidden)
  }, [isCollapsed, isCompletelyHidden, sidebarWidth, onNavCollapseChange])
  
  useEffect(() => {
    let state = 'expanded'
    if (isCompletelyHidden) {
      state = 'hidden'
    } else if (isCollapsed) {
      state = 'collapsed'
    }
    document.cookie = `sidebar:state=${state}; path=/; max-age=${60 * 60 * 24 * 7}`
  }, [isCollapsed, isCompletelyHidden])
  
  useEffect(() => {
    if (!isCollapsed && !isCompletelyHidden && sidebarWidth !== '3rem') {
      document.cookie = `sidebar:lastExpandedWidth=${lastExpandedWidth}; path=/; max-age=${60 * 60 * 24 * 7}`
    }
  }, [lastExpandedWidth, isCollapsed, isCompletelyHidden, sidebarWidth])
  
  useEffect(() => {
    if (isCollapsed && !isCompletelyHidden) {
      setLastCollapsedState('collapsed')
      document.cookie = `sidebar:lastCollapsedState=collapsed; path=/; max-age=${60 * 60 * 24 * 7}`
    }
  }, [isCollapsed, isCompletelyHidden])
  
  // Initialize interface name when opening rename dialog
  useEffect(() => {
    if (renameInterfaceOpen && selectedInterfaceForAction) {
      setNewInterfaceName(selectedInterfaceForAction.name)
    }
  }, [renameInterfaceOpen, selectedInterfaceForAction])
  

  
  // Initialize interface name when opening save as new dialog
  useEffect(() => {
    if (saveAsNewInterfaceOpen && selectedInterfaceForAction) {
      setSaveAsNewInterfaceName(`${selectedInterfaceForAction.name} (Copy)`)
    }
  }, [saveAsNewInterfaceOpen, selectedInterfaceForAction])
  
  const getDefaultPrimary = () => (
    typeof window !== 'undefined'
      ? (getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#2a862a')
      : '#2a862a'
  )
  
  const pickerColor = themeColor && themeColor.trim() !== '' ? themeColor : getDefaultPrimary()
  const showModeControls = Boolean(projectId && interfaceId)
  const sidebarStyle = useMemo<CSSProperties>(() => (
    themeColor
      ? ({ '--primary': themeColor, '--accent': themeColor } as CSSProperties)
      : {}
  ), [themeColor])

  // Configure drag sensors with activation constraints
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 12, // Require 12px of movement before drag starts - prevents accidental drags
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end
  const handleTabDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTabId(null)
    setInitialOffset({ x: 0, y: 0 })

    if (!over || active.id === over.id || !interfaceId) {
      return
    }

    const oldIndex = currentTabs.findIndex(tab => (tab.id || tab.name) === active.id)
    const newIndex = currentTabs.findIndex(tab => (tab.id || tab.name) === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    // Optimistically update the UI immediately via query cache
    const newTabs = arrayMove(currentTabs, oldIndex, newIndex)
    queryClient.setQueryData(['tabs', interfaceId], newTabs)

    try {
      // Update the order for all affected tabs
      const updates = newTabs.map((tab, index) => ({
        id: tab.id,
        interface_id: interfaceId,
        name: tab.name,
        data: { order: index }
      }))

      // Update tabs in parallel
      await Promise.all(
        updates.map(update => tabActions.update(update))
      )

      showSuccessToast('Tab order updated')
      
      // Invalidate queries to ensure consistency
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tabs', interfaceId] }),
        queryClient.invalidateQueries({ queryKey: ['projects', 'tree'] })
      ])
    } catch (error) {
      console.error('Failed to update tab order:', error)
      showErrorToast('Failed to update tab order')
      
      // Revert on error
      await refetchTabs()
    }
  }

  // Stable callbacks for tab actions to avoid re-renders while resizing
  const onSaveTab = useCallback((t: ProjectTab) => {
    handleTabClick(t)
    setSaveInterfaceOpen(true)
  }, [handleTabClick, setSaveInterfaceOpen])

  const onResetTab = useCallback((t: ProjectTab) => {
    handleTabClick(t)
    const resetInterfaceCommand = storeCommands.find(cmd => cmd.id === "reset-interface");
    if (resetInterfaceCommand) {
      resetInterfaceCommand.action?.();
    }
  }, [handleTabClick, storeCommands])

  const onRenameTab = useCallback((t: ProjectTab) => {
    setSelectedTab(t)
    setNewTabName(t.name)
    setRenameTabOpen(true)
  }, [setSelectedTab, setNewTabName, setRenameTabOpen])

  const onChangeTabIcon = useCallback((t: ProjectTab) => {
    setSelectedTab(t)
    setNewTabIcon((t.icon && t.icon.trim() !== '' && t.icon !== 'null' && t.icon !== 'undefined') ? t.icon : 'file-text')
    setTabIconOpen(true)
  }, [setSelectedTab, setNewTabIcon, setTabIconOpen])

  const onChangeTabColor = useCallback((t: ProjectTab) => {
    setSelectedTab(t)
    setNewTabColor(t.color || '')
    setTabColorOpen(true)
  }, [setSelectedTab, setNewTabColor, setTabColorOpen])

  const onSetTabContext = useCallback((t: ProjectTab) => {
    handleTabClick(t)
    setGlobalContextOpen(true)
  }, [handleTabClick, setGlobalContextOpen])

  const onDeleteTab = useCallback((t: ProjectTab) => {
    setSelectedTab(t)
    setDeleteTabOpen(true)
  }, [setSelectedTab, setDeleteTabOpen])

  return (
    <TooltipProvider>
      {/* Toggle Button for completely hidden state */}
      {isCompletelyHidden && (
        <div className="fixed left-2 top-[3.125rem] z-[200] animate-in fade-in duration-300">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  toggleSidebar()
                }}
                className="h-8 w-8 bg-background/95 backdrop-blur-sm shadow-sm border"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Show sidebar
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      
      {/* Sidebar Container */}
      <div 
        data-interface-color 
        className={cn(
          "fixed left-0 top-10 h-[calc(100vh-2.5rem)] bg-[color:var(--background)] border-r border-[color:var(--border)] flex flex-col z-20 overflow-hidden",
          isCollapsed ? "w-12" : "",
          isDraggingSidebar ? "" : "transition-all duration-300 ease-in-out",
          isCompletelyHidden && "!w-0 border-0 pointer-events-none opacity-0"
        )}
        style={{
          ...sidebarStyle,
          width: isCompletelyHidden ? '0' : (isCollapsed ? '3rem' : sidebarWidth),
          '--sidebar-width': isCompletelyHidden ? '0' : (isCollapsed ? '3rem' : sidebarWidth),
          transform: isCompletelyHidden ? 'translateX(-100%)' : 'translateX(0)',
        } as CSSProperties}
      >
        {/* Resize Handle */}
        {!isCompletelyHidden && (
          <div
            ref={dragRef}
            onMouseDown={handleMouseDown}
            className={cn(
              "absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize bg-transparent hover:bg-[color:var(--primary)]/50 transition-colors z-10",
              "after:absolute after:top-0 after:bottom-0 after:content-['']",
              isCollapsed ? "after:right-[-6px] after:left-[-2px]" : "after:right-[-2px] after:left-[-2px]",
              isDraggingSidebar && "bg-[color:var(--primary)]/50"
            )}
          />
        )}
        
        {/* Header with Title and Toggle */}
        {!isCompletelyHidden && (
          <div className={cn(
            "flex items-center border-b animate-in fade-in slide-in-from-top-2 duration-300",
            isCollapsed ? "justify-center p-2" : "justify-between p-2 gap-2 min-w-0"
          )}>
            {!isCollapsed && <span className="text-xs text-muted-foreground animate-in fade-in duration-200 truncate select-none uppercase tracking-wider">Interfaces</span>}
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleSidebar}
              className={cn("h-7 w-7 flex-shrink-0", !isCollapsed && "ml-auto")}
            >
              {isCollapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
        
        {/* Projects and Interfaces Section */}
        {!isCompletelyHidden && !isCollapsed && (
          <div className="p-3 space-y-2.5 animate-in fade-in slide-in-from-left-2 duration-300 overflow-x-hidden">
            {/* Projects */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground animate-in fade-in duration-200 delay-75 select-none">Project:</label>
              <div className="flex items-center gap-1 w-full min-w-0 animate-in fade-in slide-in-from-left-1 duration-200 delay-100">
                <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="flex-1 min-w-0 justify-between h-8"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        {renderSidebarIcon(currentProjectData?.icon, "h-4 w-4 flex-shrink-0", "project")}
                        <span className="truncate text-sm">{selectedProject || "Select project"}</span>
                      </div>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[12rem] max-w-[20rem] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Command>
                      <CommandInput placeholder="Search projects..." />
                      {!projectTreeLoading && !projectTreeFetching && (
                        <CommandEmpty>No project found.</CommandEmpty>
                      )}
                      <CommandGroup>
                        {projectTreeError ? (
                          // Error state
                          <div className="p-3 text-center">
                            <p className="text-sm text-destructive mb-2">Failed to load projects</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                refetchProjectTree()
                                // Keep popover open to see the results
                              }}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Retry
                            </Button>
                          </div>
                        ) : (projectTreeLoading || projectTreeFetching) ? (
                          // Loading skeleton for projects
                          <div className="p-1">
                            <div className="p-2 text-center text-xs text-muted-foreground mb-1">Loading projects...</div>
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-sm">
                                <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                                <div className="flex-1 h-4 bg-muted animate-pulse rounded" style={{ width: `${70 + i * 10}%` }} />
                              </div>
                            ))}
                          </div>
                        ) : projectTree.length === 0 ? (
                          // Empty state
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            <svg className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            No projects found
                          </div>
                        ) : (
                          projectTree.map((project) => {
                            const isSelected = projectId === project.project
                            const isLoading = isChangingProject && transitioningToProject === project.project
                            return (
                              <CommandItem
                                key={project.project}
                                value={project.project}
                                onSelect={() => handleProjectChange(project.project)}
                                className={cn(
                                  isSelected && !isLoading && "text-primary"
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0 w-full">
                                  {isLoading ? (
                                    renderSidebarIcon(project.icon, "h-4 w-4 flex-shrink-0", "project")
                                  ) : isSelected ? (
                                    <Check className="h-4 w-4 flex-shrink-0 animate-in fade-in zoom-in duration-200" />
                                  ) : (
                                    renderSidebarIcon(project.icon, "h-4 w-4 flex-shrink-0", "project")
                                  )}
                                  <span className="truncate flex-1">{project.project}</span>
                                  {isLoading && (
                                    <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                                  )}
                                </div>
                              </CommandItem>
                            )
                          })
                        )}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                {/* Project Context Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="max-w-[200px]">
                    <DropdownMenuItem onSelect={() => setCreateProjectOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Project
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      disabled={!selectedProject}
                      onSelect={() => {
                        // Handle create interface for current project
                        setActiveProject(selectedProject)
                        setCreateInterfaceOpen(true)
                      }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Interface
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      disabled={!selectedProject}
                      onSelect={() => {
                        // Handle project rename
                        setActiveProject(selectedProject)
                        setRenameProjectOpen(true)
                      }}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Rename Project
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      disabled={!selectedProject}
                      onSelect={() => {
                        setActiveProject(selectedProject)
                        setNewProjectIconEdit(currentProjectData?.icon || 'folder')
                        setProjectIconOpen(true)
                      }}>
                      <Settings className="h-4 w-4 mr-2" />
                      Change Icon
                    </DropdownMenuItem>
                    {interfaceId && (
                      <ColorPicker value={pickerColor} onChange={handleThemeChange} useDialog={true} showReset={true} onReset={handleThemeReset}>
                        <DropdownMenuItem>
                          <Palette className="h-4 w-4 mr-2" />
                          Set Project Color
                        </DropdownMenuItem>
                      </ColorPicker>
                    )}
                    <DropdownMenuItem 
                      disabled={!selectedProject}
                      onSelect={() => {
                        setImportProjectName(selectedProject)
                        setImportInterfaceOpen(true)
                      }}>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Interface
                    </DropdownMenuItem>
                    {selectedProject !== 'Usage' && (
                      <DropdownMenuItem 
                        disabled={!selectedProject}
                        onSelect={() => {
                          setFileUploadOpen(true)
                        }}>
                        <FileInput className="h-4 w-4 mr-2" />
                        Upload Logs
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      disabled={!selectedProject}
                      onSelect={() => handleToggleFavourite()}>
                      <Star className={cn("h-4 w-4 mr-2", currentProjectData?.favorite && "fill-current")} />
                      {currentProjectData?.favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={async () => {
                      setProjectsRefreshing(true)
                      await refetchProjectTree()
                      setProjectsRefreshing(false)
                    }}>
                      <RefreshCw className={cn("h-4 w-4 mr-2", projectsRefreshing && "animate-spin")} />
                      {projectsRefreshing ? 'Refreshing...' : 'Refresh All'}
                    </DropdownMenuItem>
                    {selectedProject !== 'Usage' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          disabled={!selectedProject}
                          onSelect={() => {
                            setActiveProject(selectedProject)
                            setDeleteProjectOpen(true)
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Project
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            {/* Interfaces */}
            {currentInterfaces.length > 0 && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-left-2 duration-300 delay-100">
                <label className="text-xs font-medium text-muted-foreground select-none">Interface:</label>
                <div className="flex items-center gap-1 w-full min-w-0 animate-in fade-in slide-in-from-left-1 duration-200 delay-150">
                  <Popover open={interfacePopoverOpen} onOpenChange={setInterfacePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="flex-1 min-w-0 justify-between h-8"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                          {renderSidebarIcon(currentInterface?.icon, "h-4 w-4 flex-shrink-0", "interface")}
                          <span className="truncate text-sm">
                            {currentInterface?.name || "Select interface"}
                          </span>
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[12rem] max-w-[20rem] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                      <Command>
                        <CommandInput placeholder="Search interfaces..." />
                        {!projectTreeLoading && !projectTreeFetching && currentInterfaces.length > 0 && (
                          <CommandEmpty>No interface found.</CommandEmpty>
                        )}
                        <CommandGroup>
                          {(projectTreeLoading || projectTreeFetching) ? (
                            // Loading skeleton for interfaces
                            <div className="p-1">
                              <div className="p-2 text-center text-xs text-muted-foreground mb-1">Loading interfaces...</div>
                              {[1, 2].map((i) => (
                                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-sm">
                                  <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                                  <div className="flex-1 h-4 bg-muted animate-pulse rounded" style={{ width: `${80 + i * 10}%` }} />
                                </div>
                              ))}
                            </div>
                          ) : currentInterfaces.length === 0 ? (
                            // Empty state
                            <div className="p-3 text-center text-sm text-muted-foreground">
                              <svg className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                              </svg>
                              No interfaces in this project
                            </div>
                          ) : (
                            currentInterfaces.map((iface) => {
                              const isSelected = currentInterface?.name === iface.name
                              const isLoading = isChangingInterface && transitioningToInterface === iface.name
                              return (
                                <CommandItem
                                  key={iface.name}
                                  value={iface.name}
                                  onSelect={() => handleInterfaceChange(iface.name)}
                                  className={cn(
                                    isSelected && !isLoading && "text-primary"
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0 w-full">
                                    {isLoading ? (
                                      renderSidebarIcon(iface.icon, "h-4 w-4 flex-shrink-0", "interface")
                                    ) : isSelected ? (
                                      <Check className="h-4 w-4 flex-shrink-0 animate-in fade-in zoom-in duration-200" />
                                    ) : (
                                      renderSidebarIcon(iface.icon, "h-4 w-4 flex-shrink-0", "interface")
                                    )}
                                    <span className="truncate flex-1">{iface.name}</span>
                                    {isLoading && (
                                      <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                                    )}
                                  </div>
                                </CommandItem>
                              )
                            })
                          )}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  
                  {/* Interface Context Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="max-w-[200px]">
                      <DropdownMenuItem 
                        disabled={!currentInterface}
                        onSelect={() => {
                          if (currentInterface) {
                            setSaveInterfaceOpen(true)
                          }
                        }}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Interface
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        disabled={!currentInterface}
                        onSelect={() => {
                          if (currentInterface) {
                            setSelectedInterfaceForAction(currentInterface)
                            setSaveAsNewInterfaceOpen(true)
                          }
                        }}>
                        <div className="h-4 w-4 mr-2 relative">
                          <Save className="h-4 w-4" />
                          <Plus className="h-2.5 w-2.5 absolute -top-1 -right-1 rounded-full bg-background text-foreground hover:text-foreground" />
                        </div>
                        Save as New Int...
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        disabled={!selectedProject}
                        onSelect={() => {
                          setActiveProject(selectedProject)
                          setCreateInterfaceOpen(true)
                        }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Interface
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        disabled={!currentInterface}
                        onSelect={() => {
                          if (currentInterface) {
                            setSelectedInterfaceForAction(currentInterface)
                            setRenameInterfaceOpen(true)
                          }
                        }}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Rename Interface
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        disabled={!currentInterface}
                        onSelect={() => {
                          if (currentInterface) {
                            setSelectedInterfaceForAction(currentInterface)
                            setNewInterfaceIcon(currentInterface.icon || 'layout-grid')
                            setInterfaceIconOpen(true)
                          }
                        }}>
                        <Settings className="h-4 w-4 mr-2" />
                        Change Icon
                      </DropdownMenuItem>
                      {interfaceId && (
                        <ColorPicker value={pickerColor} onChange={handleThemeChange} useDialog={true} showReset={true} onReset={handleThemeReset}>
                          <DropdownMenuItem>
                            <Palette className="h-4 w-4 mr-2" />
                            Set Interface Color
                          </DropdownMenuItem>
                        </ColorPicker>
                      )}
                      <DropdownMenuItem 
                        disabled={!currentInterface}
                        onSelect={() => {
                          if (currentInterface) {
                            setSelectedInterfaceForAction(currentInterface)
                            handleExportTemplate()
                          }
                        }}>
                        <Download className="h-4 w-4 mr-2" />
                        Export as Template
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        disabled={!currentInterface}
                        onSelect={() => {
                          if (currentInterface) {
                            setSelectedInterfaceForAction(currentInterface)
                            setDeleteInterfaceOpen(true)
                          }
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Interface
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Show separator and tabs only when both project and interface are selected */}
        {!isCompletelyHidden && !isCollapsed && projectId && interfaceId && (
          <Separator className="animate-in fade-in duration-300 delay-150" />
        )}
        
        {/* Tabs List - Only show when both project and interface are selected */}
        {!isCompletelyHidden && projectId && interfaceId && (
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
            {/* Tabs label and Add button - pinned at top for expanded mode */}
            {!isCollapsed && (
              <div className="px-3 pt-3 pb-2 flex-shrink-0">
                <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="text-xs font-medium text-muted-foreground flex items-center leading-none flex-shrink-0 select-none">Tabs:</label>
                  {interfaceId && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCreateTabOpen(true)}
                          className="h-8 w-8 flex-shrink-0 mr-1"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add new tab</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            )}
            <div className="flex-1 relative overflow-hidden min-h-0">
              <ScrollArea className="h-full w-full">
                <div className={cn("space-y-1 min-w-0 relative", isCollapsed ? "px-2 py-2 pb-6" : "px-3 pt-1 pb-3")}>
              
              {tabsError ? (
                // Error state
                <div className={cn(
                  "text-sm text-destructive text-center animate-in fade-in duration-300",
                  isCollapsed ? "py-4 px-2" : "py-6 px-3"
                )}>
                  <div className="mb-2">
                    <svg className="h-8 w-8 mx-auto text-destructive/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="block break-words select-none mb-2">
                    {tabsErrorDetails instanceof Error ? tabsErrorDetails.message : 'Failed to load tabs'}
                  </span>
                  {!isCollapsed && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => refetchTabs()} 
                      className="mt-2"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                  )}
                </div>
              ) : loadingTabs ? (
                <div className="space-y-1 animate-in fade-in duration-200">
                  {/* Show skeleton loaders that match tab items */}
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
              ) : currentTabs.length === 0 ? (
                <div className={cn(
                  "text-sm text-muted-foreground text-center animate-in fade-in duration-300",
                  isCollapsed ? "py-4" : "py-6 px-2"
                )}>
                  <div className="mb-2">
                    <svg className="h-8 w-8 mx-auto text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="block break-words select-none">No tabs yet</span>
                </div>
              ) : (
                <>
                  {/* Tab drag and drop functionality */}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleTabDragEnd}
                    onDragStart={(event) => {
                      setActiveTabId(event.active.id as string)
                      
                      // Calculate offset to maintain cursor position on dragged element
                      if (event.active.rect.current?.initial && event.activatorEvent) {
                        const rect = event.active.rect.current.initial
                        const mouseEvent = event.activatorEvent as MouseEvent
                        
                        if ('clientX' in mouseEvent && 'clientY' in mouseEvent) {
                          // Calculate offset from element center to click position
                          const offsetX = (mouseEvent.clientX - rect.left) - rect.width / 2
                          const offsetY = (mouseEvent.clientY - rect.top) - rect.height / 2
                          
                          setInitialOffset({ x: offsetX, y: offsetY })
                        }
                      }
                    }}
                    onDragCancel={() => {
                      setActiveTabId(null)
                      setInitialOffset({ x: 0, y: 0 })
                    }}
                  >
                    <SortableContext
                      items={currentTabs.map(tab => tab.id || tab.name)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="w-full space-y-1">
                        {currentTabs.map((tab) => (
                          <SortableTab
                            key={tab.id || tab.name}
                            tab={tab}
                            isActive={activeTabName === tab.name}
                            isCollapsed={isCollapsed}
                            isTabLoading={queryClient.getQueryState(['tabCompleteData', interfaceId, tab.name, selectedProject])?.fetchStatus === 'fetching'}
                            onTabClick={handleTabClick}
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
                    <DragOverlay 
                      dropAnimation={null}
                      modifiers={[
                        ({ transform }) => ({
                          ...transform,
                          x: transform.x + initialOffset.x,
                          y: transform.y + initialOffset.y - 40, // Adjust Y to position element at cursor
                        })
                      ]}
                    >
                      {activeTabId && (() => {
                        const activeTab = currentTabs.find(tab => (tab.id || tab.name) === activeTabId)
                        if (!activeTab) return null
                        
                        return (
                          <div className="bg-background border rounded-md shadow-lg cursor-grabbing pointer-events-none">
                            <div className={cn(
                              "flex items-center gap-2 py-2",
                              isCollapsed ? "px-2 justify-center" : "px-3"
                            )}>
                              {renderSidebarIcon(activeTab.icon, "h-4 w-4", "tab")}
                              {!isCollapsed && <span className="text-sm font-medium select-none">{activeTab.name}</span>}
                            </div>
                          </div>
                        )
                      })()}
                    </DragOverlay>
                  </DndContext>
                </>
              )}
                </div>
              </ScrollArea>
              {/* Fade gradients for smooth scroll effect */}
              <div className={cn(
                "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none z-10",
                isCollapsed ? "h-12 mx-2" : "h-2.5 mx-3"
              )} />
              <div className={cn(
                "absolute top-0 left-0 right-0 bg-gradient-to-b from-background via-background/60 to-transparent pointer-events-none z-10",
                isCollapsed ? "h-4 mx-2" : "h-2.5 mx-3"
              )} />
            </div>
          </div>
        )}
        
        {/* Add tab button for collapsed mode - placed at bottom */}
        {!isCompletelyHidden && isCollapsed && projectId && interfaceId && (
          <div className="p-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCreateTabOpen(true)}
                  className="h-8 w-8 w-full"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Add Tab</TooltipContent>
            </Tooltip>
          </div>
        )}
        
        {/* Separator before mode controls */}
        {!isCompletelyHidden && !isCollapsed && showModeControls && <Separator className="animate-in fade-in duration-200" />}
        
        {/* Mode Controls */}
        {!isCollapsed && !isCompletelyHidden && showModeControls && (
          <div className="p-3 space-y-3 bg-[color:var(--background)] flex-shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-x-hidden">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium flex items-center gap-2 min-w-0 select-none">
                  <Hammer className={cn('h-4 w-4 flex-shrink-0', isEditMode && 'text-primary')} />
                  <span className="truncate">Edit Mode</span>
                </label>
                <Switch checked={isEditMode} onCheckedChange={onEditModeToggle} className="flex-shrink-0 hover:!bg-transparent data-[state=checked]:!bg-primary data-[state=unchecked]:!bg-input" />
              </div>

            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium flex items-center gap-2 min-w-0 select-none">
                <SquareMousePointer className={cn('h-4 w-4 flex-shrink-0', isCommandMode && 'text-primary')} />
                <span className="truncate">Dashboard Mode</span>
              </label>
              <Switch checked={isCommandMode} onCheckedChange={onCommandModeToggle} className="flex-shrink-0 hover:!bg-transparent data-[state=checked]:!bg-primary data-[state=unchecked]:!bg-input" />
            </div>
          </div>
        )}
        
        {/* Separator before collapsed mode controls */}
        {isCollapsed && !isCompletelyHidden && showModeControls && (
          <div className="mt-auto animate-in fade-in duration-200">
            <Separator />
          </div>
        )}
        
        {/* Collapsed Mode Controls */}
        {isCollapsed && !isCompletelyHidden && showModeControls && (
          <div className="p-2 space-y-2 flex flex-col items-center animate-in fade-in duration-300">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onEditModeToggle}
                  className={cn('h-8 w-8', isEditMode && 'text-primary')}
                >
                  <Hammer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isEditMode ? "Disable Edit Mode" : "Enable Edit Mode"}
              </TooltipContent>
            </Tooltip>
            
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onCommandModeToggle}
                  className={cn('h-8 w-8', isCommandMode && 'text-primary')}
                >
                  <SquareMousePointer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isCommandMode ? "Disable Dashboard Mode" : "Enable Dashboard Mode"}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
      
      {/* Dialogs */}
      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        onSubmit={handleCreateProject}
      />
      
      <CreateTabDialog
        open={createTabOpen}
        onOpenChange={setCreateTabOpen}
        onSubmit={handleCreateTab}
      />
      
      {typeof window !== 'undefined' && renameTabOpen && selectedTab && createPortal(
        <BaseDialog
          button={null as any}
          open={renameTabOpen}
          setOpen={setRenameTabOpen}
          title="Rename Tab"
          body={
            <div className="space-y-2 pt-4">
              <Label htmlFor="tab-rename">New Tab Name</Label>
              <Input
                id="tab-rename"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameTab()}
                autoFocus
              />
            </div>
          }
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRenameTabOpen(false)}>
                Cancel
              </Button>
              <SubmitButton
                text="Rename"
                onClick={handleRenameTab}
                loading={isRenamingTab}
              />
            </div>
          }
        />, document.body
      )}
      
      {typeof window !== 'undefined' && deleteTabOpen && selectedTab && createPortal(
        <BaseDialog
          button={null as any}
          open={deleteTabOpen}
          setOpen={setDeleteTabOpen}
          title="Delete Tab"
          body={
            <p className="pt-4">
              Are you sure you want to delete the tab &quot;{selectedTab.name}&quot;? This action cannot be undone.
            </p>
          }
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteTabOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteTab} disabled={isDeletingTab}>
                {isDeletingTab && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </div>
          }
        />, document.body
      )}
      
      {typeof window !== 'undefined' && tabColorOpen && selectedTab && createPortal(
        <BaseDialog
          button={null as any}
          open={tabColorOpen}
          setOpen={setTabColorOpen}
          title={`Tab Color for "${selectedTab.name}"`}
          body={
            <div className="space-y-4 pt-4">
              <div className="flex justify-center">
                <HexColorPicker color={newTabColor || '#2a862a'} onChange={setNewTabColor} />
              </div>
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setNewTabColor('')}>
                  Reset to Default
                </Button>
              </div>
            </div>
          }
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTabColorOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTabColor} disabled={isSavingTabColor}>
                {isSavingTabColor && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          }
        />, document.body
      )}
      
      {/* Icon Edit Dialogs */}
      {typeof window !== 'undefined' && projectIconOpen && activeProject && createPortal(
        <BaseDialog
          button={null as any}
          open={projectIconOpen}
          setOpen={setProjectIconOpen}
          title={`Change Icon for "${activeProject}"`}
          body={
            <div className="space-y-4 pt-4">
              <IconSelector value={newProjectIconEdit as any} onValueChange={setNewProjectIconEdit} />
            </div>
          }
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setProjectIconOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveProjectIcon} disabled={isSavingProjectIcon}>
                {isSavingProjectIcon && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          }
        />, document.body
      )}
      
      {typeof window !== 'undefined' && interfaceIconOpen && selectedInterfaceForAction && createPortal(
        <BaseDialog
          button={null as any}
          open={interfaceIconOpen}
          setOpen={setInterfaceIconOpen}
          title={`Change Icon for "${selectedInterfaceForAction.name}"`}
          body={
            <div className="space-y-4 pt-4">
              <IconSelector value={newInterfaceIcon as any} onValueChange={setNewInterfaceIcon} />
            </div>
          }
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setInterfaceIconOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveInterfaceIcon} disabled={isSavingInterfaceIcon}>
                {isSavingInterfaceIcon && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          }
        />, document.body
      )}
      
      {typeof window !== 'undefined' && tabIconOpen && selectedTab && createPortal(
        <BaseDialog
          button={null as any}
          open={tabIconOpen}
          setOpen={setTabIconOpen}
          title={`Change Icon for "${selectedTab.name}"`}
          body={
            <div className="space-y-4 pt-4">
              <IconSelector value={newTabIcon as any} onValueChange={setNewTabIcon} />
            </div>
          }
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTabIconOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTabIcon} disabled={isSavingTabIcon}>
                {isSavingTabIcon && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          }
        />, document.body
      )}
      
      {/* Project Dialogs */}
      <RenameProjectDialog
        open={renameProjectOpen}
        onOpenChange={setRenameProjectOpen}
        onSubmit={handleRenameProject}
        currentName={activeProject || ''}
      />
      
      {typeof window !== 'undefined' && deleteProjectOpen && activeProject && createPortal(
        <BaseDialog
          button={null as any}
          open={deleteProjectOpen}
          setOpen={setDeleteProjectOpen}
          title={`Delete Project "${activeProject}"`}
          body={
            <p className="pt-4">
              Are you sure you want to delete the project &quot;{activeProject}&quot;? This action cannot be undone.
            </p>
          }
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteProjectOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteProject} disabled={isDeletingProject}>
                {isDeletingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </div>
          }
        />, document.body
      )}
      
      {/* Interface Dialogs */}
      <CreateInterfaceDialog
        open={createInterfaceOpen}
        onOpenChange={setCreateInterfaceOpen}
        onSubmit={handleCreateInterface}
        projectName={activeProject || ''}
      />
      
      {typeof window !== 'undefined' && renameInterfaceOpen && selectedInterfaceForAction && createPortal(
        <BaseDialog
          button={null as any}
          open={renameInterfaceOpen}
          setOpen={setRenameInterfaceOpen}
          title="Rename Interface"
          body={
            <div className="space-y-2 pt-4">
              <Label htmlFor="interface-rename">New Interface Name</Label>
              <Input
                id="interface-rename"
                value={newInterfaceName}
                onChange={(e) => setNewInterfaceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameInterface()}
                autoFocus
              />
            </div>
          }
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRenameInterfaceOpen(false)}>
                Cancel
              </Button>
              <SubmitButton
                text="Rename"
                onClick={handleRenameInterface}
                loading={isRenamingInterface}
              />
            </div>
          }
        />, document.body
      )}
      
      {typeof window !== 'undefined' && deleteInterfaceOpen && selectedInterfaceForAction && createPortal(
        <BaseDialog
          button={null as any}
          open={deleteInterfaceOpen}
          setOpen={setDeleteInterfaceOpen}
          title="Delete Interface"
          body={
            <p className="pt-4">
              Are you sure you want to delete the interface &quot;{selectedInterfaceForAction.name}&quot;? This action cannot be undone.
            </p>
          }
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteInterfaceOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteInterface} disabled={isDeletingInterface}>
                {isDeletingInterface && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </div>
          }
        />, document.body
      )}
      
      {typeof window !== 'undefined' && saveAsNewInterfaceOpen && selectedInterfaceForAction && createPortal(
        <BaseDialog
          button={null as any}
          open={saveAsNewInterfaceOpen}
          setOpen={setSaveAsNewInterfaceOpen}
          title="Save as New Interface"
          body={
            <div className="space-y-2 pt-4">
              <Label htmlFor="new-interface-name">New Interface Name</Label>
              <Input
                id="new-interface-name"
                value={saveAsNewInterfaceName}
                onChange={(e) => setSaveAsNewInterfaceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveAsNewInterface()}
                autoFocus
              />
              <p className="text-sm text-muted-foreground">
                This will create a copy of &quot;{selectedInterfaceForAction.name}&quot; with all its tabs and tiles.
              </p>
            </div>
          }
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSaveAsNewInterfaceOpen(false)}>
                Cancel
              </Button>
              <SubmitButton
                text="Create Copy"
                onClick={handleSaveAsNewInterface}
                loading={isSavingAsNewInterface}
              />
            </div>
          }
        />, document.body
      )}
      
      {/* File Upload Dialog */}
      {fileUploadOpen && (
        <FileUpload
          project={selectedProject}
          contexts={contexts}
          logsActions={logsActions}
          customOpen={fileUploadOpen}
          setCustomOpen={setFileUploadOpen}
        />
      )}
      
      {/* Import Interface Dialog */}
      {typeof window !== 'undefined' && importInterfaceOpen && createPortal(
        <BaseDialog
          button={null as any}
          open={importInterfaceOpen}
          setOpen={setImportInterfaceOpen}
          title={`Import Interface to "${importProjectName}"`}
          body={
            <div className="space-y-4 pt-4">
              <p>Select a JSON template file to import:</p>
              <input
                type="file"
                accept=".json"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    try {
                      const text = await file.text()
                      const templateData = JSON.parse(text) as TemplateExportResponse<InterfaceTemplateSchema>
                      await handleImportTemplate(templateData)
                    } catch (error) {
                      showErrorToast('Invalid template file')
                    }
                  }
                }}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90"
              />
            </div>
          }
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportInterfaceOpen(false)}>
                Cancel
              </Button>
            </div>
          }
        />, document.body
      )}
      
      {/* Floating Add Tile button when Edit Mode is ON */}
      {isEditMode && (
        <div className="fixed z-40 transition-all duration-300 ease-linear pointer-events-none animate-in fade-in slide-in-from-bottom-2" style={{ left: 'calc(var(--interface-nav-width) + 1rem)', bottom: '1rem' }}>
          <div className="pointer-events-auto backdrop-blur-sm bg-background/90 border border-border/50 shadow-md rounded-lg p-1">
            <ActionButton
              className="h-7 px-1.5 text-xs"
              size="sm"
              variant="ghost"
              onClick={onAddTile}
              tooltip="Add new tile"
              icon={<Plus size={12} />}
              text="Add tile"
            />
          </div>
        </div>
      )}
    </TooltipProvider>
  )
} 