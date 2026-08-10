'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
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
  FolderTree,
  Share2,
  ArrowRightLeft,
} from 'lucide-react';
// import { BreadcrumbNav } from './BreadcrumbNav'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Switch } from '@/components/UI/switch';
import { Button } from '@/components/UI/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/UI/dropdown-menu';
import { Separator } from '@/components/UI/separator';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useStoreContext, useStoreApiContext } from '@/contexts/providers/StoreProvider';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useGetInterfaceByIdQuery } from '@/hooks/Interfaces/Query/useInterfacesQuery';
import { selectActiveTab } from '@/contexts/selectors/tab';
import BaseDialog from '@/components/Common/Dialogs/Base';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Icon } from '@/components/UI/icon-picker';
import { IconSelector } from '@/components/UI/icon-selector';
import SubmitButton from '@/components/Common/Buttons/Submit';
import { HexColorPicker } from 'react-colorful';
import {
  showLoadingToast,
  showSuccessToast,
  showErrorToast,
} from '@/components/Common/Toasts/notifications';
import type {
  ProjectsActions,
  GranularInterfaceActions,
  GranularTabActions,
  GranularTileActions,
  LogsActions,
  ContextActions,
  FavouritesActions,
  Favourite,
  FieldsActions,
  TemplateExportResponse,
  InterfaceTemplateSchema,
} from '@/types/interfaces/grid';
import { ResourcesActions } from '@/types/resource';
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
  importInterfaceTemplate,
} from './actions';
import { withLoadingToastFn } from '@/components/Common/Toasts/notifications';
import ColorPicker from '@/components/Common/Misc/ColorPicker';
import ActionButton from '@/components/Common/Buttons/Action';
import { debounce } from '@/utils/misc/debounce';
import { CSSProperties } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/UI/popover';
import { useTheme } from 'next-themes';
import { createInterface as createInterfaceAction } from './actions';
import { useSidebarResize } from '@/hooks/InterfaceNav/useSidebarResize';
import { getCookie } from '@/hooks/InterfaceNav/getCookie';
import { useTabStreamingQuery } from '@/hooks/Interfaces/Query/useTabStreamingQuery';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/UI/command';
import { FileUpload } from './Buttons/FileUpload';
import { useListContextsQuery } from '@/hooks/Interfaces/Query/useContextsQuery';
import { ProjectPicker, InterfacePicker, renderSidebarIcon as renderSidebarIconUtil } from './Nav';
import { User } from '@/types/user';
import { CreateProjectDialog } from './Dialogs/CreateProjectDialog';
import { CreateInterfaceDialog } from './Dialogs/CreateInterfaceDialog';
import { CreateTabDialog } from './Dialogs/CreateTabDialog';
import { RenameProjectDialog } from './Dialogs/RenameProjectDialog';
import ContextTreePicker from '@/components/Common/Dropdowns/ContextTreePicker';
import { ShareProjectDialog } from './Dialogs/ShareProjectDialog';
import { TransferProjectDialog } from './Dialogs/TransferProjectDialog';
import { useProjectPermissions } from '@/contexts/hooks/interface/useProjectPermissions';
import { isImeComposing } from '@/utils/keyboard';

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
  interfaceId: string;
  projectId: string;
  isEditMode: boolean;
  isCommandMode: boolean;
  onEditModeToggle: () => void;
  onCommandModeToggle: () => void;
  onCreateProject?: () => void;
  onNavCollapseChange?: (isCollapsed: boolean) => void;
  onRefresh: () => void;
  refreshStatus: 'idle' | 'loading' | 'success';
  projectActions: ProjectsActions;
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  logsActions: LogsActions;
  contextActions: ContextActions;
  favouritesActions: FavouritesActions;
  initialFavourites: Favourite[];
  resourcesActions: ResourcesActions;
  setIsSwitchingInterface: (isSwitching: boolean) => void;
  userMeta: Pick<User, 'organizations' | 'id'>;
  setLoadingMessage: React.Dispatch<React.SetStateAction<string>>;
  onAddTile: () => void;
  fieldsActions: FieldsActions;
  syncedInterfaceUIActions?: {
    setActiveTab: (tabIdOrName: string | null) => void;
  } | null;
}

// Re-export the shared renderSidebarIcon utility
const renderSidebarIcon = renderSidebarIconUtil;

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
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id || tab.name,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1, // Hide original element while dragging
    zIndex: isDragging ? 999 : 'auto',
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex w-full items-center duration-200 animate-in fade-in slide-in-from-bottom-1',
        isDragging && 'z-50'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={() => onTabClick(tab)}
        className={cn(
          'text-body-sm flex min-w-0 flex-1 cursor-pointer items-center gap-2 overflow-hidden rounded-lg py-2 transition-all',
          isCollapsed ? 'justify-center px-0' : 'justify-start px-3 pr-10',
          isActive
            ? 'bg-accent-soft text-accent-soft-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground',
          isDragging && 'cursor-grabbing'
        )}
      >
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="relative flex w-full items-center justify-center"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onChangeTabIcon(tab);
                }}
              >
                {renderSidebarIcon(tab.icon, 'h-3 w-3', 'tab')}
                {isTabLoading && (
                  <div className="absolute -right-1 -top-1">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <div>
                <div>{tab.name}</div>
                <div className="text-caption mt-1 text-muted-foreground">
                  Hold and drag to reorder
                </div>
                <div className="text-caption text-muted-foreground">
                  Double-click to change icon
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex w-full min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <div
              className={cn(
                'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg',
                isActive ? 'bg-card text-accent-soft-foreground' : 'bg-muted text-muted-foreground'
              )}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onChangeTabIcon(tab);
              }}
            >
              {renderSidebarIcon(tab.icon, 'h-3.5 w-3.5', 'tab')}
            </div>
            <span
              className="text-body-sm block w-0 min-w-0 max-w-full flex-1 select-none overflow-hidden truncate text-left font-medium"
              title={tab.name}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onRenameTab(tab);
              }}
            >
              {tab.name}
            </span>
            {isTabLoading && <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />}
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
                'absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 transition-opacity',
                dropdownOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="max-w-[200px]">
            <DropdownMenuItem onSelect={() => onSaveTab(tab)} className="text-body-sm">
              <Save className="mr-2 h-4 w-4" />
              Save Tab
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onResetTab(tab)} className="text-body-sm">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Tab
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onRenameTab(tab)} className="text-body-sm">
              <Edit3 className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onChangeTabIcon(tab)} className="text-body-sm">
              <Settings className="mr-2 h-4 w-4" />
              Change Icon
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onChangeTabColor(tab)} className="text-body-sm">
              <Palette className="mr-2 h-4 w-4" />
              Change Color
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSetTabContext(tab)} className="text-body-sm">
              <FolderTree className="mr-2 h-4 w-4" />
              Set Tab Context
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onDeleteTab(tab)}
              className="text-body-sm text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
});

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
  logsActions,
  contextActions,
  favouritesActions,
  initialFavourites,
  resourcesActions,
  setIsSwitchingInterface,
  setLoadingMessage,
  onAddTile,
  onRefresh,
  refreshStatus,
  fieldsActions,
  syncedInterfaceUIActions,
  userMeta,
}: InterfaceNavProps) {
  // Initialize sidebar state from cookies
  const savedCollapsedState = getCookie('sidebar:lastCollapsedState');
  const savedSidebarState = getCookie('sidebar:state');

  // Sidebar state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return savedSidebarState === 'collapsed' || savedSidebarState === 'hidden';
  });
  const [isCompletelyHidden, setIsCompletelyHidden] = useState(() => {
    return savedSidebarState === 'hidden';
  });
  const [lastCollapsedState, setLastCollapsedState] = useState<'collapsed' | 'hidden'>(() => {
    return savedCollapsedState === 'hidden' || savedCollapsedState === 'collapsed'
      ? savedCollapsedState
      : 'collapsed';
  });

  // Resizable sidebar state
  const defaultWidth = getCookie('sidebar:width') || '16rem';
  const savedLastExpandedWidth = getCookie('sidebar:lastExpandedWidth') || defaultWidth;
  const [sidebarWidth, setSidebarWidth] = useState(defaultWidth);
  const [lastExpandedWidth, setLastExpandedWidth] = useState(savedLastExpandedWidth);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);

  const [favourites, setFavourites] = useState<Favourite[]>(initialFavourites || []);
  const [projectsRefreshing, setProjectsRefreshing] = useState(false);

  // New state for the dropdown-based navigation
  const [selectedProject, setSelectedProject] = useState(projectId);
  const [selectedInterface, setSelectedInterface] = useState<string | null>(null);

  // Loading states for project and interface transitions
  const [isChangingProject, setIsChangingProject] = useState(false);
  const [isChangingInterface, setIsChangingInterface] = useState(false);
  const [transitioningToProject, setTransitioningToProject] = useState<string | null>(null);
  const [transitioningToInterface, setTransitioningToInterface] = useState<string | null>(null);

  // Popover control states
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
  const [interfacePopoverOpen, setInterfacePopoverOpen] = useState(false);

  // rAF-throttled resize handler to minimize re-renders during drag
  const rafIdRef = useRef<number | null>(null);
  const pendingWidthRef = useRef<string>(defaultWidth);
  const handleResize = useCallback(
    (newWidth: string) => {
      pendingWidthRef.current = newWidth;
      if (rafIdRef.current == null) {
        rafIdRef.current = requestAnimationFrame(() => {
          setSidebarWidth(pendingWidthRef.current);
          if (!isCollapsed || parseFloat(pendingWidthRef.current) >= 12) {
            setLastExpandedWidth(pendingWidthRef.current);
          }
          rafIdRef.current = null;
        });
      }
    },
    [isCollapsed]
  );

  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      // Clean up transition states on unmount
      setIsChangingProject(false);
      setIsChangingInterface(false);
      setTransitioningToProject(null);
      setTransitioningToInterface(null);
      // Don't force close popovers on unmount
    };
  }, []);

  // Dialog states
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  // Project action states
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [renameProjectOpen, setRenameProjectOpen] = useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Share and Transfer dialog states
  const [shareProjectOpen, setShareProjectOpen] = useState(false);
  const [transferProjectOpen, setTransferProjectOpen] = useState(false);

  // Permissions hook
  const permissions = useProjectPermissions({
    userId: userMeta.id || '',
    selectedProject: selectedProject,
    getProject: projectActions.getProject,
    fetchPermissions: resourcesActions.listAccess,
    fetchRoles: resourcesActions.listRoles,
  });

  // Interface action states
  const [createInterfaceOpen, setCreateInterfaceOpen] = useState(false);
  const [selectedInterfaceForAction, setSelectedInterfaceForAction] =
    useState<ProjectInterface | null>(null);
  const [renameInterfaceOpen, setRenameInterfaceOpen] = useState(false);
  const [deleteInterfaceOpen, setDeleteInterfaceOpen] = useState(false);
  const [isRenamingInterface, setIsRenamingInterface] = useState(false);
  const [isDeletingInterface, setIsDeletingInterface] = useState(false);
  const [newInterfaceName, setNewInterfaceName] = useState(''); // For rename dialog

  // Save as new interface state
  const [saveAsNewInterfaceOpen, setSaveAsNewInterfaceOpen] = useState(false);
  const [saveAsNewInterfaceName, setSaveAsNewInterfaceName] = useState('');
  const [isSavingAsNewInterface, setIsSavingAsNewInterface] = useState(false);

  // Tab dialog states
  const [createTabOpen, setCreateTabOpen] = useState(false);
  const [renameTabOpen, setRenameTabOpen] = useState(false);
  const [deleteTabOpen, setDeleteTabOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<ProjectTab | null>(null);
  const [newTabName, setNewTabName] = useState(''); // For rename dialog
  const [isRenamingTab, setIsRenamingTab] = useState(false);
  const [isDeletingTab, setIsDeletingTab] = useState(false);
  const [tabColorOpen, setTabColorOpen] = useState(false);
  const [newTabColor, setNewTabColor] = useState('');
  const [isSavingTabColor, setIsSavingTabColor] = useState(false);

  // Theme dialog state
  const [themeColor, setThemeColor] = useState<string>('');
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  // Icon editing states
  const [projectIconOpen, setProjectIconOpen] = useState(false);
  const [newProjectIconEdit, setNewProjectIconEdit] = useState<string>('');
  const [isSavingProjectIcon, setIsSavingProjectIcon] = useState(false);
  const [interfaceIconOpen, setInterfaceIconOpen] = useState(false);
  const [newInterfaceIcon, setNewInterfaceIcon] = useState<string>('');
  const [isSavingInterfaceIcon, setIsSavingInterfaceIcon] = useState(false);
  const [tabIconOpen, setTabIconOpen] = useState(false);
  const [newTabIcon, setNewTabIcon] = useState<string>('');
  const [isSavingTabIcon, setIsSavingTabIcon] = useState(false);

  // Import interface states
  const [importInterfaceOpen, setImportInterfaceOpen] = useState(false);
  const [importProjectName, setImportProjectName] = useState<string | null>(null);
  const [isImportingInterface, setIsImportingInterface] = useState(false);

  // Drag and drop state
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [initialOffset, setInitialOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 }); // Offset to maintain cursor position during drag

  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // Get active tab from store instead of URL - reactive
  const activeTabName = useStoreContext((state) => {
    const activeTab = selectActiveTab(state, interfaceId);
    return activeTab?.name || null;
  });

  // Get active tab ID for hidden tiles
  const activeTabIdFromStore = useStoreContext((state) => {
    const activeTab = selectActiveTab(state, interfaceId);
    return activeTab?.id || null;
  });

  // Store hooks for save/reset functionality
  const setSaveInterfaceOpen = useStoreContext((state) => state.setSaveInterfaceOpen);
  const setGlobalContextOpen = useStoreContext((state) => state.setGlobalContextOpen);
  const storeCommands = useStoreContext((state) => state.commands);
  const fileUploadOpen = useStoreContext((state) => state.fileUploadOpen);
  const setFileUploadOpen = useStoreContext((state) => state.setFileUploadOpen);
  const storeAddTab = useStoreContext((state) => state.addTab);

  // Fetch project tree using React Query for better caching
  const {
    data: projectTree = [],
    isLoading: projectTreeLoading,
    isFetching: projectTreeFetching,
    isError: projectTreeError,
    refetch: refetchProjectTree,
  } = useQuery<
    Array<{
      projectName: string;
      icon: string;
      interfaces: ProjectInterface[];
      favorite: boolean;
      position: number | null;
    }>
  >({
    queryKey: ['projects', 'tree'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/projects/tree');

        if (!res.ok) {
          // Try to get error message from response
          let errorMessage = `Failed to fetch project tree: ${res.status}`;
          try {
            const errorData = await res.json();
            if (errorData.detail) {
              errorMessage = errorData.detail;
            }
          } catch {
            // Ignore JSON parse errors, use default message
          }
          throw new Error(errorMessage);
        }

        const data = await res.json();

        // Validate response is actually an array
        if (!Array.isArray(data)) {
          console.error('Invalid project tree response:', data);
          throw new Error('Invalid project tree format');
        }

        return data;
      } catch (error) {
        console.error('Failed to fetch project tree:', error);
        throw error instanceof Error ? error : new Error('Failed to fetch project tree');
      }
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch contexts for file upload
  const { data: contexts = [] } = useListContextsQuery(selectedProject, contextActions);

  // Update selected project and interface based on props
  useEffect(() => {
    setSelectedProject(projectId);
    // Reset loading states when project changes (navigation completed)
    setIsChangingProject(false);
    setTransitioningToProject(null);
    // Keep popover open to allow multiple selections
  }, [projectId]);

  // Reset interface loading states when interface changes
  useEffect(() => {
    setIsChangingInterface(false);
    setTransitioningToInterface(null);
    // Keep popover open to allow multiple selections
  }, [interfaceId]);

  // Find current interface data
  const currentProjectData = useMemo(() => {
    return projectTree.find((p) => p.projectName === selectedProject);
  }, [projectTree, selectedProject]);

  const currentInterfaces = useMemo(() => {
    return currentProjectData?.interfaces || [];
  }, [currentProjectData]);

  // Find the current interface from the project tree
  const currentInterface = useMemo(() => {
    // Wait for project tree to load
    if (projectTree.length === 0) return null;

    if (!interfaceId || !currentInterfaces.length) return null;

    // Try to find by ID first
    let found = currentInterfaces.find((i) => i.id === interfaceId);

    // If not found by ID, try to find by matching the current interface parameter from URL
    if (!found) {
      const interfaceParam = searchParams.get('interface');
      if (interfaceParam) {
        found = currentInterfaces.find((i) => i.name === interfaceParam);
      }
    }

    return found;
  }, [interfaceId, currentInterfaces, searchParams, projectTree]);

  // Use the interfaceId prop directly - parent component handles URL parsing
  useEffect(() => {
    if (interfaceId) {
      setSelectedInterface(interfaceId);
    } else {
      setSelectedInterface(null);
    }
  }, [interfaceId]);

  // Fetch tabs for the current interface using React Query
  const {
    data: currentTabs = [],
    isLoading: tabsLoading,
    isFetching: tabsFetching,
    isError: tabsError,
    error: tabsErrorDetails,
    refetch: refetchTabs,
  } = useQuery<ProjectTab[]>({
    queryKey: ['tabs', interfaceId],
    queryFn: async () => {
      if (!interfaceId) return [];

      try {
        const tabs = await tabActions.list(interfaceId);

        // Handle various error response formats
        if (!tabs) {
          return [];
        }

        // Check if it's an error object instead of array
        if (typeof tabs === 'object' && !Array.isArray(tabs)) {
          // Handle both {error: "..."} and {detail: "..."} formats
          const errorMessage =
            (tabs as any).error || (tabs as any).detail || 'Invalid response format';
          console.error('Tab fetch error:', errorMessage);
          throw new Error(errorMessage);
        }

        // Ensure it's actually an array
        if (!Array.isArray(tabs)) {
          console.error('Invalid tabs response type:', typeof tabs, tabs);
          throw new Error('Expected array of tabs but received ' + typeof tabs);
        }

        // Safe to sort now
        return tabs.sort((a, b) => (a.order || 0) - (b.order || 0));
      } catch (error) {
        console.error('Failed to fetch tabs:', error);
        // Re-throw to let React Query handle retries
        throw error instanceof Error ? error : new Error('Failed to fetch tabs');
      }
    },
    enabled: !!interfaceId,
    staleTime: 2 * 60 * 1000, // Consider tabs fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Tabs loading should check both isLoading (initial) and isFetching (refetch/retry)
  const loadingTabs = tabsLoading || tabsFetching;

  // Prefetch current tab - must be called unconditionally for React hooks rules
  const tabStreamingQuery = useTabStreamingQuery(
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
  );

  // Extract prefetchTab function to avoid object reference instability
  const prefetchTab = tabStreamingQuery.prefetchTab;

  // Prefetch adjacent tabs for faster navigation using the proper prefetchTab method
  // Delay prefetch to avoid competing with active tab's initial load
  React.useEffect(() => {
    if (!interfaceId || !activeTabName || !selectedProject) return;

    // Wait for active tab to load before prefetching others
    const timeoutId = setTimeout(() => {
      const currentTabIndex = currentTabs.findIndex((t) => t.name === activeTabName);

      // Prefetch previous tab
      if (currentTabIndex > 0) {
        const prevTab = currentTabs[currentTabIndex - 1];
        // Use the prefetchTab method which actually fetches the data
        void prefetchTab(prevTab.name);
      }

      // Prefetch next tab
      if (currentTabIndex < currentTabs.length - 1) {
        const nextTab = currentTabs[currentTabIndex + 1];
        void prefetchTab(nextTab.name);
      }
    }, 2000); // Wait 2 seconds after tab switch before prefetching

    return () => clearTimeout(timeoutId);
  }, [interfaceId, activeTabName, selectedProject, currentTabs, prefetchTab]);

  // Navigation handlers
  const navigateSoft = useCallback(
    (url: string) => {
      setIsSwitchingInterface(true);
      router.push(url);
    },
    [router, setIsSwitchingInterface]
  );

  // Navigate without triggering the loading screen (for tab switches)
  const navigateTab = useCallback(
    (url: string) => {
      router.push(url);
    },
    [router]
  );

  const handleProjectChange = async (newProject: string) => {
    // Check if clicking on already selected project to unselect
    if (selectedProject === newProject) {
      setIsChangingProject(true);
      setTransitioningToProject(newProject);
      setSelectedProject('');
      setSelectedInterface(null);
      setLoadingMessage('Loading projects...');
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('project');
      newParams.delete('interface');
      newParams.delete('tab');
      newParams.set('selectProject', 'true'); // Flag to show project selection instead of redirecting
      try {
        navigateSoft(`/interfaces?${newParams.toString()}`);
      } finally {
        // Loading states will be reset in useEffect when projectId prop changes
      }
      return;
    }

    setIsChangingProject(true);
    setTransitioningToProject(newProject);
    setLoadingMessage('Loading project...');
    try {
      setSelectedProject(newProject);
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('project', newProject);
      newParams.delete('selectProject'); // Clear the project selection screen flag

      // Find interfaces for the new project
      const projectData = projectTree.find((p) => p.projectName === newProject);
      const interfaces = projectData?.interfaces || [];

      if (interfaces.length === 1) {
        // Auto-select the only interface
        newParams.set('interface', interfaces[0].name);
      } else if (interfaces.length > 1) {
        // Clear interface selection to show dropdown
        newParams.delete('interface');
        setSelectedInterface(null);
      }

      newParams.delete('tab'); // Clear tab selection
      navigateSoft(`/interfaces?${newParams.toString()}`);
    } finally {
      // Loading states will be reset in useEffect when projectId prop changes
    }
  };

  const handleInterfaceChange = async (newInterfaceName: string) => {
    const iface = currentInterfaces.find((i) => i.name === newInterfaceName);
    if (!iface) return;

    // Check if clicking on already selected interface to unselect
    if (currentInterface?.name === newInterfaceName) {
      setIsChangingInterface(true);
      setTransitioningToInterface(newInterfaceName);
      setLoadingMessage('Loading interfaces...');
      try {
        setSelectedInterface(null);
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.delete('interface');
        newParams.delete('tab');
        newParams.set('selectInterface', 'true'); // Flag to show interface selection instead of auto-selecting
        navigateSoft(`/interfaces?${newParams.toString()}`);
      } finally {
        // Loading states will be reset in useEffect when interfaceId prop changes
      }
      return;
    }

    setIsChangingInterface(true);
    setTransitioningToInterface(newInterfaceName);
    setLoadingMessage(`Loading ${iface.name}...`);
    try {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('interface', iface.name);
      newParams.delete('selectInterface'); // Clear the interface selection screen flag
      newParams.delete('tab'); // Clear tab selection
      navigateSoft(`/interfaces?${newParams.toString()}`);
    } finally {
      // Loading states will be reset in useEffect when interfaceId prop changes
    }
  };

  const handleTabClick = useCallback(
    (tab: ProjectTab) => {
      // Use the interface sync action to switch tabs instantly
      if (syncedInterfaceUIActions?.setActiveTab) {
        syncedInterfaceUIActions.setActiveTab(tab.name);

        // Also update URL for consistency (without triggering navigation)
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('tab', tab.name);
        window.history.replaceState(null, '', `?${newParams.toString()}`);
      } else {
        // Fallback to URL navigation if sync actions not available
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('tab', tab.name);
        navigateTab(`?${newParams.toString()}`);
      }
    },
    [syncedInterfaceUIActions, searchParams, navigateTab]
  );

  const handleCreateTab = useCallback(
    async (tabName: string, tabIcon?: string) => {
      if (!interfaceId) throw new Error('No active interface');

      try {
        // Create the tab
        const newTab = await tabActions.create(interfaceId, tabName, {});

        // If an icon was provided, update the tab with it
        if (tabIcon && newTab.id) {
          try {
            await tabActions.update({
              id: newTab.id,
              interfaceId: interfaceId,
              name: tabName,
              data: { icon: tabIcon },
            });
          } catch (error) {
            console.error('Failed to set tab icon:', error);
          }
        }

        showSuccessToast(`Tab "${tabName}" created successfully`);

        // Ensure the new tab exists in the local store immediately
        storeAddTab(interfaceId, newTab.name, {
          id: newTab.id,
          name: newTab.name,
          visible: true,
          active: true,
          icon: tabIcon,
        } as any);

        // Optimistically update tabs cache so it appears immediately
        queryClient.setQueryData(['tabs', interfaceId], (oldData: ProjectTab[] | undefined) => {
          const previous = Array.isArray(oldData) ? oldData : [];
          const exists = previous.some((t) =>
            t.id && (newTab as any).id ? t.id === (newTab as any).id : t.name === newTab.name
          );
          const next = exists ? previous : [...previous, { ...newTab, icon: tabIcon }];
          return next.sort((a, b) => (a.order || 0) - (b.order || 0));
        });

        setCreateTabOpen(false);
        const tabNameToNavigate = newTab.name;

        // Switch to the new tab immediately
        if (syncedInterfaceUIActions) {
          syncedInterfaceUIActions.setActiveTab(tabNameToNavigate);
        } else {
          const newParams = new URLSearchParams(searchParams.toString());
          newParams.set('tab', tabNameToNavigate);
          navigateTab(`?${newParams.toString()}`);
        }

        // Background refresh to reconcile with server
        void queryClient.invalidateQueries({ queryKey: ['tabs', interfaceId] });
        void queryClient.invalidateQueries({ queryKey: ['projects', 'tree'] });
      } catch (error) {
        console.error('Failed to create tab:', error);
        throw error instanceof Error ? error : new Error('Failed to create tab');
      }
    },
    [
      interfaceId,
      tabActions,
      storeAddTab,
      queryClient,
      syncedInterfaceUIActions,
      searchParams,
      navigateTab,
    ]
  );

  const handleRenameTab = async () => {
    if (!selectedTab || !newTabName.trim() || !interfaceId) return;

    setIsRenamingTab(true);
    try {
      await tabActions.update({
        id: selectedTab.id,
        interfaceId: interfaceId,
        name: selectedTab.name,
        data: { name: newTabName.trim() },
      });

      showSuccessToast('Tab renamed successfully');

      // Navigate to renamed tab if it's active
      if (activeTabName === selectedTab.name) {
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('tab', newTabName.trim());
        navigateSoft(`?${newParams.toString()}`);
      }

      setRenameTabOpen(false);

      // Invalidate both tabs and project tree cache to refresh the list
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tabs', interfaceId] }),
        queryClient.invalidateQueries({ queryKey: ['projects', 'tree'] }),
      ]);
    } catch (error) {
      console.error('Failed to rename tab:', error);
      showErrorToast('Failed to rename tab');
    } finally {
      setIsRenamingTab(false);
    }
  };

  const handleDeleteTab = async () => {
    if (!selectedTab || !interfaceId) return;

    setIsDeletingTab(true);
    try {
      await tabActions.delete({
        id: selectedTab.id,
        interfaceId: interfaceId,
        name: selectedTab.name,
      });

      showSuccessToast('Tab deleted successfully');

      // Navigate away if this was the active tab
      if (activeTabName === selectedTab.name) {
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.delete('tab');
        navigateSoft(`?${newParams.toString()}`);
      }

      setDeleteTabOpen(false);

      // Invalidate both tabs and project tree cache to refresh the list
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tabs', interfaceId] }),
        queryClient.invalidateQueries({ queryKey: ['projects', 'tree'] }),
      ]);
    } catch (error) {
      console.error('Failed to delete tab:', error);
      showErrorToast('Failed to delete tab');
    } finally {
      setIsDeletingTab(false);
    }
  };

  const handleSaveTabColor = async () => {
    if (!selectedTab || !interfaceId) return;

    setIsSavingTabColor(true);
    try {
      await tabActions.update({
        id: selectedTab.id,
        interfaceId: interfaceId,
        name: selectedTab.name,
        data: { color: newTabColor || undefined },
      });

      showSuccessToast('Tab color updated successfully');
      setTabColorOpen(false);

      // Invalidate both tabs and project tree cache to refresh the list
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tabs', interfaceId] }),
        queryClient.invalidateQueries({ queryKey: ['projects', 'tree'] }),
      ]);
    } catch (error) {
      console.error('Failed to update tab color:', error);
      showErrorToast('Failed to update tab color');
    } finally {
      setIsSavingTabColor(false);
    }
  };

  const handleCreateProject = useCallback(
    async (projectName: string, projectIcon?: string) => {
      const result = await createProject(
        projectName,
        projectActions,
        projectTree.map((p) => p.projectName),
        projectIcon
      );

      if (result.success && result.projectName) {
        // Create default interface
        const existingIfaces: any[] = [];
        const ifaceRes = await createInterface(
          'Default',
          result.projectName,
          queryClient,
          { interfaces: interfaceActions, tabs: tabActions, tiles: tileActions },
          existingIfaces
        );

        // Navigate to new project
        const newParams = new URLSearchParams(window.location.search);
        newParams.set('project', result.projectName);
        if (ifaceRes.success && ifaceRes.interface?.name) {
          newParams.set('interface', ifaceRes.interface.name);
        }
        navigateSoft(`/interfaces?${newParams.toString()}`);

        // Refresh
        await refetchProjectTree();
        setCreateProjectOpen(false);
      } else {
        throw new Error(result.error || 'Failed to create project');
      }
    },
    [
      projectTree,
      projectActions,
      queryClient,
      interfaceActions,
      tabActions,
      tileActions,
      navigateSoft,
      refetchProjectTree,
    ]
  );

  const handleSaveProjectIcon = async () => {
    if (!activeProject) return;

    setIsSavingProjectIcon(true);
    try {
      await projectActions.update(activeProject, { icon: newProjectIconEdit || undefined });

      showSuccessToast('Project icon updated successfully');
      setProjectIconOpen(false);

      // Refresh project tree to show updated icon
      await refetchProjectTree();
    } catch (error) {
      console.error('Failed to update project icon:', error);
      showErrorToast('Failed to update project icon');
    } finally {
      setIsSavingProjectIcon(false);
    }
  };

  const handleSaveInterfaceIcon = async () => {
    if (!selectedInterfaceForAction) return;

    setIsSavingInterfaceIcon(true);
    try {
      await interfaceActions.update({
        interfaceId: selectedInterfaceForAction.id,
        data: { icon: newInterfaceIcon || undefined },
      });

      showSuccessToast('Interface icon updated successfully');
      setInterfaceIconOpen(false);

      // Refresh project tree to show updated icon
      await refetchProjectTree();
    } catch (error) {
      console.error('Failed to update interface icon:', error);
      showErrorToast('Failed to update interface icon');
    } finally {
      setIsSavingInterfaceIcon(false);
    }
  };

  const handleSaveTabIcon = async () => {
    if (!selectedTab || !interfaceId) return;

    setIsSavingTabIcon(true);
    try {
      await tabActions.update({
        id: selectedTab.id,
        interfaceId: interfaceId,
        name: selectedTab.name,
        data: { icon: newTabIcon || undefined },
      });

      showSuccessToast('Tab icon updated successfully');
      setTabIconOpen(false);

      // Invalidate both tabs and project tree cache to refresh the list
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tabs', interfaceId] }),
        queryClient.invalidateQueries({ queryKey: ['projects', 'tree'] }),
      ]);
    } catch (error) {
      console.error('Failed to update tab icon:', error);
      showErrorToast('Failed to update tab icon');
    } finally {
      setIsSavingTabIcon(false);
    }
  };

  const handleToggleFavourite = async () => {
    const currentFavourite = favourites.find((f) => f.projectName === selectedProject) || null;
    const result = await toggleFavourite(
      selectedProject,
      currentFavourite,
      favouritesActions,
      favourites
    );
    if (result.success && result.newFavourites) {
      setFavourites(result.newFavourites);
      await refetchProjectTree();
    }
  };

  const handleExportInterface = async (interfaceId: string) => {
    const iface = currentInterfaces.find((i) => i.id === interfaceId);
    if (!iface) return;

    try {
      await withLoadingToastFn(
        async () => {
          const result = await interfaceActions.exportTemplate({ interfaceId: interfaceId });
          if (result && typeof result === 'object' && 'template' in result) {
            const blob = new Blob([JSON.stringify(result.template, null, 2)], {
              type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${iface.name.toLowerCase().replace(/\s+/g, '-')}-template.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } else {
            throw new Error('Invalid response format');
          }
        },
        {
          loadingMessage: 'Exporting interface template...',
          successMessage: 'Template exported successfully!',
          errorMessage: 'Failed to export template',
        }
      );
    } catch (error) {
      console.error('Failed to export interface:', error);
    }
  };

  const handleRenameProject = useCallback(
    async (newName: string) => {
      if (!activeProject) throw new Error('No active project');

      const result = await renameProject(
        activeProject,
        newName,
        projectActions,
        projectTree.map((p) => p.projectName)
      );

      if (result.success) {
        await refetchProjectTree();

        // Navigate to renamed project
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('project', newName);
        navigateSoft(`?${newParams.toString()}`);

        setRenameProjectOpen(false);
      } else {
        throw new Error(result.error || 'Failed to rename project');
      }
    },
    [activeProject, projectActions, projectTree, searchParams, navigateSoft, refetchProjectTree]
  );

  const handleDeleteProject = async () => {
    if (!activeProject) return;

    setIsDeletingProject(true);
    const result = await deleteProject(activeProject, 'project', {
      project: projectActions.delete,
    });

    if (result.success) {
      await refetchProjectTree();
      navigateSoft('/interfaces');
      setDeleteProjectOpen(false);
    } else {
      showErrorToast('Failed to delete project');
    }
    setIsDeletingProject(false);
  };

  const handleCreateInterface = useCallback(
    async (interfaceName: string, interfaceIcon?: string) => {
      if (!activeProject) throw new Error('No active project');

      const result = await createInterface(
        interfaceName,
        activeProject,
        queryClient,
        { interfaces: interfaceActions, tabs: tabActions, tiles: tileActions },
        []
      );

      if (result.success && result.interface) {
        // If an icon was provided, update the interface with it
        if (interfaceIcon && result.interface.id) {
          try {
            await interfaceActions.update({
              interfaceId: result.interface.id,
              data: { icon: interfaceIcon },
            });
          } catch (error) {
            console.error('Failed to set interface icon:', error);
          }
        }

        await refetchProjectTree();

        // Navigate to new interface
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('project', activeProject);
        newParams.set('interface', result.interface.name);
        navigateSoft(`?${newParams.toString()}`);

        setCreateInterfaceOpen(false);
      } else {
        throw new Error(result.error || 'Failed to create interface');
      }
    },
    [
      activeProject,
      queryClient,
      interfaceActions,
      tabActions,
      tileActions,
      searchParams,
      navigateSoft,
      refetchProjectTree,
    ]
  );

  const handleSaveAsNewInterface = async () => {
    if (!selectedInterfaceForAction || !saveAsNewInterfaceName.trim() || !selectedProject) return;

    setIsSavingAsNewInterface(true);
    try {
      // First export the current interface as a template
      const exportResult = await interfaceActions.exportTemplate({
        interfaceId: selectedInterfaceForAction.id,
      });
      if (!exportResult || !('template' in exportResult)) {
        throw new Error('Failed to export interface');
      }

      // Then import it with the new name
      const importResult = await importInterfaceTemplate(
        exportResult,
        selectedProject,
        saveAsNewInterfaceName.trim(),
        interfaceActions,
        currentInterfaces
      );

      if (importResult.success && importResult.importedInterface) {
        await refetchProjectTree();

        // Navigate to the new interface
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('project', selectedProject);
        newParams.set('interface', importResult.importedInterface.name);
        navigateSoft(`?${newParams.toString()}`);

        setSaveAsNewInterfaceOpen(false);
        setSaveAsNewInterfaceName('');
        showSuccessToast(`Interface "${importResult.importedInterface.name}" created successfully`);
      } else {
        throw new Error(importResult.error || 'Failed to create interface copy');
      }
    } catch (error) {
      console.error('Failed to save as new interface:', error);
      showErrorToast(error instanceof Error ? error.message : 'Failed to save as new interface');
    } finally {
      setIsSavingAsNewInterface(false);
    }
  };

  const handleRenameInterface = async () => {
    if (!selectedInterfaceForAction || !newInterfaceName.trim()) return;

    setIsRenamingInterface(true);
    const result = await renameInterface(
      selectedInterfaceForAction.id,
      selectedInterfaceForAction.name,
      newInterfaceName.trim(),
      interfaceActions,
      currentInterfaces
    );

    if (result.success) {
      await refetchProjectTree();

      // Navigate to renamed interface
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('interface', newInterfaceName.trim());
      navigateSoft(`?${newParams.toString()}`);

      setRenameInterfaceOpen(false);
    } else {
      showErrorToast(result.error || 'Failed to rename interface');
    }
    setIsRenamingInterface(false);
  };

  const handleDeleteInterface = async () => {
    if (!selectedInterfaceForAction) return;

    setIsDeletingInterface(true);
    const result = await deleteInterface(
      selectedInterfaceForAction.id,
      selectedInterfaceForAction.name,
      interfaceActions
    );

    if (result.success) {
      await refetchProjectTree();

      // Navigate to project if this was the active interface
      if (selectedInterface === selectedInterfaceForAction.id) {
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.delete('interface');
        navigateSoft(`?${newParams.toString()}`);
      }

      setDeleteInterfaceOpen(false);
    } else {
      showErrorToast(result.error || 'Failed to delete interface');
    }
    setIsDeletingInterface(false);
  };

  const handleExportTemplate = async () => {
    if (!selectedInterfaceForAction) return;

    const result = await exportInterfaceTemplate(
      selectedInterfaceForAction.id,
      selectedInterfaceForAction.name,
      selectedProject,
      interfaceActions
    );

    if (!result.success) {
      showErrorToast(result.error || 'Failed to export template');
    }
  };

  const handleImportTemplate = async (
    templateData: TemplateExportResponse<InterfaceTemplateSchema>
  ) => {
    if (!importProjectName || !templateData) return;

    setIsImportingInterface(true);
    const result = await importInterfaceTemplate(
      templateData,
      importProjectName,
      templateData.template?.name || 'Imported Interface',
      interfaceActions,
      currentInterfaces
    );

    if (result.success && result.importedInterface) {
      await refetchProjectTree();

      // Navigate to imported interface
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('project', importProjectName);
      newParams.set('interface', result.importedInterface.name);
      navigateSoft(`?${newParams.toString()}`);

      setImportInterfaceOpen(false);
      showSuccessToast(`Interface "${result.importedInterface.name}" imported successfully`);
    } else {
      showErrorToast(result.error || 'Failed to import template');
    }
    setIsImportingInterface(false);
  };

  // Sidebar resize hook
  const toggleSidebar = () => {
    if (!isCollapsed && !isCompletelyHidden) {
      setLastExpandedWidth(sidebarWidth);

      if (lastCollapsedState === 'hidden') {
        setIsCompletelyHidden(true);
        setIsCollapsed(true);
      } else {
        setIsCollapsed(true);
      }
    } else {
      setIsCollapsed(false);
      setIsCompletelyHidden(false);
      setSidebarWidth(lastExpandedWidth);
    }
  };

  const toggleCompletelyHidden = () => {
    setIsCompletelyHidden((prev) => !prev);
    if (!isCompletelyHidden) {
      setIsCollapsed(true);
      setLastCollapsedState('hidden');
      document.cookie = `sidebar:lastCollapsedState=hidden; path=/; max-age=${60 * 60 * 24 * 7}`;
    } else {
      setIsCollapsed(true);
      setLastCollapsedState('collapsed');
      document.cookie = `sidebar:lastCollapsedState=collapsed; path=/; max-age=${60 * 60 * 24 * 7}`;
    }
  };

  const { dragRef, handleMouseDown } = useSidebarResize({
    direction: 'right',
    currentWidth: sidebarWidth,
    onResize: handleResize,
    onToggle: toggleSidebar,
    onCompletelyHide: toggleCompletelyHidden,
    isCollapsed,
    isCompletelyHidden,
    minResizeWidth: '12rem',
    maxResizeWidth: '30rem',
    enableAutoCollapse: true,
    autoCollapseThreshold: 0.6,
    completelyHideThreshold: 0.3,
    expandThreshold: 0.15,
    enableDrag: true,
    setIsDragging: setIsDraggingSidebar,
    widthCookieName: 'sidebar:width',
    widthCookieMaxAge: 60 * 60 * 24 * 7,
  });

  // Theme handling
  const { resolvedTheme } = useTheme();

  const debouncedUpdateTheme = useRef(
    debounce(async (color: string) => {
      try {
        await interfaceActions.update({ interfaceId: interfaceId, data: { color } });
        await queryClient.invalidateQueries({ predicate: (q) => q.queryKey?.[0] === 'interfaces' });
      } catch (err) {
        console.error('Failed to update interface theme', err);
      }
    }, 250)
  ).current;

  const handleThemeChange = (color: string) => {
    setThemeColor(color);
    debouncedUpdateTheme(color);
  };

  const handleThemeReset = async () => {
    setThemeColor('');
    try {
      await interfaceActions.update({ interfaceId: interfaceId, data: { color: null as any } });
      await queryClient.invalidateQueries({ predicate: (q) => q.queryKey?.[0] === 'interfaces' });
    } catch (err) {
      console.error('Failed to reset theme colour', err);
    }
  };

  // Use React Query for interface data - cached, no duplicate fetches
  const { data: interfaceData } = useGetInterfaceByIdQuery(interfaceId, interfaceActions);

  // Update theme color when interface data loads
  useEffect(() => {
    if (
      interfaceData &&
      typeof interfaceData.color === 'string' &&
      interfaceData.color.trim() !== ''
    ) {
      setThemeColor(interfaceData.color.trim());
    } else {
      setThemeColor('');
    }
  }, [interfaceData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    if (themeColor && themeColor.trim() !== '') {
      root.style.setProperty('--primary', themeColor.trim());
      root.style.setProperty('--accent', themeColor.trim());
    } else {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--accent');
    }
  }, [themeColor]);

  useEffect(() => {
    const root = document.documentElement;
    if (isCompletelyHidden) {
      root.style.setProperty('--interface-nav-width', '0px');
    } else if (isCollapsed) {
      root.style.setProperty('--interface-nav-width', '48px');
    } else {
      root.style.setProperty('--interface-nav-width', sidebarWidth);
    }

    onNavCollapseChange?.(isCollapsed && !isCompletelyHidden);
  }, [isCollapsed, isCompletelyHidden, sidebarWidth, onNavCollapseChange]);

  useEffect(() => {
    let state = 'expanded';
    if (isCompletelyHidden) {
      state = 'hidden';
    } else if (isCollapsed) {
      state = 'collapsed';
    }
    document.cookie = `sidebar:state=${state}; path=/; max-age=${60 * 60 * 24 * 7}`;
  }, [isCollapsed, isCompletelyHidden]);

  useEffect(() => {
    if (!isCollapsed && !isCompletelyHidden && sidebarWidth !== '3rem') {
      document.cookie = `sidebar:lastExpandedWidth=${lastExpandedWidth}; path=/; max-age=${60 * 60 * 24 * 7}`;
    }
  }, [lastExpandedWidth, isCollapsed, isCompletelyHidden, sidebarWidth]);

  useEffect(() => {
    if (isCollapsed && !isCompletelyHidden) {
      setLastCollapsedState('collapsed');
      document.cookie = `sidebar:lastCollapsedState=collapsed; path=/; max-age=${60 * 60 * 24 * 7}`;
    }
  }, [isCollapsed, isCompletelyHidden]);

  // Initialize interface name when opening rename dialog
  useEffect(() => {
    if (renameInterfaceOpen && selectedInterfaceForAction) {
      setNewInterfaceName(selectedInterfaceForAction.name);
    }
  }, [renameInterfaceOpen, selectedInterfaceForAction]);

  // Initialize interface name when opening save as new dialog
  useEffect(() => {
    if (saveAsNewInterfaceOpen && selectedInterfaceForAction) {
      setSaveAsNewInterfaceName(`${selectedInterfaceForAction.name} (Copy)`);
    }
  }, [saveAsNewInterfaceOpen, selectedInterfaceForAction]);

  const getDefaultPrimary = () =>
    typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() ||
        'var(--role-green-deep)'
      : 'var(--role-green-deep)';

  const pickerColor = themeColor && themeColor.trim() !== '' ? themeColor : getDefaultPrimary();
  // Only show mode controls when there's a project, interface AND at least one tab
  const hasActiveTabs = currentTabs.length > 0;
  const showModeControls = Boolean(projectId && interfaceId && hasActiveTabs);
  const sidebarStyle = useMemo<CSSProperties>(
    () =>
      themeColor ? ({ '--primary': themeColor, '--accent': themeColor } as CSSProperties) : {},
    [themeColor]
  );

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
  );

  // Handle drag end
  const handleTabDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTabId(null);
    setInitialOffset({ x: 0, y: 0 });

    if (!over || active.id === over.id || !interfaceId) {
      return;
    }

    const oldIndex = currentTabs.findIndex((tab) => (tab.id || tab.name) === active.id);
    const newIndex = currentTabs.findIndex((tab) => (tab.id || tab.name) === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistically update the UI immediately via query cache
    const newTabs = arrayMove(currentTabs, oldIndex, newIndex);
    queryClient.setQueryData(['tabs', interfaceId], newTabs);

    try {
      // Update the order for all affected tabs
      const updates = newTabs.map((tab, index) => ({
        id: tab.id,
        interfaceId: interfaceId,
        name: tab.name,
        data: { order: index },
      }));

      // Update tabs in parallel
      await Promise.all(updates.map((update) => tabActions.update(update)));

      showSuccessToast('Tab order updated');

      // Invalidate queries to ensure consistency
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tabs', interfaceId] }),
        queryClient.invalidateQueries({ queryKey: ['projects', 'tree'] }),
      ]);
    } catch (error) {
      console.error('Failed to update tab order:', error);
      showErrorToast('Failed to update tab order');

      // Revert on error
      await refetchTabs();
    }
  };

  // Stable callbacks for tab actions to avoid re-renders while resizing
  const onSaveTab = useCallback(
    (t: ProjectTab) => {
      handleTabClick(t);
      setSaveInterfaceOpen(true);
    },
    [handleTabClick, setSaveInterfaceOpen]
  );

  const onResetTab = useCallback(
    (t: ProjectTab) => {
      handleTabClick(t);
      const resetInterfaceCommand = storeCommands.find((cmd) => cmd.id === 'reset-interface');
      if (resetInterfaceCommand) {
        resetInterfaceCommand.action?.();
      }
    },
    [handleTabClick, storeCommands]
  );

  const onRenameTab = useCallback(
    (t: ProjectTab) => {
      setSelectedTab(t);
      setNewTabName(t.name);
      setRenameTabOpen(true);
    },
    [setSelectedTab, setNewTabName, setRenameTabOpen]
  );

  const onChangeTabIcon = useCallback(
    (t: ProjectTab) => {
      setSelectedTab(t);
      setNewTabIcon(
        t.icon && t.icon.trim() !== '' && t.icon !== 'null' && t.icon !== 'undefined'
          ? t.icon
          : 'file-text'
      );
      setTabIconOpen(true);
    },
    [setSelectedTab, setNewTabIcon, setTabIconOpen]
  );

  const onChangeTabColor = useCallback(
    (t: ProjectTab) => {
      setSelectedTab(t);
      setNewTabColor(t.color || '');
      setTabColorOpen(true);
    },
    [setSelectedTab, setNewTabColor, setTabColorOpen]
  );

  const onSetTabContext = useCallback(
    (t: ProjectTab) => {
      handleTabClick(t);
      setSelectedTab(t);
      setTabContextOpen(true);
    },
    [handleTabClick]
  );

  const onDeleteTab = useCallback(
    (t: ProjectTab) => {
      setSelectedTab(t);
      setDeleteTabOpen(true);
    },
    [setSelectedTab, setDeleteTabOpen]
  );

  // Store API for cascade helpers (must be declared before callbacks that use it)
  const storeApi = useStoreApiContext();

  // Cascade helpers: set context at interface and project scope without overriding explicit child contexts
  const applyInterfaceContextCascade = useCallback(
    async (ctx: string) => {
      if (!interfaceId || !selectedProject) return;
      setIsSettingContext(true);
      try {
        // Update interface
        const s = storeApi.getState() as any;
        s.setContextOptimistic?.('interface', interfaceId, ctx, {
          interfaceId,
          projectId: selectedProject,
        });
        s.enqueueContextSync?.('interface', interfaceId, ctx, {
          interfaceId,
          projectId: selectedProject,
        });
        // Fetch tabs and update those without explicit context (from store)
        const tabIds: string[] = (s.interfacesById?.[interfaceId]?.tabIds || []) as string[];
        for (const tabId of tabIds) {
          const tabHasExplicit =
            Boolean(s.tabsById?.[tabId]?.globalContext) || Boolean(s.tabContexts?.[tabId]);
          if (!tabHasExplicit) {
            const s2 = storeApi.getState() as any;
            s2.setContextOptimistic?.('tab', tabId, ctx, {
              tabId,
              interfaceId,
              projectId: selectedProject,
            });
            s2.enqueueContextSync?.('tab', tabId, ctx, {
              tabId,
              interfaceId,
              projectId: selectedProject,
            });
          }
          // Fetch tiles for this tab and update those without explicit context (from store)
          const tileIds: string[] = (s.tabsById?.[tabId]?.tileIds || []) as string[];
          for (const tileId of tileIds) {
            const tileHasExplicit =
              Boolean(s.tilesById?.[tileId]?.context) || Boolean(s.tileContexts?.[tileId]);
            if (!tileHasExplicit) {
              const s3 = storeApi.getState() as any;
              s3.setContextOptimistic?.('tile', tileId, ctx, {
                tabId,
                interfaceId,
                projectId: selectedProject,
              });
              s3.enqueueContextSync?.('tile', tileId, ctx, {
                tabId,
                interfaceId,
                projectId: selectedProject,
              });
            }
          }
        }
        // Minimal cache nudges; no full refresh
        queryClient.invalidateQueries({ queryKey: ['tabs', interfaceId] });
      } catch (e: any) {
        console.error('Failed to apply interface context:', e);
        showErrorToast(e?.message || 'Failed to apply interface context');
      } finally {
        setIsSettingContext(false);
        // Leave dialog open; user closes explicitly
      }
    },
    [interfaceId, selectedProject, queryClient, storeApi]
  );

  const applyProjectContextCascade = useCallback(
    async (ctx: string) => {
      if (!selectedProject) return;
      setIsSettingContext(true);
      try {
        {
          const s0 = storeApi.getState() as any;
          s0.setProjectDefaultContext?.(selectedProject, ctx || null);
        }
        // Discover interfaces for the project from the store
        const s = storeApi.getState() as any;
        const ifaceIds: string[] = (s.projectsById?.[selectedProject]?.interfaceIds ||
          []) as string[];
        for (const ifaceId of ifaceIds) {
          // Set interface context if missing
          const ifaceHasExplicit = Boolean(s.interfaceContexts?.[ifaceId]);
          if (!ifaceHasExplicit) {
            const s1 = storeApi.getState() as any;
            s1.setContextOptimistic?.('interface', ifaceId, ctx, {
              interfaceId: ifaceId,
              projectId: selectedProject,
            });
            s1.enqueueContextSync?.('interface', ifaceId, ctx, {
              interfaceId: ifaceId,
              projectId: selectedProject,
            });
          }
          // Tabs in interface (from store)
          const tabIds: string[] = (s.interfacesById?.[ifaceId]?.tabIds || []) as string[];
          for (const tabId of tabIds) {
            const tabHasExplicit =
              Boolean(s.tabContexts?.[tabId]) || Boolean(s.tabsById?.[tabId]?.globalContext);
            if (!tabHasExplicit) {
              const s2 = storeApi.getState() as any;
              s2.setContextOptimistic?.('tab', tabId, ctx, {
                tabId,
                interfaceId: ifaceId,
                projectId: selectedProject,
              });
              s2.enqueueContextSync?.('tab', tabId, ctx, {
                tabId,
                interfaceId: ifaceId,
                projectId: selectedProject,
              });
            }
            // Tiles in tab (from store)
            const tileIds: string[] = (s.tabsById?.[tabId]?.tileIds || []) as string[];
            for (const tileId of tileIds) {
              const tileHasExplicit =
                Boolean(s.tileContexts?.[tileId]) || Boolean(s.tilesById?.[tileId]?.context);
              if (!tileHasExplicit) {
                const s3 = storeApi.getState() as any;
                s3.setContextOptimistic?.('tile', tileId, ctx, {
                  tabId,
                  interfaceId: ifaceId,
                  projectId: selectedProject,
                });
                s3.enqueueContextSync?.('tile', tileId, ctx, {
                  tabId,
                  interfaceId: ifaceId,
                  projectId: selectedProject,
                });
              }
            }
          }
        }
        // No cache invalidation to avoid skeletons; async sync will reconcile later
      } catch (e: any) {
        console.error('Failed to apply project context:', e);
        showErrorToast(e?.message || 'Failed to apply project context');
      } finally {
        setIsSettingContext(false);
        // Leave dialog open; user closes explicitly
      }
    },
    [selectedProject, storeApi]
  );

  const applyTabContextCascade = useCallback(
    async (ctx: string) => {
      // Resolve tab id: prefer provided id, otherwise look up by name within the current interface
      const resolveTabId = () => {
        const s = storeApi.getState() as any;
        const directId = selectedTab?.id as string | undefined;
        if (directId) return directId;
        const ifaceId = interfaceId as string | undefined;
        const name = selectedTab?.name as string | undefined;
        if (!ifaceId || !name) return undefined;
        const ids: string[] = (s.interfacesById?.[ifaceId]?.tabIds || []) as string[];
        for (const id of ids) {
          if ((s.tabsById?.[id]?.name as string | undefined) === name) return id;
        }
        return undefined;
      };
      const targetTabId = resolveTabId();
      if (!targetTabId) return;
      setIsSettingContext(true);
      try {
        // Update the tab's context (optimistic + enqueue)
        {
          const s = storeApi.getState() as any;
          s.setContextOptimistic?.('tab', targetTabId as string, ctx, {
            tabId: targetTabId,
            interfaceId,
            projectId: selectedProject,
          });
          s.enqueueContextSync?.('tab', targetTabId as string, ctx, {
            tabId: targetTabId,
            interfaceId,
            projectId: selectedProject,
          });
        }
        // Update tiles in this tab that have no explicit context (from store)
        const sNow = storeApi.getState() as any;
        const tileIds: string[] = (sNow.tabsById?.[targetTabId]?.tileIds || []) as string[];
        for (const tileId of tileIds) {
          const tileHasExplicit =
            Boolean(sNow.tileContexts?.[tileId]) || Boolean(sNow.tilesById?.[tileId]?.context);
          if (!tileHasExplicit) {
            {
              const s2 = storeApi.getState() as any;
              s2.setContextOptimistic?.('tile', tileId, ctx, {
                tabId: targetTabId,
                interfaceId,
                projectId: selectedProject,
              });
              s2.enqueueContextSync?.('tile', tileId, ctx, {
                tabId: targetTabId,
                interfaceId,
                projectId: selectedProject,
              });
            }
          }
        }
        // Avoid heavy invalidations or refresh to prevent skeletons; zustand optimistic state drives UI
      } catch (e: any) {
        console.error('Failed to apply tab context:', e);
        showErrorToast(e?.message || 'Failed to apply tab context');
      } finally {
        setIsSettingContext(false);
        // Leave dialog open; user closes explicitly
      }
    },
    [selectedTab, interfaceId, selectedProject, storeApi]
  );

  // Context dialogs
  const [projectContextOpen, setProjectContextOpen] = useState(false);
  const [interfaceContextOpen, setInterfaceContextOpen] = useState(false);
  const [tabContextOpen, setTabContextOpen] = useState(false);
  const [isSettingContext, setIsSettingContext] = useState(false);
  const [interfaceContextBase, setInterfaceContextBase] = useState<string>('');
  const [tabContextBase, setTabContextBase] = useState<string>('');

  const allContextNames = useMemo(() => (contexts || []).map((c) => c.name).sort(), [contexts]);
  const filterByPrefix = useCallback((names: string[], prefix?: string) => {
    if (!prefix) return names;
    const p = prefix.endsWith('/') ? prefix : `${prefix}/`;
    return names.filter((n) => n === prefix || n.startsWith(p));
  }, []);

  // Sanitize via central contexts slice: set project contexts then sweep
  const projectDefaultCtx = useStoreContext((s) =>
    selectedProject ? (s.projectDefaultContext?.[selectedProject] ?? null) : null
  );
  const tabExplicitContext = useStoreContext((s) => {
    // Resolve tab id from selectedTab.id or by matching name within current interface
    const directId = selectedTab?.id as string | undefined;
    let id = directId;
    if (!id && selectedTab?.name && interfaceId) {
      const ids: string[] = ((s as any).interfacesById?.[interfaceId]?.tabIds || []) as string[];
      for (const tid of ids) {
        if (((s as any).tabsById?.[tid]?.name as string | undefined) === selectedTab.name) {
          id = tid;
          break;
        }
      }
    }
    if (!id) return null;
    const fromSlice = (s as any).tabContexts?.[id] ?? null;
    const fromTab = ((s as any).tabsById?.[id]?.globalContext ?? null) as string | null;
    return (fromSlice ?? fromTab) as string | null;
  });
  useEffect(() => {
    if (!selectedProject) return;
    const s = storeApi.getState() as any;
    if (Array.isArray(contexts)) {
      s.setProjectContexts?.(
        selectedProject,
        contexts.map((c) => c.name)
      );
      s.clearInvalidContexts?.(selectedProject);
    }
  }, [selectedProject, contexts, storeApi]);

  // Inherited base for Interface dialog: show top-level segment of the interface context (e.g., "AnnaPeskova")
  const interfaceInheritedBase = useMemo(() => {
    if (!interfaceContextBase) return null;
    const parts = interfaceContextBase.split('/').filter(Boolean);
    if (parts.length === 0) return null;
    const top = parts[0];
    return top && top !== interfaceContextBase ? top : null;
  }, [interfaceContextBase]);

  // Load prefixes when dialogs open (from store)
  useEffect(() => {
    if (interfaceId && interfaceContextOpen) {
      const s = storeApi.getState() as any;
      const ctx = (s.interfaceContexts?.[interfaceId] ?? null) as string | null;
      setInterfaceContextBase(ctx || '');
    }
    if (selectedTab && tabContextOpen) {
      const s = storeApi.getState() as any;
      // Resolve tab id by id or name
      let tabId = selectedTab.id as string | undefined;
      if (!tabId && selectedTab.name && interfaceId) {
        const ids: string[] = (s.interfacesById?.[interfaceId]?.tabIds || []) as string[];
        for (const tid of ids) {
          if ((s.tabsById?.[tid]?.name as string | undefined) === selectedTab.name) {
            tabId = tid;
            break;
          }
        }
      }
      if (!tabId) return;
      const ctx = (s.tabContexts?.[tabId] ?? s.tabsById?.[tabId]?.globalContext ?? null) as
        | string
        | null;
      setTabContextBase(ctx || '');
    }
  }, [interfaceId, interfaceContextOpen, selectedTab, tabContextOpen, storeApi]);

  return (
    <TooltipProvider>
      <div className="relative flex h-full">
        {/* Toggle Button for completely hidden state */}
        {isCompletelyHidden && (
          <div className="absolute left-2 top-2 z-[200] duration-300 animate-in fade-in">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    toggleSidebar();
                  }}
                  className="bg-card/95 h-8 w-8 border border-border shadow-pop backdrop-blur-sm"
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Show sidebar</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Sidebar Container */}
        <div
          data-interface-color
          className={cn(
            'bg-card/95 relative z-20 flex h-full shrink-0 flex-col overflow-hidden border-r border-border shadow-pop backdrop-blur-sm',
            isCollapsed ? 'w-12' : '',
            isDraggingSidebar ? '' : 'transition-all duration-300 ease-in-out',
            isCompletelyHidden && 'pointer-events-none !w-0 border-0 opacity-0'
          )}
          style={
            {
              ...sidebarStyle,
              width: isCompletelyHidden ? '0' : isCollapsed ? '3rem' : sidebarWidth,
              '--sidebar-width': isCompletelyHidden ? '0' : isCollapsed ? '3rem' : sidebarWidth,
              transform: isCompletelyHidden ? 'translateX(-100%)' : 'translateX(0)',
            } as CSSProperties
          }
        >
          {/* Resize Handle */}
          {!isCompletelyHidden && (
            <div
              ref={dragRef}
              onMouseDown={handleMouseDown}
              className={cn(
                'absolute bottom-0 right-0 top-0 z-10 w-1 cursor-ew-resize bg-transparent transition-colors hover:bg-primary-tint-40',
                "after:absolute after:bottom-0 after:top-0 after:content-['']",
                isCollapsed
                  ? 'after:left-[-2px] after:right-[-6px]'
                  : 'after:left-[-2px] after:right-[-2px]',
                isDraggingSidebar && 'bg-primary-tint-40'
              )}
            />
          )}

          {/* Header with Breadcrumb Navigation and Toggle */}
          {!isCompletelyHidden && isCollapsed && (
            <div
              className={cn('flex items-center justify-center border-b border-border bg-card p-2')}
            >
              <Button size="icon" variant="ghost" onClick={toggleSidebar} className="h-7 w-7">
                <PanelLeft className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Projects and Interfaces Section */}
          {!isCompletelyHidden && !isCollapsed && (
            <div className="bg-card/80 space-y-3 overflow-x-hidden border-b border-border p-3 duration-300 animate-in fade-in slide-in-from-left-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-label uppercase tracking-[0.16em] text-muted-foreground">
                    Interfaces
                  </p>
                  <p className="text-caption text-muted-foreground">
                    Projects, dashboards and tabs
                  </p>
                </div>
              </div>
              {/* Projects */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-label select-none text-muted-foreground">Project</label>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={toggleSidebar}
                    className="h-7 w-7 flex-shrink-0"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex w-full min-w-0 items-center gap-1">
                  <ProjectPicker
                    projects={projectTree}
                    selectedProject={projectId}
                    selectedProjectIcon={currentProjectData?.icon}
                    isLoading={projectTreeLoading}
                    isFetching={projectTreeFetching}
                    isError={!!projectTreeError}
                    transitioningToProject={transitioningToProject}
                    isChangingProject={isChangingProject}
                    onSelect={handleProjectChange}
                    onRefresh={refetchProjectTree}
                    open={projectPopoverOpen}
                    onOpenChange={setProjectPopoverOpen}
                  />
                  {/* Project Context Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="max-w-[200px]">
                      <DropdownMenuItem
                        onSelect={() => setCreateProjectOpen(true)}
                        className="text-body-sm"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Project
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {permissions.hasWrite && (
                        <>
                          <DropdownMenuItem
                            disabled={!selectedProject}
                            onSelect={() => {
                              setActiveProject(selectedProject);
                              setRenameProjectOpen(true);
                            }}
                            className="text-body-sm"
                          >
                            <Edit3 className="mr-2 h-4 w-4" />
                            Rename Project
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!selectedProject}
                            onSelect={() => {
                              setActiveProject(selectedProject);
                              setNewProjectIconEdit(currentProjectData?.icon || 'folder');
                              setProjectIconOpen(true);
                            }}
                            className="text-body-sm"
                          >
                            <Settings className="mr-2 h-4 w-4" />
                            Change Icon
                          </DropdownMenuItem>
                          {interfaceId && (
                            <ColorPicker
                              value={pickerColor}
                              onChange={handleThemeChange}
                              useDialog={true}
                              showReset={true}
                              onReset={handleThemeReset}
                            >
                              <DropdownMenuItem className="text-body-sm">
                                <Palette className="mr-2 h-4 w-4" />
                                Set Project Color
                              </DropdownMenuItem>
                            </ColorPicker>
                          )}
                          <DropdownMenuItem
                            disabled={!selectedProject}
                            onSelect={() => setProjectContextOpen(true)}
                            className="text-body-sm"
                          >
                            <FolderTree className="mr-2 h-4 w-4" />
                            Set Project Context
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!selectedProject}
                            onSelect={() => {
                              setImportProjectName(selectedProject);
                              setImportInterfaceOpen(true);
                            }}
                            className="text-body-sm"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Import Interface
                          </DropdownMenuItem>
                          {selectedProject !== 'Usage' && (
                            <DropdownMenuItem
                              disabled={!selectedProject}
                              onSelect={() => {
                                setFileUploadOpen(true);
                              }}
                              className="text-body-sm"
                            >
                              <FileInput className="mr-2 h-4 w-4" />
                              Upload Logs
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                      <DropdownMenuItem
                        disabled={!selectedProject}
                        onSelect={() => handleToggleFavourite()}
                        className="text-body-sm"
                      >
                        <Star
                          className={cn(
                            'mr-2 h-4 w-4',
                            currentProjectData?.favorite && 'fill-current'
                          )}
                        />
                        {currentProjectData?.favorite
                          ? 'Remove from Favorites'
                          : 'Add to Favorites'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={async () => {
                          setProjectsRefreshing(true);
                          await refetchProjectTree();
                          setProjectsRefreshing(false);
                        }}
                        className="text-body-sm"
                      >
                        <RefreshCw
                          className={cn('mr-2 h-4 w-4', projectsRefreshing && 'animate-spin')}
                        />
                        {projectsRefreshing ? 'Refreshing...' : 'Refresh All'}
                      </DropdownMenuItem>
                      {selectedProject !== 'Usage' && (
                        <>
                          {(permissions.hasWrite || permissions.isOwner) &&
                            permissions.isOrgProject && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled={!selectedProject}
                                  onSelect={() => {
                                    setActiveProject(selectedProject);
                                    setShareProjectOpen(true);
                                  }}
                                  className="text-body-sm"
                                >
                                  <Share2 className="mr-2 h-4 w-4" />
                                  Share Project
                                </DropdownMenuItem>
                              </>
                            )}
                          {permissions.isOwner && (
                            <DropdownMenuItem
                              disabled={!selectedProject}
                              onSelect={() => {
                                setActiveProject(selectedProject);
                                setTransferProjectOpen(true);
                              }}
                              className="text-body-sm"
                            >
                              <ArrowRightLeft className="mr-2 h-4 w-4" />
                              Transfer Project
                            </DropdownMenuItem>
                          )}
                          {permissions.hasDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={!selectedProject}
                                onSelect={() => {
                                  setActiveProject(selectedProject);
                                  setDeleteProjectOpen(true);
                                }}
                                className="text-body-sm text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Project
                              </DropdownMenuItem>
                            </>
                          )}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Interfaces */}
              {currentInterfaces.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-label select-none text-muted-foreground">Interface</label>
                  <div className="flex w-full min-w-0 items-center gap-1">
                    <InterfacePicker
                      interfaces={currentInterfaces}
                      selectedInterface={currentInterface ?? null}
                      isLoading={projectTreeLoading}
                      isFetching={projectTreeFetching}
                      transitioningToInterface={transitioningToInterface}
                      isChangingInterface={isChangingInterface}
                      onSelect={handleInterfaceChange}
                      open={interfacePopoverOpen}
                      onOpenChange={setInterfacePopoverOpen}
                    />
                    {/* Interface Context Menu */}
                    {permissions.hasWrite && (
                      <>
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
                                  setSaveInterfaceOpen(true);
                                }
                              }}
                              className="text-body-sm"
                            >
                              <Save className="mr-2 h-4 w-4" />
                              Save Interface
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!currentInterface}
                              onSelect={() => {
                                if (currentInterface) {
                                  setSelectedInterfaceForAction(currentInterface);
                                  setSaveAsNewInterfaceOpen(true);
                                }
                              }}
                              className="text-body-sm"
                            >
                              <div className="relative mr-2 h-4 w-4">
                                <Save className="h-4 w-4" />
                                <Plus className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-background text-foreground" />
                              </div>
                              Save as New Int...
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!selectedProject}
                              onSelect={() => {
                                setActiveProject(selectedProject);
                                setCreateInterfaceOpen(true);
                              }}
                              className="text-body-sm"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Create Interface
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={!currentInterface}
                              onSelect={() => {
                                if (currentInterface) {
                                  setSelectedInterfaceForAction(currentInterface);
                                  setRenameInterfaceOpen(true);
                                }
                              }}
                              className="text-body-sm"
                            >
                              <Edit3 className="mr-2 h-4 w-4" />
                              Rename Interface
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!currentInterface}
                              onSelect={() => {
                                if (currentInterface) {
                                  setSelectedInterfaceForAction(currentInterface);
                                  setNewInterfaceIcon(currentInterface.icon || 'layout-grid');
                                  setInterfaceIconOpen(true);
                                }
                              }}
                              className="text-body-sm"
                            >
                              <Settings className="mr-2 h-4 w-4" />
                              Change Icon
                            </DropdownMenuItem>
                            {interfaceId && (
                              <ColorPicker
                                value={pickerColor}
                                onChange={handleThemeChange}
                                useDialog={true}
                                showReset={true}
                                onReset={handleThemeReset}
                              >
                                <DropdownMenuItem className="text-body-sm">
                                  <Palette className="mr-2 h-4 w-4" />
                                  Set Interface Color
                                </DropdownMenuItem>
                              </ColorPicker>
                            )}
                            <DropdownMenuItem
                              disabled={!currentInterface}
                              onSelect={() => {
                                if (currentInterface) {
                                  setSelectedInterfaceForAction(currentInterface);
                                  handleExportTemplate();
                                }
                              }}
                              className="text-body-sm"
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Export as Template
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!currentInterface}
                              onSelect={() => setInterfaceContextOpen(true)}
                              className="text-body-sm"
                            >
                              <FolderTree className="mr-2 h-4 w-4" />
                              Set Interface Context
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={!currentInterface}
                              onSelect={() => {
                                if (currentInterface) {
                                  setSelectedInterfaceForAction(currentInterface);
                                  setDeleteInterfaceOpen(true);
                                }
                              }}
                              className="text-body-sm text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Interface
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Show separator and tabs only when both project and interface are selected */}
          {!isCompletelyHidden && !isCollapsed && projectId && interfaceId && (
            <Separator className="bg-border delay-150 duration-300 animate-in fade-in" />
          )}

          {/* Tabs List - Only show when both project and interface are selected */}
          {!isCompletelyHidden && projectId && interfaceId && (
            <div className="bg-background/35 flex flex-1 flex-col overflow-hidden delay-200 duration-500 animate-in fade-in slide-in-from-bottom-2">
              {/* Tabs label and Add button - pinned at top for expanded mode */}
              {!isCollapsed && (
                <div className="flex-shrink-0 px-3 pb-2 pt-3">
                  <div className="flex items-center justify-between duration-200 animate-in fade-in slide-in-from-top-1">
                    <label className="text-label flex flex-shrink-0 select-none items-center uppercase leading-none tracking-[0.14em] text-muted-foreground">
                      Tabs
                    </label>
                    {interfaceId && permissions.hasWrite && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCreateTabOpen(true)}
                            className="h-6 w-6 flex-shrink-0"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add new tab</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              )}
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full w-full">
                  <div
                    className={cn(
                      'relative min-w-0 space-y-1',
                      isCollapsed ? 'px-1 py-1 pb-4' : 'px-3 pb-3 pt-0.5'
                    )}
                  >
                    {tabsError ? (
                      // Error state
                      <div
                        className={cn(
                          'bg-card/80 rounded-lg border border-border text-center text-destructive duration-300 animate-in fade-in',
                          isCollapsed ? 'px-2 py-4' : 'px-3 py-6'
                        )}
                      >
                        <div className="mb-2">
                          <svg
                            className="text-destructive/50 mx-auto h-8 w-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                        <span className="mb-2 block select-none break-words">
                          {tabsErrorDetails instanceof Error
                            ? tabsErrorDetails.message
                            : 'Failed to load tabs'}
                        </span>
                        {!isCollapsed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => refetchTabs()}
                            className="mt-2"
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Retry
                          </Button>
                        )}
                      </div>
                    ) : loadingTabs ? (
                      <div className="space-y-1 duration-200 animate-in fade-in">
                        {/* Show skeleton loaders that match tab items */}
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={cn(
                              'bg-card/60 flex items-center gap-2 rounded-lg border border-border py-2 duration-200 animate-in fade-in',
                              isCollapsed ? 'justify-center px-0' : 'px-3'
                            )}
                            style={{ animationDelay: `${i * 50}ms` }}
                          >
                            {isCollapsed ? (
                              <div className="h-8 w-8 animate-pulse rounded bg-muted" />
                            ) : (
                              <>
                                <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                                <div
                                  className="h-4 flex-1 animate-pulse rounded bg-muted"
                                  style={{ width: `${60 + i * 20}%` }}
                                />
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : currentTabs.length === 0 ? (
                      <div
                        className={cn(
                          'bg-card/70 rounded-lg border border-dashed border-border text-center text-muted-foreground duration-300 animate-in fade-in',
                          isCollapsed ? 'py-4' : 'px-2 py-6'
                        )}
                      >
                        <div className="mb-2">
                          <svg
                            className="text-muted-foreground/50 mx-auto h-8 w-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <span className="block select-none break-words">No tabs yet</span>
                      </div>
                    ) : (
                      <>
                        {/* Tab drag and drop functionality */}
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleTabDragEnd}
                          onDragStart={(event) => {
                            setActiveTabId(event.active.id as string);

                            // Calculate offset to maintain cursor position on dragged element
                            if (event.active.rect.current?.initial && event.activatorEvent) {
                              const rect = event.active.rect.current.initial;
                              const mouseEvent = event.activatorEvent as MouseEvent;

                              if ('clientX' in mouseEvent && 'clientY' in mouseEvent) {
                                // Calculate offset from element center to click position
                                const offsetX = mouseEvent.clientX - rect.left - rect.width / 2;
                                const offsetY = mouseEvent.clientY - rect.top - rect.height / 2;

                                setInitialOffset({ x: offsetX, y: offsetY });
                              }
                            }
                          }}
                          onDragCancel={() => {
                            setActiveTabId(null);
                            setInitialOffset({ x: 0, y: 0 });
                          }}
                        >
                          <SortableContext
                            items={currentTabs.map((tab) => tab.id || tab.name)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="w-full space-y-1">
                              {currentTabs.map((tab) => (
                                <SortableTab
                                  key={tab.id || tab.name}
                                  tab={tab}
                                  isActive={activeTabName === tab.name}
                                  isCollapsed={isCollapsed}
                                  isTabLoading={
                                    queryClient.getQueryState([
                                      'tabCompleteData',
                                      interfaceId,
                                      tab.name,
                                      selectedProject,
                                    ])?.fetchStatus === 'fetching'
                                  }
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
                              }),
                            ]}
                          >
                            {activeTabId &&
                              (() => {
                                const activeTab = currentTabs.find(
                                  (tab) => (tab.id || tab.name) === activeTabId
                                );
                                if (!activeTab) return null;

                                return (
                                  <div className="pointer-events-none cursor-grabbing rounded-lg border border-border bg-card shadow-pop">
                                    <div
                                      className={cn(
                                        'flex items-center gap-2 py-2',
                                        isCollapsed ? 'justify-center px-2' : 'px-3'
                                      )}
                                    >
                                      {renderSidebarIcon(activeTab.icon, 'h-3 w-3', 'tab')}
                                      {!isCollapsed && (
                                        <span className="text-body text-strong select-none">
                                          {activeTab.name}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                          </DragOverlay>
                        </DndContext>
                      </>
                    )}
                  </div>
                </ScrollArea>
                {/* Fade gradients for smooth scroll effect */}
                <div
                  className={cn(
                    'via-background/80 pointer-events-none absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-background to-transparent',
                    isCollapsed ? 'mx-1 h-8' : 'mx-2 h-2'
                  )}
                />
                <div
                  className={cn(
                    'via-background/60 pointer-events-none absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-background to-transparent',
                    isCollapsed ? 'mx-1 h-3' : 'mx-2 h-2'
                  )}
                />
              </div>
            </div>
          )}

          {/* Add tab button for collapsed mode - placed at bottom */}
          {!isCompletelyHidden && isCollapsed && projectId && interfaceId && (
            <div className="p-1 duration-300 animate-in fade-in slide-in-from-bottom-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCreateTabOpen(true)}
                    className="h-7 w-7 w-full"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Add Tab</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Separator before mode controls */}
          {!isCompletelyHidden && !isCollapsed && showModeControls && (
            <Separator className="bg-border duration-200 animate-in fade-in" />
          )}

          {/* Mode Controls */}
          {!isCollapsed && !isCompletelyHidden && showModeControls && (
            <div className="bg-card/90 flex-shrink-0 space-y-2 overflow-x-hidden px-3 py-3 duration-300 animate-in fade-in slide-in-from-bottom-2">
              {permissions.hasWrite && (
                <div className="bg-background/60 flex items-center justify-between gap-1.5 rounded-lg border border-border px-2 py-1.5">
                  <label className="text-body-sm flex min-w-0 select-none items-center gap-1">
                    <Hammer
                      className={cn('h-3.5 w-3.5 flex-shrink-0', isEditMode && 'text-primary')}
                    />
                    <span className="truncate">Edit Mode</span>
                  </label>
                  <Switch
                    checked={isEditMode}
                    onCheckedChange={onEditModeToggle}
                    className="flex-shrink-0 scale-75 hover:!bg-transparent data-[state=checked]:!bg-primary data-[state=unchecked]:!bg-input"
                  />
                </div>
              )}

              <div className="bg-background/60 flex items-center justify-between gap-1.5 rounded-lg border border-border px-2 py-1.5">
                <label className="text-body-sm flex min-w-0 select-none items-center gap-1">
                  <SquareMousePointer
                    className={cn('h-3.5 w-3.5 flex-shrink-0', isCommandMode && 'text-primary')}
                  />
                  <span className="truncate">Dashboard Mode</span>
                </label>
                <Switch
                  checked={isCommandMode}
                  onCheckedChange={onCommandModeToggle}
                  className="flex-shrink-0 scale-75 hover:!bg-transparent data-[state=checked]:!bg-primary data-[state=unchecked]:!bg-input"
                />
              </div>
            </div>
          )}

          {/* Separator before collapsed mode controls */}
          {isCollapsed && !isCompletelyHidden && showModeControls && (
            <div className="mt-auto duration-200 animate-in fade-in">
              <Separator />
            </div>
          )}

          {/* Collapsed Mode Controls */}
          {isCollapsed && !isCompletelyHidden && showModeControls && (
            <div className="flex flex-col items-center space-y-1 p-1 duration-300 animate-in fade-in">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onEditModeToggle}
                    className={cn('h-7 w-7', isEditMode && 'text-primary')}
                  >
                    <Hammer className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {isEditMode ? 'Disable Edit Mode' : 'Enable Edit Mode'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onCommandModeToggle}
                    className={cn('h-7 w-7', isCommandMode && 'text-primary')}
                  >
                    <SquareMousePointer className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {isCommandMode ? 'Disable Dashboard Mode' : 'Enable Dashboard Mode'}
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

        {typeof window !== 'undefined' &&
          renameTabOpen &&
          selectedTab &&
          createPortal(
            <BaseDialog
              button={null as any}
              open={renameTabOpen}
              setOpen={setRenameTabOpen}
              title="Rename Tab"
              body={
                <div className="space-y-2 pt-4">
                  <Label htmlFor="tab-rename" className="text-body-sm">
                    New Tab Name
                  </Label>
                  <Input
                    id="tab-rename"
                    value={newTabName}
                    onChange={(e) => setNewTabName(e.target.value)}
                    onKeyDown={(e) => !isImeComposing(e) && e.key === 'Enter' && handleRenameTab()}
                    autoFocus
                  />
                </div>
              }
              footer={
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setRenameTabOpen(false)} className="h-8">
                    Cancel
                  </Button>
                  <SubmitButton
                    text="Rename"
                    onClick={handleRenameTab}
                    loading={isRenamingTab}
                    className="h-8"
                  />
                </div>
              }
            />,
            document.body
          )}

        {typeof window !== 'undefined' &&
          deleteTabOpen &&
          selectedTab &&
          createPortal(
            <BaseDialog
              button={null as any}
              open={deleteTabOpen}
              setOpen={setDeleteTabOpen}
              title="Delete Tab"
              body={
                <p className="pt-4">
                  Are you sure you want to delete the tab &quot;{selectedTab.name}&quot;? This
                  action cannot be undone.
                </p>
              }
              footer={
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDeleteTabOpen(false)} className="h-8">
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteTab}
                    disabled={isDeletingTab}
                    className="h-8"
                  >
                    {isDeletingTab && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete
                  </Button>
                </div>
              }
            />,
            document.body
          )}

        {typeof window !== 'undefined' &&
          tabColorOpen &&
          selectedTab &&
          createPortal(
            <BaseDialog
              button={null as any}
              open={tabColorOpen}
              setOpen={setTabColorOpen}
              title={`Tab Color for "${selectedTab.name}"`}
              body={
                <div className="space-y-4 pt-4">
                  <div className="flex justify-center">
                    <HexColorPicker
                      color={newTabColor || 'var(--role-green-deep)'}
                      onChange={setNewTabColor}
                    />
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
                  <Button variant="outline" onClick={() => setTabColorOpen(false)} className="h-8">
                    Cancel
                  </Button>
                  <Button onClick={handleSaveTabColor} disabled={isSavingTabColor} className="h-8">
                    {isSavingTabColor && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                </div>
              }
            />,
            document.body
          )}

        {/* Icon Edit Dialogs */}
        {typeof window !== 'undefined' &&
          projectIconOpen &&
          activeProject &&
          createPortal(
            <BaseDialog
              button={null as any}
              open={projectIconOpen}
              setOpen={setProjectIconOpen}
              title={`Change Icon for "${activeProject}"`}
              body={
                <div className="space-y-4 pt-4">
                  <IconSelector
                    value={newProjectIconEdit as any}
                    onValueChange={setNewProjectIconEdit}
                  />
                </div>
              }
              footer={
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setProjectIconOpen(false)}
                    className="h-8"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveProjectIcon}
                    disabled={isSavingProjectIcon}
                    className="h-8"
                  >
                    {isSavingProjectIcon && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                </div>
              }
            />,
            document.body
          )}

        {typeof window !== 'undefined' &&
          interfaceIconOpen &&
          selectedInterfaceForAction &&
          createPortal(
            <BaseDialog
              button={null as any}
              open={interfaceIconOpen}
              setOpen={setInterfaceIconOpen}
              title={`Change Icon for "${selectedInterfaceForAction.name}"`}
              body={
                <div className="space-y-4 pt-4">
                  <IconSelector
                    value={newInterfaceIcon as any}
                    onValueChange={setNewInterfaceIcon}
                  />
                </div>
              }
              footer={
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setInterfaceIconOpen(false)}
                    className="h-8"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveInterfaceIcon}
                    disabled={isSavingInterfaceIcon}
                    className="h-8"
                  >
                    {isSavingInterfaceIcon && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                </div>
              }
            />,
            document.body
          )}

        {typeof window !== 'undefined' &&
          tabIconOpen &&
          selectedTab &&
          createPortal(
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
                  <Button variant="outline" onClick={() => setTabIconOpen(false)} className="h-8">
                    Cancel
                  </Button>
                  <Button onClick={handleSaveTabIcon} disabled={isSavingTabIcon} className="h-8">
                    {isSavingTabIcon && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                </div>
              }
            />,
            document.body
          )}

        {/* Project Dialogs */}
        <RenameProjectDialog
          open={renameProjectOpen}
          onOpenChange={setRenameProjectOpen}
          onSubmit={handleRenameProject}
          currentName={activeProject || ''}
        />

        {typeof window !== 'undefined' &&
          deleteProjectOpen &&
          activeProject &&
          createPortal(
            <BaseDialog
              button={null as any}
              open={deleteProjectOpen}
              setOpen={setDeleteProjectOpen}
              title={`Delete Project "${activeProject}"`}
              body={
                <p className="pt-4">
                  Are you sure you want to delete the project &quot;{activeProject}&quot;? This
                  action cannot be undone.
                </p>
              }
              footer={
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteProjectOpen(false)}
                    className="h-8"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteProject}
                    disabled={isDeletingProject}
                    className="h-8"
                  >
                    {isDeletingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete
                  </Button>
                </div>
              }
            />,
            document.body
          )}

        {/* Share Project Dialog */}
        {selectedProject && permissions.projectId && (
          <ShareProjectDialog
            open={shareProjectOpen}
            onOpenChange={setShareProjectOpen}
            projectId={permissions.projectId}
            projectName={selectedProject}
            resourcesActions={resourcesActions}
            accessEntries={permissions.accessEntries}
            availableRoles={permissions.availableRoles}
            availableTeams={permissions.availableTeams}
            availableMembers={permissions.availableMembers}
            onAccessUpdated={() => {
              permissions.refetch();
            }}
          />
        )}

        {/* Transfer Project Dialog */}
        {selectedProject && permissions.projectId && (
          <TransferProjectDialog
            open={transferProjectOpen}
            onOpenChange={setTransferProjectOpen}
            projectId={permissions.projectId}
            projectName={selectedProject}
            projectActions={projectActions}
            isOrgProject={permissions.isOrgProject}
            currentOrganizationId={permissions.organizationId}
            availableOrganizations={userMeta.organizations || []}
            onTransferComplete={() => {
              permissions.refetch();
              refetchProjectTree();
            }}
          />
        )}

        {/* Interface Dialogs */}
        <CreateInterfaceDialog
          open={createInterfaceOpen}
          onOpenChange={setCreateInterfaceOpen}
          onSubmit={handleCreateInterface}
          projectName={activeProject || ''}
        />

        {typeof window !== 'undefined' &&
          renameInterfaceOpen &&
          selectedInterfaceForAction &&
          createPortal(
            <BaseDialog
              button={null as any}
              open={renameInterfaceOpen}
              setOpen={setRenameInterfaceOpen}
              title="Rename Interface"
              body={
                <div className="space-y-2 pt-4">
                  <Label htmlFor="interface-rename" className="text-body-sm">
                    New Interface Name
                  </Label>
                  <Input
                    id="interface-rename"
                    value={newInterfaceName}
                    onChange={(e) => setNewInterfaceName(e.target.value)}
                    onKeyDown={(e) =>
                      !isImeComposing(e) && e.key === 'Enter' && handleRenameInterface()
                    }
                    autoFocus
                  />
                </div>
              }
              footer={
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setRenameInterfaceOpen(false)}
                    className="h-8"
                  >
                    Cancel
                  </Button>
                  <SubmitButton
                    text="Rename"
                    onClick={handleRenameInterface}
                    loading={isRenamingInterface}
                    className="h-8"
                  />
                </div>
              }
            />,
            document.body
          )}

        {typeof window !== 'undefined' &&
          deleteInterfaceOpen &&
          selectedInterfaceForAction &&
          createPortal(
            <BaseDialog
              button={null as any}
              open={deleteInterfaceOpen}
              setOpen={setDeleteInterfaceOpen}
              title="Delete Interface"
              body={
                <p className="pt-4">
                  Are you sure you want to delete the interface &quot;
                  {selectedInterfaceForAction.name}&quot;? This action cannot be undone.
                </p>
              }
              footer={
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteInterfaceOpen(false)}
                    className="h-8"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteInterface}
                    disabled={isDeletingInterface}
                    className="h-8"
                  >
                    {isDeletingInterface && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete
                  </Button>
                </div>
              }
            />,
            document.body
          )}

        {typeof window !== 'undefined' &&
          saveAsNewInterfaceOpen &&
          selectedInterfaceForAction &&
          createPortal(
            <BaseDialog
              button={null as any}
              open={saveAsNewInterfaceOpen}
              setOpen={setSaveAsNewInterfaceOpen}
              title="Save as New Interface"
              body={
                <div className="space-y-2 pt-4">
                  <Label htmlFor="new-interface-name" className="text-body-sm">
                    New Interface Name
                  </Label>
                  <Input
                    id="new-interface-name"
                    value={saveAsNewInterfaceName}
                    onChange={(e) => setSaveAsNewInterfaceName(e.target.value)}
                    onKeyDown={(e) =>
                      !isImeComposing(e) && e.key === 'Enter' && handleSaveAsNewInterface()
                    }
                    autoFocus
                  />
                  <p className="text-body text-muted-foreground">
                    This will create a copy of &quot;{selectedInterfaceForAction.name}&quot; with
                    all its tabs and tiles.
                  </p>
                </div>
              }
              footer={
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSaveAsNewInterfaceOpen(false)}
                    className="h-8"
                  >
                    Cancel
                  </Button>
                  <SubmitButton
                    text="Create Copy"
                    onClick={handleSaveAsNewInterface}
                    loading={isSavingAsNewInterface}
                    className="h-8"
                  />
                </div>
              }
            />,
            document.body
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
        {typeof window !== 'undefined' &&
          importInterfaceOpen &&
          createPortal(
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
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const text = await file.text();
                          const templateData = JSON.parse(
                            text
                          ) as TemplateExportResponse<InterfaceTemplateSchema>;
                          await handleImportTemplate(templateData);
                        } catch (error) {
                          showErrorToast('Invalid template file');
                        }
                      }
                    }}
                    className="text-body file:text-label block w-full text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:font-semibold file:text-primary-foreground hover:file:opacity-90"
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
            />,
            document.body
          )}

        {/* Floating Add Tile button when Edit Mode is ON and there's an active tab */}
        {isEditMode && projectId && interfaceId && hasActiveTabs && (
          <div className="pointer-events-none absolute bottom-4 left-full z-40 ml-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-card/90 pointer-events-auto rounded-lg border border-border p-1 shadow-md backdrop-blur-sm">
              <ActionButton
                className="text-caption h-7 px-1.5"
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

        {/* Set Project Context Dialog */}
        {typeof window !== 'undefined' &&
          projectContextOpen &&
          createPortal(
            <BaseDialog
              button={null as any}
              open={projectContextOpen}
              setOpen={setProjectContextOpen}
              title={`Set Context for "${selectedProject}"`}
              body={
                <ContextTreePicker
                  contexts={allContextNames}
                  current={projectDefaultCtx || null}
                  basePrefix={projectDefaultCtx || undefined}
                  inherited={null}
                  onPick={(ctx) => applyProjectContextCascade(ctx)}
                  projectId={selectedProject || undefined}
                  contextActions={contextActions}
                  hideClear
                />
              }
              footer={
                <div className="flex w-full items-center justify-between">
                  <Button variant="outline" onClick={() => applyProjectContextCascade('')}>
                    Clear selection
                  </Button>
                  <Button
                    variant="outline"
                    className="ml-auto"
                    onClick={() => setProjectContextOpen(false)}
                    disabled={isSettingContext}
                  >
                    Cancel
                  </Button>
                </div>
              }
            />,
            document.body
          )}

        {/* Set Interface Context Dialog */}
        {typeof window !== 'undefined' &&
          interfaceContextOpen &&
          createPortal(
            <BaseDialog
              button={null as any}
              open={interfaceContextOpen}
              setOpen={setInterfaceContextOpen}
              title={`Set Context for Interface`}
              body={
                <ContextTreePicker
                  contexts={filterByPrefix(allContextNames, interfaceContextBase || undefined)}
                  current={interfaceContextBase}
                  basePrefix={interfaceContextBase || undefined}
                  inherited={interfaceInheritedBase}
                  onPick={(ctx) => applyInterfaceContextCascade(ctx)}
                  projectId={selectedProject || undefined}
                  contextActions={contextActions}
                  hideClear
                />
              }
              footer={
                <div className="flex w-full items-center justify-between">
                  <Button variant="outline" onClick={() => applyInterfaceContextCascade('')}>
                    Clear selection
                  </Button>
                  <Button
                    variant="outline"
                    className="ml-auto"
                    onClick={() => setInterfaceContextOpen(false)}
                    disabled={isSettingContext}
                  >
                    Cancel
                  </Button>
                </div>
              }
            />,
            document.body
          )}

        {/* Set Tab Context Dialog */}
        {typeof window !== 'undefined' &&
          tabContextOpen &&
          selectedTab != null &&
          createPortal(
            <BaseDialog
              button={null as any}
              open={tabContextOpen}
              setOpen={setTabContextOpen}
              title={'Set Tab Context'}
              body={
                <ContextTreePicker
                  contexts={filterByPrefix(allContextNames, interfaceContextBase || undefined)}
                  current={tabExplicitContext}
                  basePrefix={interfaceContextBase || undefined}
                  inherited={!tabExplicitContext ? interfaceContextBase || null : null}
                  onPick={(ctx) => {
                    applyTabContextCascade(ctx);
                  }}
                  projectId={selectedProject || undefined}
                  contextActions={contextActions}
                  hideClear
                />
              }
              footer={
                <div className="flex w-full items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => {
                      applyTabContextCascade('');
                    }}
                  >
                    Clear selection
                  </Button>
                  <Button
                    variant="outline"
                    className="ml-auto"
                    onClick={() => setTabContextOpen(false)}
                    disabled={isSettingContext}
                  >
                    Cancel
                  </Button>
                </div>
              }
            />,
            document.body
          )}
      </div>
    </TooltipProvider>
  );
}
