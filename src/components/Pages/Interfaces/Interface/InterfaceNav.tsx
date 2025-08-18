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
  Layers,
  Upload,
  FileInput,
  FileOutput
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
    project: 'folder',
    interface: 'layout-grid',
    tab: 'file-text'
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
    return <span className={className}>{icon}</span>;
  }
  
  // Simple mapping: if icon is "tab", use the default
  if (icon.toLowerCase() === 'tab') {
    icon = defaultIcon;
  }
  
  // Just render the icon directly
  return <Icon name={icon as any} className={className} />;
}

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
  
  // Dialog states
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectIcon, setNewProjectIcon] = useState<string | undefined>(undefined)
  const [createProjectError, setCreateProjectError] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  
  // Project action states
  const [activeProject, setActiveProject] = useState<string | null>(null)
  const [renameProjectOpen, setRenameProjectOpen] = useState(false)
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false)
  const [renameProjectName, setRenameProjectName] = useState('')
  const [isRenamingProject, setIsRenamingProject] = useState(false)
  const [isDeletingProject, setIsDeletingProject] = useState(false)
  
  // Interface action states
  const [createInterfaceOpen, setCreateInterfaceOpen] = useState(false)
  const [newInterfaceName, setNewInterfaceName] = useState('')
  const [isCreatingInterface, setIsCreatingInterface] = useState(false)
  const [selectedInterfaceForAction, setSelectedInterfaceForAction] = useState<ProjectInterface | null>(null)
  const [renameInterfaceOpen, setRenameInterfaceOpen] = useState(false)
  const [deleteInterfaceOpen, setDeleteInterfaceOpen] = useState(false)
  const [isRenamingInterface, setIsRenamingInterface] = useState(false)
  const [isDeletingInterface, setIsDeletingInterface] = useState(false)
  
  // Tab dialog states
  const [createTabOpen, setCreateTabOpen] = useState(false)
  const [newTabName, setNewTabName] = useState('')
  const [isCreatingTab, setIsCreatingTab] = useState(false)
  const [renameTabOpen, setRenameTabOpen] = useState(false)
  const [deleteTabOpen, setDeleteTabOpen] = useState(false)
  const [selectedTab, setSelectedTab] = useState<ProjectTab | null>(null)
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
  
  // Fetch project tree using React Query for better caching
  const { data: projectTree = [], isLoading: projectTreeLoading, refetch: refetchProjectTree } = useQuery<
    Array<{project:string; icon:string; interfaces:ProjectInterface[]; favorite:boolean; position:number|null}>
  >({
    queryKey: ['projects', 'tree'],
    queryFn: async () => {
      const res = await fetch('/api/projects/tree')
      if (!res.ok) throw new Error('Failed to fetch project tree')
      return res.json()
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  })
  
  // Fetch contexts for file upload
  const { data: contexts = [] } = useListContextsQuery(selectedProject, contextActions)
  
  // Update selected project and interface based on props
  useEffect(() => {
    setSelectedProject(projectId)
  }, [projectId])
  
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
  const { data: currentTabs = [], isLoading: tabsLoading, refetch: refetchTabs } = useQuery<ProjectTab[]>({
    queryKey: ['tabs', interfaceId],
    queryFn: async () => {
      if (!interfaceId) return []
      
      // First check if tabs are already in the project tree
      if (currentInterface?.tabs) {
        // Sort tabs from project tree by order
        return [...currentInterface.tabs].sort((a, b) => (a.order || 0) - (b.order || 0))
      }
      
      // Otherwise fetch tabs
      const tabs = await tabActions.list(interfaceId)
      return tabs.sort((a, b) => (a.order || 0) - (b.order || 0))
    },
    enabled: !!interfaceId,
    staleTime: 2 * 60 * 1000, // Consider tabs fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
  
  // Use either tabs loading or interface loading state
  const loadingTabs = tabsLoading || (interfaceId && !currentInterface)
  
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
  const navigateSoft = (url: string) => {
    setIsSwitchingInterface(true)
    router.push(url)
  }
  
  // Navigate without triggering the loading screen (for tab switches)
  const navigateTab = (url: string) => {
    router.push(url)
  }
  
  const handleProjectChange = async (newProject: string) => {
    setSelectedProject(newProject)
    const newParams = new URLSearchParams(searchParams.toString())
    newParams.set('project', newProject)
    
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
    navigateSoft(`?${newParams.toString()}`)
  }
  
  const handleInterfaceChange = async (newInterfaceName: string) => {
    const iface = currentInterfaces.find(i => i.name === newInterfaceName)
    if (!iface) return
    
    const newParams = new URLSearchParams(searchParams.toString())
    newParams.set('interface', iface.name)
    newParams.delete('tab') // Clear tab selection
    navigateSoft(`?${newParams.toString()}`)
  }
  
  const handleTabClick = (tab: ProjectTab) => {
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
  }
  
  const handleCreateTab = async () => {
    if (!newTabName.trim() || !interfaceId) return
    
    setIsCreatingTab(true)
    try {
      // Create the tab
      const newTab = await tabActions.create(interfaceId, newTabName.trim(), {})
      showSuccessToast(`Tab "${newTabName}" created successfully`)
      
      setCreateTabOpen(false)
      const tabNameToNavigate = newTabName.trim()
      setNewTabName('')
      
      // Invalidate and refetch to ensure the new tab is in the store
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tabs', interfaceId] }),
        queryClient.invalidateQueries({ queryKey: ['projects', 'tree'] })
      ])
      
      // Refetch tabs to ensure the store is updated
      await refetchTabs()
      await refetchProjectTree()
      
      // Navigate to the new tab
      if (syncedInterfaceUIActions) {
        syncedInterfaceUIActions.setActiveTab(tabNameToNavigate)
      }
    } catch (error) {
      console.error('Failed to create tab:', error)
      showErrorToast('Failed to create tab')
    } finally {
      setIsCreatingTab(false)
    }
  }
  
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
  
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setCreateProjectError('Project name is required')
      return
    }
    
    setIsCreatingProject(true)
    const result = await createProject(newProjectName, projectActions, projectTree.map(p => p.project), newProjectIcon)
    
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
      setNewProjectName('')
      setNewProjectIcon(undefined)
    } else {
      setCreateProjectError(result.error || 'Failed to create project')
    }
    setIsCreatingProject(false)
  }
  
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
  
  const handleRenameProject = async () => {
    if (!activeProject || !renameProjectName.trim()) return
    
    setIsRenamingProject(true)
    const result = await renameProject(activeProject, renameProjectName.trim(), projectActions, projectTree.map(p => p.project))
    
    if (result.success) {
      await refetchProjectTree()
      
      // Navigate to renamed project
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.set('project', renameProjectName.trim())
      navigateSoft(`?${newParams.toString()}`)
      
      setRenameProjectOpen(false)
    } else {
      showErrorToast(result.error || 'Failed to rename project')
    }
    setIsRenamingProject(false)
  }
  
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
  
  const handleCreateInterface = async () => {
    if (!activeProject || !newInterfaceName.trim()) return
    
    setIsCreatingInterface(true)
    const result = await createInterface(
      newInterfaceName.trim(),
      activeProject,
      queryClient,
      { interfaces: interfaceActions, tabs: tabActions, tiles: tileActions },
      []
    )
    
    if (result.success && result.interface) {
      await refetchProjectTree()
      
      // Navigate to new interface
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.set('project', activeProject)
      newParams.set('interface', result.interface.name)
      navigateSoft(`?${newParams.toString()}`)
      
      setCreateInterfaceOpen(false)
      setNewInterfaceName('')
    } else {
      showErrorToast(result.error || 'Failed to create interface')
    }
    setIsCreatingInterface(false)
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
    onResize: (newWidth) => {
      setSidebarWidth(newWidth)
      if (!isCollapsed || parseFloat(newWidth) >= 12) {
        setLastExpandedWidth(newWidth)
      }
    },
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
  
  // Initialize project name when opening rename dialog
  useEffect(() => {
    if (renameProjectOpen && activeProject) {
      setRenameProjectName(activeProject)
    }
  }, [renameProjectOpen, activeProject])
  
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

  // Sortable Tab Component
  const SortableTab = ({ tab, isActive, onTabClick }: { tab: ProjectTab; isActive: boolean; onTabClick: (tab: ProjectTab) => void }) => {
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
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 999 : 'auto',
    }

    // Check if this tab's data is being loaded
    const isTabLoading = queryClient.getQueryState(['tabCompleteData', interfaceId, tab.name, selectedProject])?.fetchStatus === 'fetching'

    return (
      <div 
        ref={setNodeRef} 
        style={style}
        className={cn(
          "group flex items-center", 
          isDragging && "z-50"
        )}
      >
        <button
          {...attributes}
          {...listeners}
          onClick={() => onTabClick(tab)}
          className={cn(
            "flex-1 flex items-center gap-2 py-2 text-sm rounded-md transition-colors relative cursor-pointer",
            isCollapsed ? "px-0 justify-center" : "px-3",
            isActive
              ? "text-primary font-medium"
              : "text-muted-foreground hover:text-foreground",
            isDragging && "cursor-grabbing"
          )}
        >
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center w-full relative">
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
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              {renderSidebarIcon(tab.icon, "h-4 w-4", "tab")}
              <span className="truncate">{tab.name}</span>
              {isTabLoading && (
                <Loader2 className="h-3 w-3 animate-spin ml-auto" />
              )}
            </>
          )}
        </button>
        {!isCollapsed && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
              <DropdownMenuItem 
                onSelect={() => {
                  onTabClick(tab)
                  setSaveInterfaceOpen(true)
                }}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Tab
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={() => {
                  onTabClick(tab)
                  const resetInterfaceCommand = storeCommands.find(cmd => cmd.id === "reset-interface");
                  if (resetInterfaceCommand) {
                    resetInterfaceCommand.action?.();
                  }
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Tab
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onSelect={() => {
                  setSelectedTab(tab)
                  setNewTabName(tab.name)
                  setRenameTabOpen(true)
                }}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={() => {
                  setSelectedTab(tab)
                  setNewTabIcon((tab.icon && tab.icon.trim() !== '' && tab.icon !== 'null' && tab.icon !== 'undefined') ? tab.icon : 'file-text')
                  setTabIconOpen(true)
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                Change Icon
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={() => {
                  setSelectedTab(tab)
                  setNewTabColor(tab.color || '')
                  setTabColorOpen(true)
                }}
              >
                <Palette className="h-4 w-4 mr-2" />
                Change Color
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={() => {
                  onTabClick(tab)
                  setGlobalContextOpen(true)
                }}
              >
                <Layers className="h-4 w-4 mr-2" />
                Set Tab Context
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onSelect={() => {
                  setSelectedTab(tab)
                  setDeleteTabOpen(true)
                }}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    )
  }

  // Handle drag end
  const handleTabDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id || !interfaceId) {
      return
    }

    const oldIndex = currentTabs.findIndex(tab => (tab.id || tab.name) === active.id)
    const newIndex = currentTabs.findIndex(tab => (tab.id || tab.name) === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    // Optimistically update the UI
    const newTabs = arrayMove(currentTabs, oldIndex, newIndex)
    
    // Update the tabs in the query cache immediately for instant UI feedback
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

  return (
    <TooltipProvider>
      {/* Toggle Buttons */}
      {isCompletelyHidden ? (
        <div className="fixed left-2 top-[3.625rem] z-[100] animate-in fade-in duration-300">
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
      ) : (
        <div 
          className="fixed top-[3.5rem] z-[100] pointer-events-auto"
          style={{ 
            left: isCollapsed ? '0.5rem' : 'calc(var(--interface-nav-width, 16rem) - 2.5rem)',
            transition: isDraggingSidebar ? 'none' : 'left 300ms ease-in-out'
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  toggleSidebar()
                }}
                className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-primary-foreground hover:bg-primary"
                style={{ position: 'relative', zIndex: 100 }}
              >
                {isCollapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      
      {/* Sidebar Container */}
      <div 
        data-interface-color 
        className={cn(
          "fixed left-0 top-12 h-[calc(100vh-3rem)] bg-[color:var(--background)] border-r border-[color:var(--border)] flex flex-col z-20",
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
              "absolute right-0 top-14 bottom-0 w-1 cursor-ew-resize bg-transparent hover:bg-[color:var(--primary)]/50 transition-colors z-10",
              "after:absolute after:top-0 after:bottom-0 after:content-['']",
              isCollapsed ? "after:right-[-6px] after:left-[-2px]" : "after:right-[-2px] after:left-[-2px]",
              isDraggingSidebar && "bg-[color:var(--primary)]/50"
            )}
          />
        )}
        
        {/* Header with Dropdowns */}
        {!isCompletelyHidden && !isCollapsed && (
          <div className="p-3 pr-10 space-y-2 border-b overflow-hidden">
            {/* Project Dropdown with Context Menu */}
            <div className="flex items-center gap-1 w-full min-w-0">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between h-9"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {renderSidebarIcon(currentProjectData?.icon, "h-4 w-4 flex-shrink-0", "project")}
                      <span className="truncate text-sm">{selectedProject || "Projects"}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Search projects..." />
                    <CommandEmpty>No project found.</CommandEmpty>
                    <CommandGroup>
                                            {projectTree.length === 0 ? (
                        // Loading skeleton for projects
                        <div className="p-1">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-sm">
                              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                              <div className="flex-1 h-4 bg-muted animate-pulse rounded" style={{ width: `${70 + i * 10}%` }} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        projectTree.map((project) => {
                          const isSelected = projectId === project.project
                          return (
                        <CommandItem
                          key={project.project}
                          value={project.project}
                          onSelect={() => handleProjectChange(project.project)}
                          className={cn(
                              isSelected && "text-primary"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {renderSidebarIcon(project.icon, "h-4 w-4 flex-shrink-0", "project")}
                            <span className="truncate">{project.project}</span>
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
                  <Button size="icon" variant="ghost" className="h-9 w-9">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end">
                  <DropdownMenuItem onSelect={() => setCreateProjectOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Project
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => {
                    // Handle create interface for current project
                    setActiveProject(selectedProject)
                    setCreateInterfaceOpen(true)
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Interface
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => {
                    // Handle project rename
                    setActiveProject(selectedProject)
                    setRenameProjectName(selectedProject)
                    setRenameProjectOpen(true)
                  }}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Rename Project
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => {
                    setActiveProject(selectedProject)
                    setNewProjectIconEdit(currentProjectData?.icon || 'folder')
                    setProjectIconOpen(true)
                  }}>
                    <Palette className="h-4 w-4 mr-2" />
                    Change Icon
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => {
                    setImportProjectName(selectedProject)
                    setImportInterfaceOpen(true)
                  }}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Interface
                  </DropdownMenuItem>
                  {selectedProject !== 'Usage' && (
                    <DropdownMenuItem onSelect={() => {
                      setFileUploadOpen(true)
                    }}>
                      <FileInput className="h-4 w-4 mr-2" />
                      Upload Logs
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => handleToggleFavourite()}>
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
            
            {/* Interface Dropdown - only show when project has multiple interfaces */}
            {currentInterfaces.length > 1 && (
              <div className="flex items-center gap-1 w-full min-w-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-9"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {renderSidebarIcon(currentInterface?.icon, "h-4 w-4 flex-shrink-0", "interface")}
                        <span className="truncate text-sm">
                          {currentInterface?.name || "Interfaces"}
                        </span>
                      </div>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandInput placeholder="Search interfaces..." />
                      <CommandEmpty>No interface found.</CommandEmpty>
                      <CommandGroup>
                        {currentInterfaces.map((iface) => {
                          const isSelected = currentInterface?.name === iface.name
                          return (
                          <CommandItem
                            key={iface.name}
                            value={iface.name}
                            onSelect={() => handleInterfaceChange(iface.name)}
                            className={cn(
                              isSelected && "text-primary"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {renderSidebarIcon(iface.icon, "h-4 w-4 flex-shrink-0", "interface")}
                              <span className="truncate">{iface.name}</span>
                            </div>
                          </CommandItem>
                          )
                        })}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                {/* Interface Context Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-9 w-9">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" align="end">
                                      <DropdownMenuItem onSelect={() => {
                    if (currentInterface) {
                      setSelectedInterfaceForAction(currentInterface)
                      setRenameInterfaceOpen(true)
                    }
                  }}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Rename Interface
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => {
                    if (currentInterface) {
                      setSelectedInterfaceForAction(currentInterface)
                      setNewInterfaceIcon(currentInterface.icon || 'layout-grid')
                      setInterfaceIconOpen(true)
                    }
                  }}>
                    <Palette className="h-4 w-4 mr-2" />
                    Change Icon
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => {
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
            )}
            
            {/* Interface Context Menu - show when single interface */}
            {currentInterfaces.length === 1 && currentInterface && (
              <div className="flex items-center gap-1 w-full min-w-0">
                {/* Display single interface */}
                <div className="w-full flex items-center gap-2 px-3 py-2 h-9 text-sm border border-input rounded-md bg-background">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {renderSidebarIcon(currentInterface.icon, "h-4 w-4 flex-shrink-0", "interface")}
                    <span className="truncate">{currentInterface.name}</span>
                  </div>
                </div>
                
                {/* Context Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-9 w-9">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" align="end">
                    <DropdownMenuItem onSelect={() => {
                      setSelectedInterfaceForAction(currentInterface)
                      setRenameInterfaceOpen(true)
                    }}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Rename Interface
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => {
                      setSelectedInterfaceForAction(currentInterface)
                      setNewInterfaceIcon(currentInterface.icon || 'layout-grid')
                      setInterfaceIconOpen(true)
                    }}>
                      <Palette className="h-4 w-4 mr-2" />
                      Change Icon
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => {
                      if (currentInterface.id) {
                        handleExportInterface(currentInterface.id)
                      }
                    }}>
                      <Download className="h-4 w-4 mr-2" />
                      Export as Template
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onSelect={() => {
                        setSelectedInterfaceForAction(currentInterface)
                        setDeleteInterfaceOpen(true)
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Interface
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        )}
        
        {/* Tabs List */}
        {!isCompletelyHidden && (
          <ScrollArea className="flex-1 px-2 py-2">
            <div className="space-y-1">
              {/* Spacer for toggle button in collapsed mode */}
              {isCollapsed && <div className="h-10" />}
              {/* Add Tab Button - subtle - show when we have an interface ID and not collapsed */}
              {interfaceId && !isCollapsed && (
                <button
                  onClick={() => setCreateTabOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Tab</span>
                </button>
              )}
              
              {loadingTabs ? (
                <div className="space-y-1">
                  {/* Show skeleton loaders that match tab items */}
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={cn(
                      "flex items-center gap-2 py-2",
                      isCollapsed ? "px-0 justify-center" : "px-3"
                    )}>
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
                <div className="px-3 py-8 text-sm text-muted-foreground text-center">
                  <div className="mb-2">
                    <svg className="h-8 w-8 mx-auto text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  No tabs yet
                </div>
              ) : (
                <>
                  {currentTabs.length > 0 && <Separator className="my-1" />}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleTabDragEnd}
                    onDragStart={(event) => setActiveTabId(event.active.id as string)}
                    onDragCancel={() => setActiveTabId(null)}
                  >
                    <SortableContext
                      items={currentTabs.map(tab => tab.id || tab.name)}
                      strategy={verticalListSortingStrategy}
                    >
                      {currentTabs.map((tab) => (
                        <SortableTab
                          key={tab.id || tab.name}
                          tab={tab}
                          isActive={activeTabName === tab.name}
                          onTabClick={handleTabClick}
                        />
                      ))}
                    </SortableContext>
                    <DragOverlay>
                      {activeTabId && (() => {
                        const activeTab = currentTabs.find(tab => (tab.id || tab.name) === activeTabId)
                        if (!activeTab) return null
                        
                        return (
                          <div className="bg-background border-2 border-primary/50 rounded-md shadow-xl p-2 opacity-95 transform scale-105">
                            <div className="flex items-center gap-2">
                              {renderSidebarIcon(activeTab.icon, "h-4 w-4", "tab")}
                              {!isCollapsed && <span className="text-sm font-medium">{activeTab.name}</span>}
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
        )}
        
        {/* Mode Controls */}
        {!isCollapsed && !isCompletelyHidden && (
          <div
            className={cn(
              "border-t border-[color:var(--border)] p-2 space-y-2 bg-[color:var(--background)] flex-shrink-0 transform transition-transform duration-300",
              showModeControls ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
            )}
          >
            <div>
              <div className="flex items-center justify-between w-full px-2 py-1 rounded-md">
                <div className="flex items-center gap-2">
                  <Hammer className={cn('h-4 w-4', isEditMode && 'text-primary')} />
                  <span className="text-sm">Edit Mode</span>
                </div>
                <Switch checked={isEditMode} onCheckedChange={onEditModeToggle} />
              </div>
              
              <div className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden",
                isEditMode ? "max-h-20" : "max-h-0"
              )}>
                <div className={cn(
                  "transition-opacity duration-300 space-y-1 mt-1",
                  isEditMode ? "opacity-100" : "opacity-0"
                )}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={onAddTile}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tile
                  </Button>
                  <ColorPicker value={pickerColor} onChange={handleThemeChange} useDialog={true} showReset={true} onReset={handleThemeReset}>
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      <Palette className="h-4 w-4 mr-2" />
                      Set Project Color
                    </Button>
                  </ColorPicker>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between w-full px-2 py-1 rounded-md">
              <div className="flex items-center gap-2">
                <SquareMousePointer className={cn('h-4 w-4', isCommandMode && 'text-primary')} />
                <span className="text-sm">Dashboard Mode</span>
              </div>
              <Switch checked={isCommandMode} onCheckedChange={onCommandModeToggle} />
            </div>
          </div>
        )}
        
        {/* Collapsed Mode Controls */}
        {isCollapsed && !isCompletelyHidden && (
          <div
            className={cn(
              "absolute inset-x-0 bottom-4 flex flex-col items-center pointer-events-auto transform transition-transform duration-300",
              showModeControls ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
            )}
          >
            <Separator orientation="horizontal" className="w-8 mb-2" />
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
            
            <div className={cn(
              "transition-all duration-300 ease-in-out overflow-hidden flex flex-col items-center gap-2",
              isEditMode ? "max-h-20 mt-2" : "max-h-0 mt-0 opacity-0"
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={onAddTile} className="h-8 w-8">
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Add Tile</TooltipContent>
              </Tooltip>
              
              <ColorPicker value={pickerColor} onChange={handleThemeChange} useDialog={true} showReset={true} onReset={handleThemeReset}>
                <ActionButton
                  size="icon"
                  variant="ghost"
                  tooltip="Set Project Color"
                  className="h-8 w-8"
                  icon={<Palette className="h-4 w-4" />}
                />
              </ColorPicker>
            </div>
            
            <div className="mt-4">
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
          </div>
        )}
      </div>
      
      {/* Dialogs */}
      {typeof window !== 'undefined' && createProjectOpen && createPortal(
        <BaseDialog
          button={<></>}
          open={createProjectOpen}
          setOpen={setCreateProjectOpen}
          title="Create New Project"
          body={
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  value={newProjectName}
                  onChange={(e) => {
                    setNewProjectName(e.target.value)
                    setCreateProjectError('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Project Icon</Label>
                <IconSelector value={newProjectIcon as any} onValueChange={setNewProjectIcon} />
              </div>
              {createProjectError && <p className="text-xs text-destructive">{createProjectError}</p>}
            </div>
          }
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreateProjectOpen(false)}>
                Cancel
              </Button>
              <SubmitButton
                text="Create"
                onClick={handleCreateProject}
                loading={isCreatingProject}
              />
            </div>
          }
        />, document.body
      )}
      
      {typeof window !== 'undefined' && createTabOpen && createPortal(
        <BaseDialog
          button={null as any}
          open={createTabOpen}
          setOpen={setCreateTabOpen}
          title="Create New Tab"
          body={
            <div className="space-y-2 pt-4">
              <Label htmlFor="tab-name">Tab Name</Label>
              <Input
                id="tab-name"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTab()}
                autoFocus
              />
            </div>
          }
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreateTabOpen(false)}>
                Cancel
              </Button>
              <SubmitButton
                text="Create"
                onClick={handleCreateTab}
                loading={isCreatingTab}
              />
            </div>
          }
        />, document.body
      )}
      
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
      {typeof window !== 'undefined' && renameProjectOpen && activeProject && createPortal(
        <BaseDialog
          button={null as any}
          open={renameProjectOpen}
          setOpen={setRenameProjectOpen}
          title={`Rename Project "${activeProject}"`}
          body={
            <div className="space-y-2 pt-4">
              <Label htmlFor="project-rename">New Project Name</Label>
              <Input
                id="project-rename"
                value={renameProjectName}
                onChange={(e) => setRenameProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameProject()}
                autoFocus
              />
            </div>
          }
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRenameProjectOpen(false)}>
                Cancel
              </Button>
              <SubmitButton
                text="Rename"
                onClick={handleRenameProject}
                loading={isRenamingProject}
              />
            </div>
          }
        />, document.body
      )}
      
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
      {typeof window !== 'undefined' && createInterfaceOpen && activeProject && createPortal(
        <BaseDialog
          button={null as any}
          open={createInterfaceOpen}
          setOpen={setCreateInterfaceOpen}
          title={`Create Interface in "${activeProject}"`}
          body={
            <div className="space-y-2 pt-4">
              <Label htmlFor="interface-name">Interface Name</Label>
              <Input
                id="interface-name"
                value={newInterfaceName}
                onChange={(e) => setNewInterfaceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateInterface()}
                autoFocus
              />
            </div>
          }
          footer={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreateInterfaceOpen(false)}>
                Cancel
              </Button>
              <SubmitButton
                text="Create"
                onClick={handleCreateInterface}
                loading={isCreatingInterface}
              />
            </div>
          }
        />, document.body
      )}
      
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
    </TooltipProvider>
  )
} 