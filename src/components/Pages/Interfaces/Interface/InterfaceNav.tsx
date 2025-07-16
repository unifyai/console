"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/misc/cn'
import { 
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeft,
  FileInput,
  FileOutput,
  Edit3,
  Trash2,
  Hammer,
  SquareMousePointer,
  Loader2,
  Star,
  Plus,
  Upload,
  Download,
  RefreshCw,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Terminal
} from 'lucide-react'

import { Switch } from '@/components/UI/switch'
import { Button } from '@/components/UI/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/UI/dropdown-menu'
import { Separator } from '@/components/UI/separator'
import { ScrollArea } from '@/components/UI/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useStoreContext } from '@/contexts/providers/StoreProvider'
import { useListInterfacesQuery } from '@/hooks/Interfaces/Query/useInterfacesQuery'
import { useQueryClient, QueryClient } from '@tanstack/react-query'
import BaseDialog from '@/components/Common/Dialogs/Base'
import { Input } from '@/components/UI/input'
import { Label } from '@/components/UI/label'
import SubmitButton from '@/components/Common/Buttons/Submit'
import { Alert, AlertDescription } from '@/components/UI/alert'
import { AlertCircle, Check, FileUp, X } from 'lucide-react'
import { showLoadingToast, showSuccessToast, showErrorToast } from '@/components/Common/Toasts/notifications'
import { useDropzone } from 'react-dropzone'
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
  exportInterfaceTemplate,
  importInterfaceTemplate,
  toggleFavourite,
  DeleteProjectOption
} from './actions'
import DeleteProjectDialog from './Buttons/DeleteProject'
import { FileUpload } from './Buttons/FileUpload'
import { useListContextsQuery } from '@/hooks/Interfaces/Query/useContextsQuery'
import { useCommand } from '@/contexts/hooks/commands/useCommand'

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
  // Full action bundle
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
}

interface ProjectItemProps {
  project: string
  currentInterfaceId: string
  expandedProjects: Set<string>
  toggleProject: (projectId: string) => void
  interfaceActions: GranularInterfaceActions
  tabActions: GranularTabActions
  tileActions: GranularTileActions
  favouritesActions: FavouritesActions
  favourites: Favourite[]
  queryClient: QueryClient
  onProjectAction: (project: string, action: 'rename' | 'delete' | 'upload' | 'import' | 'create-interface') => void
  onNavigate: (url: string) => void
  onRefresh: () => void
  refreshStatus: 'idle' | 'loading' | 'success'
  projectsRefreshing: boolean
}

interface InterfaceItemProps {
  iface: { id?: string; name: string }
  project: string
  isActive: boolean
  isLast: boolean
  searchParams: URLSearchParams
  router: any
  interfaceActions: GranularInterfaceActions
  interfaces: Array<{ id?: string; name: string }>
  refetchInterfaces: () => void
  onNavigate: (url: string) => void
  onRefresh: () => void
  refreshStatus: 'idle' | 'loading' | 'success'
}

const InterfaceItem: React.FC<InterfaceItemProps> = ({
  iface,
  project,
  isActive,
  isLast,
  searchParams,
  router,
  interfaceActions,
  interfaces,
  refetchInterfaces,
  onNavigate,
  onRefresh,
  refreshStatus
}) => {
  // Dialog states
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newInterfaceName, setNewInterfaceName] = useState('')
  const [renameError, setRenameError] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const handleInterfaceClick = (e: React.MouseEvent) => {
    e.preventDefault()
    const newParams = new URLSearchParams(searchParams.toString())
    newParams.set('project', project)
    newParams.set('interface', iface.name)
    onNavigate(`?${newParams.toString()}`)
  }
  
  const handleRenameInterface = async () => {
    if (!iface.id) {
      setRenameError('Interface ID is missing')
      return
    }
    setIsRenaming(true)
    const result = await renameInterface(
      iface.id,
      iface.name,
      newInterfaceName,
      interfaceActions,
      interfaces.filter(i => i.id) as Array<{ id: string; name: string }>
    )
    if (result.success) {
      refetchInterfaces()
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.set('interface', newInterfaceName.trim())
      onNavigate(`?${newParams.toString()}`)
      setRenameDialogOpen(false)
    } else {
      setRenameError(result.error || 'Failed to rename interface')
    }
    setIsRenaming(false)
  }
  
  const handleDeleteInterface = async () => {
    if (!iface.id) {
      console.error('Interface ID is missing')
      return
    }
    setIsDeleting(true)
    const result = await deleteInterface(iface.id as string, iface.name, interfaceActions)
    if (result.success) {
      refetchInterfaces()
      if (isActive) {
        onNavigate(`/interfaces?project=${project}`)
      }
      setDeleteDialogOpen(false)
    }
    setIsDeleting(false)
  }
  
  const handleExportTemplate = async () => {
    if (!iface.id) {
      console.error('Interface ID is missing')
      return
    }
    await exportInterfaceTemplate(iface.id as string, iface.name, project, interfaceActions)
  }
  
  useEffect(() => {
    if (renameDialogOpen) {
      setNewInterfaceName(iface.name)
      setRenameError('')
    }
  }, [renameDialogOpen, iface.name])
  
  return (
    <>
      <div className="relative">
        {/* L-shaped branch */}
        <div className="absolute left-2 top-[18px] w-4 h-px bg-[color:var(--muted)]" />
        <div className="absolute left-2 top-0 h-[19px] w-px bg-[color:var(--muted)]" />
        
        {/* Cover the vertical line for the last item */}
        {isLast && (
          <div className="absolute left-2 top-[19px] bottom-0 w-px bg-[color:var(--background)]" />
        )}
        
        <div className="flex items-center ml-2 pr-2 group">
          <button
            onClick={handleInterfaceClick}
            className={cn(
              "block flex-1 text-left pl-6 pr-2 py-2 text-sm rounded-md transition-colors flex items-center gap-1",
              "text-[color:var(--muted-foreground)]",
              "hover:text-[color:var(--foreground)]",
              isActive && "text-[color:var(--primary)] hover:text-[color:var(--primary)]"
            )}
          >
            <span className="truncate flex-1">{iface.name}</span>
            {isActive && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh();
                }}
              >
                {refreshStatus === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <RefreshCw className={cn("h-4 w-4", refreshStatus === 'loading' && "animate-spin")} />
                )}
              </Button>
            )}
            {/* Ellipsis dropdown for interface */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-56">
                <DropdownMenuItem 
                  onSelect={() => setRenameDialogOpen(true)} 
                  className="flex items-center gap-2"
                >
                  <Edit3 className="h-4 w-4" />
                  <span>Rename Interface</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleExportTemplate} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <span>Export as Template</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-[color:var(--destructive)] flex items-center gap-2" 
                  onSelect={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Interface</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </button>
        </div>
      </div>
      
      {/* Dialogs rendered in portal to avoid sidebar layout shifts */}
      {typeof window !== 'undefined' && renameDialogOpen && createPortal(
        <BaseDialog
          button={null as any}
          open={renameDialogOpen}
          setOpen={setRenameDialogOpen}
          title="Rename Interface"
          body={<div className="space-y-2 pt-4"><Label htmlFor="interface-rename">New Interface Name</Label><Input id="interface-rename" value={newInterfaceName} onChange={(e)=>{setNewInterfaceName(e.target.value);setRenameError('')}} onKeyDown={(e)=>e.key==='Enter'&&handleRenameInterface()} autoFocus />{renameError&&<p className="text-xs text-destructive">{renameError}</p>}</div>}
          footer={<SubmitButton text="Rename" onClick={handleRenameInterface} loading={isRenaming} />}
        />, document.body)}

      {typeof window !== 'undefined' && deleteDialogOpen && createPortal(
        <BaseDialog
          button={null as any}
          open={deleteDialogOpen}
          setOpen={setDeleteDialogOpen}
          title="Delete Interface"
          body={<p className="pt-4">Are you sure you want to delete the interface &quot;{iface.name}&quot;? This action cannot be undone.</p>}
          footer={<Button variant="destructive" onClick={handleDeleteInterface} disabled={isDeleting}>{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Delete</Button>}
        />, document.body)}
    </>
  )
}

const ProjectItem: React.FC<ProjectItemProps> = ({ 
  project, 
  currentInterfaceId, 
  expandedProjects,
  toggleProject,
  interfaceActions,
  tabActions,
  tileActions,
  favouritesActions,
  favourites,
  queryClient,
  onProjectAction,
  onNavigate,
  onRefresh,
  refreshStatus,
  projectsRefreshing
}) => {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: interfaces = [], isLoading, refetch: refetchInterfaces } = useListInterfacesQuery(project, interfaceActions)
  
  const isExpanded = expandedProjects.has(project)
  const hasInterfaces = interfaces.length > 0
  const hasSingleInterface = interfaces.length === 1
  const hasActiveInterface = interfaces.some((iface: any) => iface.id === currentInterfaceId)
  
  // Favourite state
  const [isFavouriting, setIsFavouriting] = useState(false)
  const currentFavourite = useMemo(() => 
    favourites?.find(fav => fav.project === project) || null,
    [favourites, project]
  )

  const handleProjectClick = () => {
    if (isLoading) return
    
    if (hasSingleInterface && interfaces[0].id) {
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.set('project', project)
      newParams.set('interface', interfaces[0].name)
      onNavigate(`?${newParams.toString()}`)
    } else if (interfaces.length > 1) {
      toggleProject(project)
    }
  }

  
  
  const handleToggleFavourite = async () => {
    setIsFavouriting(true)
    await toggleFavourite(project, currentFavourite, favouritesActions, favourites)
    setIsFavouriting(false)
  }

  return (
    <>
      <div className="flex items-center gap-1 group">
        <button
          onClick={handleProjectClick}
          className={cn(
            "flex-1 text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-1",
            "text-[color:var(--muted-foreground)]",
            "hover:text-[color:var(--foreground)]",
            hasInterfaces ? "cursor-pointer" : "cursor-default",
            hasActiveInterface && "text-[color:var(--primary)] hover:text-[color:var(--primary)]"
          )}
        >
          <span className="truncate flex-1">{project}</span>
          {projectsRefreshing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          
          {/* Ellipsis dropdown (visible on hover) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
                                    <DropdownMenuContent side="right" align="start" className="w-56">
              <DropdownMenuItem onSelect={() => onProjectAction(project, 'create-interface')} className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            <span>Create Interface</span>
                          </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onProjectAction(project, 'import')} className="flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            <span>Import Interface</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleToggleFavourite} disabled={isFavouriting} className="flex items-center gap-2">
                {isFavouriting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Star className={cn("h-4 w-4", currentFavourite && "fill-current")} />
                )}
                <span>{currentFavourite ? 'Remove from Favourites' : 'Add to Favourites'}</span>
                          </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onProjectAction(project, 'rename')} className="flex items-center gap-2">
                            <Edit3 className="h-4 w-4" />
                            <span>Rename Project</span>
                          </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={() => {
                  // For now, we'll show an alert that this feature needs to be implemented
                  // You can replace this with proper file upload dialog implementation
                  alert('Upload Logs feature - to be implemented')
                }} 
                className="flex items-center gap-2"
              >
                <FileInput className="h-4 w-4" />
                <span>Upload Logs</span>
              </DropdownMenuItem>
                            <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-[color:var(--destructive)] flex items-center gap-2" 
                onSelect={() => onProjectAction(project, 'delete')}
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Project</span>
              </DropdownMenuItem>
                        </DropdownMenuContent>
          </DropdownMenu>

          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : interfaces.length > 1 ? (
            <ChevronRight className={cn(
              "h-4 w-4 transition-transform duration-300",
              isExpanded && "rotate-90"
            )} />
          ) : null}
        </button>
      </div>
      

      
      <div 
        className={cn(
          "ml-3 relative overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded && (isLoading || interfaces.length > 1) ? "opacity-100" : "max-h-0 opacity-0"
        )}
        style={{
          maxHeight: isExpanded && (isLoading || interfaces.length > 1) ? `${isLoading ? 50 : interfaces.length * 40 + 20}px` : '0px'
        }}
      >
        {/* Tree line */}
        <div className={cn(
          "absolute left-2 top-0 bottom-0 w-px bg-[color:var(--muted)] transition-opacity duration-300",
          isExpanded ? "opacity-100" : "opacity-0"
        )} />
        
        <div className="space-y-0">
          {isLoading ? (
            <div className="flex items-center gap-2 pl-6 py-2 text-sm text-[color:var(--muted-foreground)]">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Loading interfaces...</span>
            </div>
          ) : (
            interfaces.map((iface: any, index: number) => (
              <InterfaceItem
                key={iface.id}
                iface={iface}
                project={project}
                isActive={pathname === '/interfaces' && currentInterfaceId === iface.id}
                isLast={index === interfaces.length - 1}
                searchParams={searchParams}
                router={router}
                interfaceActions={interfaceActions}
                interfaces={interfaces}
                refetchInterfaces={refetchInterfaces}
                onNavigate={onNavigate}
                onRefresh={onRefresh}
                refreshStatus={refreshStatus}
              />
            ))
            )}
          </div>
        </div>
    </>
  )
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
  onRefresh,
  refreshStatus
}: InterfaceNavProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set([projectId]))
  const [hasScroll, setHasScroll] = useState(false)
  const [favourites, setFavourites] = useState<Favourite[]>(initialFavourites || [])
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [createProjectError, setCreateProjectError] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)

  // refreshing projects indicator
  const [projectsRefreshing, setProjectsRefreshing] = useState(false)
  // Interface creation dialog state
  const [newInterfaceNameDialog, setNewInterfaceNameDialog] = useState('')
  const [createInterfaceError, setCreateInterfaceError] = useState('')
  const [isCreatingInterface, setIsCreatingInterface] = useState(false)
  
  // State for project-specific dialogs
  const [activeProject, setActiveProject] = useState<string | null>(null)
  const [projectDialogOpen, setProjectDialogOpen] = useState<'rename' | 'delete' | 'upload' | 'import' | 'create-interface' | null>(null)
  const [renameProjectName, setRenameProjectName] = useState('')
  const [renameProjectError, setRenameProjectError] = useState('')
  const [isRenamingProject, setIsRenamingProject] = useState(false)

  const projects = useStoreContext((s) => s.projects)
  const queryClient = useQueryClient()
  const routerRoot = useRouter()
  const setProjects = useStoreContext((s)=>s.setProjects)

  useEffect(() => {
    onNavCollapseChange?.(isCollapsed)
  }, [isCollapsed, onNavCollapseChange])

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects)
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId)
    } else {
      newExpanded.add(projectId)
    }
    setExpandedProjects(newExpanded)
  }

  // Check if scrolling is needed
  const checkScroll = (element: HTMLDivElement | null) => {
    if (element) {
      setHasScroll(element.scrollHeight > element.clientHeight)
    }
  }
  
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setCreateProjectError('Project name is required')
      return
    }
    
    setIsCreatingProject(true)
    const result = await createProject(newProjectName, projectActions, projects)
    
    if (result.success && result.projectName) {
      // Immediately create a default interface with same name
      const existingIfaces: any[] = []
      const ifaceRes = await createInterface(
        result.projectName,
        result.projectName,
        queryClient,
        { interfaces: interfaceActions, tabs: tabActions, tiles: tileActions },
        existingIfaces
      )

      // Soft navigate
      const newParams = new URLSearchParams(window.location.search)
      newParams.set('project', result.projectName)
      if (ifaceRes.success && ifaceRes.interface?.name) {
        newParams.set('interface', ifaceRes.interface.name)
      }
      navigateSoft(`/interfaces?${newParams.toString()}`)

      // Refresh caches
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey?.[0] === 'projects' })
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey?.[0] === 'interfaces' && q.queryKey[1]===result.projectName })
      setExpandedProjects(new Set([result.projectName]))
      setCreateProjectOpen(false)
      setNewProjectName('')
    } else {
      setCreateProjectError(result.error || 'Failed to create project')
    }
    setIsCreatingProject(false)
  }
  
  useEffect(() => {
    if (createProjectOpen) {
      setNewProjectName('')
      setCreateProjectError('')
    }
  }, [createProjectOpen])

  const handleConfirmDeleteProject = async (option: DeleteProjectOption = 'project') => {
    if (!activeProject) return;
    setIsCreatingProject(true); // reuse creating state as loading
    const result = await deleteProject(activeProject, option, { project: projectActions.delete });
    setIsCreatingProject(false);
    if (result.success) {
      // refresh list
      await queryClient.invalidateQueries({ predicate: (query) => query.queryKey?.[0] === 'projects' });
      // update local store if available
      const refreshed = await projectActions.get();
      setProjects(refreshed);
      setProjectDialogOpen(null);
      // navigate to interfaces home
      navigateSoft('/interfaces');
    }
  };

  const handleConfirmCreateInterface = async () => {
    if (!activeProject) return;
    if (!newInterfaceNameDialog.trim()) { setCreateInterfaceError('Interface name is required'); return; }
    setIsCreatingInterface(true);
    try {
      // fetch existing interfaces
      const existing = await interfaceActions.list(activeProject);
      const res = await createInterface(newInterfaceNameDialog.trim(), activeProject, queryClient, { interfaces: interfaceActions, tabs: tabActions, tiles: tileActions }, existing);
      if (res.success && res.interface?.name) {
        // invalidate queries and refresh list
        await queryClient.invalidateQueries({ predicate: q=> q.queryKey?.[0]==='interfaces' && q.queryKey[1]===activeProject });
        // navigate to new interface
        const params = new URLSearchParams(window.location.search);
        params.set('project', activeProject);
        params.set('interface', res.interface.name);
        navigateSoft(`/interfaces?${params.toString()}`);
        setProjectDialogOpen(null);
      } else {
        setCreateInterfaceError(res.error || 'Failed to create interface');
      }
    } catch (err:any) {
      setCreateInterfaceError(err.message || 'Error creating interface');
    } finally {
      setIsCreatingInterface(false);
    }
  };

  const handleConfirmRenameProject = async () => {
    if (!activeProject) return;
    if (!renameProjectName.trim()) { setRenameProjectError('Project name cannot be empty'); return; }
    if (renameProjectName.trim() === activeProject) { setProjectDialogOpen(null); return; }
    setIsRenamingProject(true);
    const result = await renameProject(activeProject, renameProjectName.trim(), projectActions, projects);
    setIsRenamingProject(false);
    if (result.success) {
      await queryClient.invalidateQueries({ predicate: q=> q.queryKey?.[0]==='projects' });
      const refreshed = await projectActions.get();
      setProjects(refreshed);
      setProjectDialogOpen(null);
      // navigate to renamed project base interface page
      const params = new URLSearchParams(window.location.search);
      params.set('project', renameProjectName.trim());
      navigateSoft(`/interfaces?${params.toString()}`);
    } else {
      setRenameProjectError(result.error || 'Failed to rename project');
    }
  };

  const navigateSoft = (url: string) => {
    setIsSwitchingInterface(true)
    routerRoot.push(url)
  }

  return (
    <TooltipProvider>
      <div className={cn(
        "fixed left-0 top-12 h-[calc(100vh-3rem)] bg-[color:var(--background)] border-r border-[color:var(--border)] transition-all duration-300 z-20 flex flex-col",
        isCollapsed ? "w-12" : "w-64"
      )}>
        {/* Toggle Button */}
        <div className="p-2 flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-1 flex-1">
              <h3 className="text-sm font-semibold text-[color:var(--muted-foreground)] px-2">Projects</h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start" className="w-48">
                  <DropdownMenuItem onSelect={() => setCreateProjectOpen(true)} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>Create Project</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={async () => {
                      if (projectsRefreshing) return;
                      setProjectsRefreshing(true);
                      const toastId = showLoadingToast('Refreshing project list');
                      try {
                        await queryClient.invalidateQueries({ predicate: (q) => q.queryKey?.[0] === 'projects' });
                        await queryClient.refetchQueries({ queryKey: ['projects'] });
                        showSuccessToast('Project list refreshed', undefined, toastId);
                      } catch (err) {
                        showErrorToast(err, 'Failed to refresh projects', toastId);
                      } finally {
                        setProjectsRefreshing(false);
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={cn('h-4 w-4', projectsRefreshing && 'animate-spin')} />
                    <span>Refresh List</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-8 w-8"
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

        {/* Projects Section - Dynamic Height */}
        <div className={cn(
          "flex-1 min-h-0 transition-all duration-300 flex flex-col relative",
          isCollapsed ? "h-0 opacity-0 overflow-hidden" : "opacity-100"
        )}>
          {/* Projects list with dynamic scrolling */}
          <div 
            className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-4 scrollbar-thin scrollbar-thumb-[color:var(--accent)] scrollbar-track-transparent"
            ref={checkScroll}
          >
            <div className="space-y-1">
              {projects.map((project: string) => (
                <ProjectItem
                  key={project}
                  project={project}
                  currentInterfaceId={interfaceId}
                  expandedProjects={expandedProjects}
                  toggleProject={toggleProject}
                  interfaceActions={interfaceActions}
                  tabActions={tabActions}
                  tileActions={tileActions}
                  favouritesActions={favouritesActions}
                  favourites={favourites}
                  queryClient={queryClient}
                  onProjectAction={(proj, action) => {
                    setActiveProject(proj)
                    if (action==='rename') {
                      setRenameProjectName(proj);
                    }
                    setProjectDialogOpen(action)
                  }}
                  onNavigate={navigateSoft}
                  onRefresh={onRefresh}
                  refreshStatus={refreshStatus}
                  projectsRefreshing={projectsRefreshing}
                />
              ))}
            </div>
          </div>
          
          {/* Fade effect when scrollable */}
          {hasScroll && !isCollapsed && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[color:var(--background)] to-transparent pointer-events-none" />
          )}
        </div>
        
        {/* Create Project Dialog */}
        <BaseDialog
          button={<></>}
          open={createProjectOpen}
          setOpen={setCreateProjectOpen}
          title="Create New Project"
          body={
            <div className="space-y-2 pt-4">
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
              {createProjectError && <p className="text-xs text-destructive">{createProjectError}</p>}
            </div>
          }
          footer={
            <SubmitButton
              text="Create"
              onClick={handleCreateProject}
              loading={isCreatingProject}
            />
          }
        />

        {/* Bottom Mode Controls */}
        {/* Expanded sidebar */}
        {!isCollapsed && (
          <div className="border-t border-[color:var(--border)] p-2 space-y-2 bg-[color:var(--background)] flex-shrink-0">
            {/* Edit Mode Row */}
            <div className="flex items-center justify-between w-full px-2 py-1 rounded-md hover:bg-accent/30">
              <div className="flex items-center gap-2">
                <Hammer className={cn('h-4 w-4', isEditMode && 'text-primary')} />
                <span className="text-sm whitespace-nowrap transition-opacity duration-300">Edit Mode</span>
              </div>
              <Switch checked={isEditMode} onCheckedChange={onEditModeToggle} />
            </div>
            {/* Interactive Mode Row */}
            <div className="flex items-center justify-between w-full px-2 py-1 rounded-md hover:bg-accent/30">
              <div className="flex items-center gap-2">
                <SquareMousePointer className={cn('h-4 w-4', isCommandMode && 'text-primary')} />
                <span className="text-sm whitespace-nowrap transition-opacity duration-300">Interactive Mode</span>
              </div>
              <Switch checked={isCommandMode} onCheckedChange={onCommandModeToggle} />
            </div>
          </div>
        )}

        {/* Collapsed sidebar: icons inline at bottom */}
        {isCollapsed && (
          <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-4 pointer-events-auto">
            {/* Edit Icon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onEditModeToggle}
                  className={cn(
                    isEditMode
                      ? 'text-primary hover:text-primary-foreground'
                      : 'text-muted-foreground hover:text-primary'
                  )}
                >
                  <Hammer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isEditMode ? "Disable Edit Mode" : "Enable Edit Mode"}
              </TooltipContent>
            </Tooltip>
            {/* Interactive Icon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onCommandModeToggle}
                  className={cn(
                    isCommandMode
                      ? 'text-primary hover:text-primary-foreground'
                      : 'text-muted-foreground hover:text-primary'
                  )}
                >
                  <SquareMousePointer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isCommandMode ? "Disable Interactive Mode" : "Enable Interactive Mode"}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
      {typeof window!=='undefined' && projectDialogOpen==='delete' && activeProject && createPortal(
        <BaseDialog
          button={null as any}
          open={true}
          setOpen={(open:boolean)=>{ if(!open) setProjectDialogOpen(null)}}
          title={`Delete Project "${activeProject}"`}
          body={<p className="pt-4">Are you sure you want to delete this project? This action cannot be undone.</p>}
          footer={<div className="flex gap-2"><Button variant="outline" onClick={()=>setProjectDialogOpen(null)}>Cancel</Button><Button variant="destructive" onClick={()=>handleConfirmDeleteProject()} disabled={isCreatingProject}>{isCreatingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Delete</Button></div>}
        />, document.body)}
      {typeof window!=='undefined' && projectDialogOpen==='create-interface' && activeProject && createPortal(
        <BaseDialog
          button={null as any}
          open={true}
          setOpen={(o:boolean)=>{ if(!o) setProjectDialogOpen(null)}}
          title={`Create Interface in "${activeProject}"`}
          body={<div className="space-y-2 pt-4"><Label htmlFor="ci-name">Interface Name</Label><Input id="ci-name" value={newInterfaceNameDialog} onChange={e=>{setNewInterfaceNameDialog(e.target.value); setCreateInterfaceError('')}} onKeyDown={e=> e.key==='Enter' && handleConfirmCreateInterface()} autoFocus />{createInterfaceError && <p className="text-xs text-destructive">{createInterfaceError}</p>}</div>}
          footer={<div className="flex gap-2"><Button variant="outline" onClick={()=>setProjectDialogOpen(null)}>Cancel</Button><Button onClick={handleConfirmCreateInterface} disabled={isCreatingInterface}>{isCreatingInterface && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Create</Button></div>}
        />, document.body)}
      {typeof window!=='undefined' && projectDialogOpen==='rename' && activeProject && createPortal(
        <BaseDialog
          button={null as any}
          open={true}
          setOpen={(o:boolean)=>{ if(!o) setProjectDialogOpen(null)}}
          title={`Rename Project "${activeProject}"`}
          body={<div className="space-y-2 pt-4"><Label htmlFor="rp-name">New Project Name</Label><Input id="rp-name" value={renameProjectName} onChange={e=>{setRenameProjectName(e.target.value); setRenameProjectError('')}} onKeyDown={e=> e.key==='Enter' && handleConfirmRenameProject()} autoFocus />{renameProjectError && <p className="text-xs text-destructive">{renameProjectError}</p>}</div>}
          footer={<div className="flex gap-2"><Button variant="outline" onClick={()=>setProjectDialogOpen(null)}>Cancel</Button><Button onClick={handleConfirmRenameProject} disabled={isRenamingProject}>{isRenamingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Rename</Button></div>}
        />, document.body)}
    </TooltipProvider>
  )
} 