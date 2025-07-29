"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react'
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
  Palette,
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
import { IconPicker, Icon } from '@/components/UI/icon-picker'
import { IconSelector } from '@/components/UI/icon-selector'
import SubmitButton from '@/components/Common/Buttons/Submit'
import { Alert, AlertDescription } from '@/components/UI/alert'
import { HexColorPicker } from "react-colorful"
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
import { withLoadingToast } from '@/components/Common/Toasts/notifications'
import ColorPicker from '@/components/Common/Misc/ColorPicker'
import ActionButton from '@/components/Common/Buttons/Action'
import { debounce } from 'lodash'
import { CSSProperties } from 'react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/UI/popover'
import { useTheme } from 'next-themes'
import { createInterface as createInterfaceAction } from './actions';

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
  onAddTile: () => void
  // (theme dialog callback is internal to InterfaceNav)
}

interface ProjectItemProps {
  project: string
  icon?: string
  favourite?: boolean
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
  onOpenThemeDialog: (interfaceId: string, color?: string) => void
  onNavigate: (url: string) => void
  onRefresh: () => void
  refreshStatus: 'idle' | 'loading' | 'success'
  projectsRefreshing: boolean
  prefetchedInterfaces: string[]
  isSidebarCollapsed: boolean
  onFavouritesUpdate: (favs: Favourite[]) => void
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
  onOpenThemeDialog: (interfaceId: string, color?: string) => void
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
  refreshStatus,
  onOpenThemeDialog
}) => {
  // Dialog states
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newInterfaceName, setNewInterfaceName] = useState('')
  const [renameError, setRenameError] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const handleInterfaceClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Avoid redundant navigation if this interface is already active
    if (isActive) return;
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('project', project);
    newParams.set('interface', iface.name);
    onNavigate(`?${newParams.toString()}`);
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
              isActive
                ? "text-[color:var(--primary)] hover:text-[color:var(--primary)]"
                : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
            )}
          >
            <div className="flex items-center gap-1 flex-1 min-w-0">
              {iface.name.length > 15 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="truncate min-w-0 max-w-[8rem]" >{iface.name}</span>
                  </TooltipTrigger>
                  <TooltipContent side="right">{iface.name}</TooltipContent>
                </Tooltip>
              ) : (
                <span className="truncate min-w-0 max-w-[8rem]" >{iface.name}</span>
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
                <DropdownMenuContent side="right" align="start" className="w-56" onPointerDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()}>
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
            </div>
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
                  <RefreshCw className={cn('h-4 w-4', refreshStatus === 'loading' && 'animate-spin')} />
                )}
              </Button>
            )}
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
          footer={<div className="flex gap-2"><Button variant="outline" onClick={()=>setRenameDialogOpen(false)} disabled={isRenaming}>Cancel</Button><SubmitButton text="Rename" onClick={handleRenameInterface} loading={isRenaming} /></div>}
          disableClose={isRenaming}
        />, document.body)}

      {typeof window !== 'undefined' && deleteDialogOpen && createPortal(
        <BaseDialog
          button={null as any}
          open={deleteDialogOpen}
          setOpen={setDeleteDialogOpen}
          title="Delete Interface"
          body={<p className="pt-4">Are you sure you want to delete the interface &quot;{iface.name}&quot;? This action cannot be undone.</p>}
          footer={<div className="flex gap-2"><Button variant="outline" onClick={()=>setDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button><Button variant="destructive" onClick={handleDeleteInterface} disabled={isDeleting}>{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Delete</Button></div>}
          disableClose={isDeleting}
        />, document.body)}
    </>
  )
}

const ProjectItem: React.FC<ProjectItemProps> = ({ 
  project, 
  icon,
  favourite,
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
  onOpenThemeDialog,
  onNavigate,
  onRefresh,
  refreshStatus,
  projectsRefreshing,
  prefetchedInterfaces,
  isSidebarCollapsed,
  onFavouritesUpdate
}) => {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentProjectActive = searchParams.get('project') === project;
  const interfaces = (prefetchedInterfaces || []).map((name:string)=>({id:undefined, name}));
  const refetchInterfaces = () => Promise.resolve();

  const isExpanded = expandedProjects.has(project)
  const ifaceList = interfaces;
  const hasInterfaces = ifaceList.length > 0
  const hasSingleInterface = ifaceList.length === 1
  const singleIsDefault = hasSingleInterface && ifaceList[0].name === 'Default'
  const hasExpandableInterfaces = ifaceList.length > 1 || (hasSingleInterface && !singleIsDefault)
  const isDefaultActive = currentProjectActive && singleIsDefault && ifaceList[0].name === 'Default' && pathname === '/interfaces'
  const currentInterfaceParam = searchParams.get('interface');
  const hasActiveInterface = currentProjectActive && ifaceList.some((iface: any) => iface.name === currentInterfaceParam || iface.id === currentInterfaceParam);
  
  // Favourite state
  const [isFavouriting, setIsFavouriting] = useState(false)
  const [iconDialogOpen, setIconDialogOpen] = useState(false);
  const [displayIcon, setDisplayIcon] = useState<string | undefined>(icon);
  const [newIcon, setNewIcon] = useState<string | undefined>(icon);
  useEffect(()=>{ setDisplayIcon(icon); }, [icon]);
  const [isSavingIcon, setIsSavingIcon] = useState(false);
  const currentFavourite = useMemo(() => 
    favourites?.find(fav => fav.project === project) || null,
    [favourites, project]
  )

  const handleProjectClick = async () => {
    if (projectsRefreshing) return;
    if (isDefaultActive) return; // Already on this interface

    if (isSidebarCollapsed) {
      // Navigate to last interface (take first from list or prefetched)
      const targetIface = ifaceList.length ? ifaceList[ifaceList.length-1].name : undefined;
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('project', project);
      if (targetIface) newParams.set('interface', targetIface);
      onNavigate(`?${newParams.toString()}`);
      return;
    }
 
    // If there is exactly one interface named "Default", navigate to it directly
    if (hasSingleInterface && singleIsDefault) {
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.set('project', project)
      newParams.set('interface', ifaceList[0].name)
      onNavigate(`?${newParams.toString()}`)
    } else if (hasExpandableInterfaces) {
      toggleProject(project)
    } else {
       // No interfaces yet – automatically create a Default interface for smoother UX
       try {
         const existing: any[] = [];
         const res = await createInterfaceAction('Default', project, queryClient, { interfaces: interfaceActions, tabs: tabActions, tiles: tileActions }, existing);
         if(res.success && res.interface?.name){
            const newParams = new URLSearchParams(searchParams.toString());
            newParams.set('project', project);
            newParams.set('interface', res.interface.name);
            onNavigate(`?${newParams.toString()}`);
         } else {
            // Fallback navigate to project base
            const newParams = new URLSearchParams(searchParams.toString())
            newParams.set('project', project)
            onNavigate(`?${newParams.toString()}`)
         }
       } catch(err){
         console.error('Failed to auto-create Default interface', err);
         const newParams = new URLSearchParams(searchParams.toString())
         newParams.set('project', project)
         onNavigate(`?${newParams.toString()}`)
       }
    }
  }

  
  
  const handleToggleFavourite = async () => {
    setIsFavouriting(true)
    const res = await toggleFavourite(project, currentFavourite, favouritesActions, favourites)
    if(res.success && res.newFavourites){
       onFavouritesUpdate(res.newFavourites)
    }
    setIsFavouriting(false)
  }

  const saveIcon = async (iconName: string) => {
     if(iconName === icon) return;
     setNewIcon(iconName);
     setDisplayIcon(iconName);
     setIsSavingIcon(true);
     try {
        // PATCH project icon via api route
        const res = await fetch(`/api/project/${encodeURIComponent(project)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icon: iconName })
        });
        if(!res.ok){ throw new Error('Failed to update icon'); }
        // Refresh cached project list
        await queryClient.invalidateQueries({ predicate: (q) => q.queryKey?.[0] === 'projects' });
        setIconDialogOpen(false);
     } catch(err){ console.error('save icon',err); }
     setIsSavingIcon(false);
  };
  // Keep backward compatibility for Save button
  const handleSaveIcon = async () => {
     if(!newIcon) { setIconDialogOpen(false); return; }
     await saveIcon(newIcon);
  }
  const handleIconSelect = (iconName: string) => {
     setNewIcon(iconName);
     setDisplayIcon(iconName);
  }

  if (isSidebarCollapsed) {
    // Compact view – just icon buttons stacked
    return (
      <button
        onClick={handleProjectClick}
        className={cn(
          "w-full flex justify-center py-2 hover:text-foreground transition-colors",
          (currentProjectActive || hasActiveInterface) ? "text-primary" : favourite ? "text-[color:var(--favourite)]" : "text-muted-foreground"
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            {icon && (
              (() => {
                const activeFav = favourite && (currentProjectActive || hasActiveInterface);
                const favOnly = favourite && !activeFav;
                if (/[^a-zA-Z0-9_-]/.test(displayIcon ?? "")) {
                  return <span className={cn("text-lg leading-none",
                    favOnly && "text-[color:var(--favourite)]",
                    activeFav && "text-[color:var(--primary)]"
                  )}>{icon}</span>;
                }
                return (
                  <Icon
                    name={displayIcon as any}
                    className={cn("h-5 w-5",
                      favOnly && "text-[color:var(--favourite)]",
                      activeFav && "text-[color:var(--primary)]"
                    )}
                  />
                );
              })()
            )}
          </TooltipTrigger>
          <TooltipContent side="right">{project}</TooltipContent>
        </Tooltip>
      </button>
    );
  }

  // Expanded view
  return (
    <>
      <div className="flex items-center gap-1 group">
        <div
          onClick={handleProjectClick}
          role="button"
          tabIndex={0}
          className={cn(
            "flex-1 text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-1",
            favourite ? "text-[color:var(--favourite)]" : "text-[color:var(--muted-foreground)]",
            "hover:text-[color:var(--foreground)]",
            projectsRefreshing ? "cursor-progress" : "cursor-pointer",
            (currentProjectActive || hasActiveInterface) && "text-[color:var(--primary)] hover:text-[color:var(--primary)]"
          )}
        >
          <div className="flex items-center gap-1 flex-1 min-w-0"> 
            {icon && (
              (() => {
                const activeFav2 = favourite && (currentProjectActive || hasActiveInterface);
                const favOnly2 = favourite && !activeFav2;
                if (/[^a-zA-Z0-9_-]/.test(displayIcon ?? "")) {
                  return <span className={cn("text-lg leading-none",
                    favOnly2 && "text-[color:var(--favourite)]",
                    activeFav2 && "text-[color:var(--primary)]"
                  )}>{icon}</span>;
                }
                return (
                  <Icon
                    name={displayIcon as any}
                    className={cn("h-5 w-5",
                      favOnly2 && "text-[color:var(--favourite)]",
                      activeFav2 && "text-[color:var(--primary)]"
                    )}
                  />
                );
              })()
            )}
            {!isSidebarCollapsed && (project.length > 15 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate min-w-0 max-w-[8rem]" >{project}</span>
                </TooltipTrigger>
                <TooltipContent side="right">{project}</TooltipContent>
              </Tooltip>
            ) : (
              <span className="truncate min-w-0 max-w-[8rem]" >{project}</span>
            ))}
            {/* Ellipsis dropdown (visible on hover) */}
            {!isSidebarCollapsed && <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e)=> e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-56" onPointerDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()}>
                <DropdownMenuItem onSelect={() => onProjectAction(project, 'create-interface')} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Create Interface</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onProjectAction(project, 'import')} className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <span>Import Interface</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); e.stopPropagation(); setIconDialogOpen(true); }} className="flex items-center gap-2">
                  <SquareMousePointer className="h-4 w-4" />
                  <span>Change Icon</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleToggleFavourite} disabled={isFavouriting} className="flex items-center gap-2">
                  {isFavouriting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Star className={cn("h-4 w-4", currentFavourite && "fill-current")} />
                  )}
                  <span>{currentFavourite ? 'Remove from Favourites' : 'Add to Favourites'}</span>
                </DropdownMenuItem>
                {project !== 'Usage' && (
                  <DropdownMenuItem onSelect={() => onProjectAction(project, 'rename')} className="flex items-center gap-2">
                    <Edit3 className="h-4 w-4" />
                    <span>Rename Project</span>
                  </DropdownMenuItem>
                )}
                {project !== 'Usage' && (
                  <DropdownMenuItem 
                    onSelect={() => {
                      // For now, we'll show an alert that this feature needs to be implemented
                      alert('Upload Logs feature - to be implemented');
                    }} 
                    className="flex items-center gap-2"
                  >
                    <FileInput className="h-4 w-4" />
                    <span>Upload Logs</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {project !== 'Usage' && (
                  <DropdownMenuItem 
                    className="text-[color:var(--destructive)] flex items-center gap-2" 
                    onSelect={() => onProjectAction(project, 'delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Project</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>}
          </div>
          {/* Removed per-project refresh button to declutter UI */}
          {!isSidebarCollapsed && hasExpandableInterfaces && (
            <ChevronRight className={cn('h-4 w-4 transition-transform duration-300', isExpanded && 'rotate-90')} />
          )}
        </div>
      </div>
      

      
      <div 
        className={cn(
          "ml-3 relative overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded && (projectsRefreshing || hasExpandableInterfaces) ? "opacity-100" : "max-h-0 opacity-0"
        )}
        style={{
          maxHeight: isExpanded && (projectsRefreshing || hasExpandableInterfaces) ? `${projectsRefreshing ? 50 : interfaces.length * 40 + 20}px` : '0px'
        }}
      >
        {/* Tree line */}
        <div className={cn(
          "absolute left-2 top-0 bottom-0 w-px bg-[color:var(--muted)] transition-opacity duration-300",
          isExpanded ? "opacity-100" : "opacity-0"
        )} />
        
        <div className="space-y-0">
          {projectsRefreshing ? (
            <div className="flex items-center gap-2 pl-6 py-2 text-sm text-[color:var(--muted-foreground)]">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>Loading interfaces...</span>
            </div>
          ) : (
            ifaceList.map((iface: any, index: number) => (
              <InterfaceItem
                key={iface.id ?? iface.name}
                iface={iface}
                project={project}
                isActive={pathname === '/interfaces' && currentProjectActive && (currentInterfaceParam === iface.name || currentInterfaceParam === iface.id)}
                isLast={index === interfaces.length - 1}
                searchParams={searchParams}
                router={router}
                interfaceActions={interfaceActions}
                interfaces={interfaces}
                refetchInterfaces={refetchInterfaces}
                onNavigate={onNavigate}
                onRefresh={onRefresh}
                refreshStatus={refreshStatus}
                onOpenThemeDialog={onOpenThemeDialog}
              />
            ))
            )}
          </div>
        </div>

        {typeof window !== 'undefined' && iconDialogOpen && createPortal(
          <BaseDialog
            button={null as any}
            open={iconDialogOpen}
            setOpen={setIconDialogOpen}
            title={`Select Icon for "${project}"`}
            body={<IconSelector value={newIcon as any} onValueChange={(val: any)=> handleIconSelect(val)} />}
            footer={<div className="flex gap-2"><Button variant="outline" onClick={()=> setIconDialogOpen(false)} disabled={isSavingIcon}>Cancel</Button><Button onClick={handleSaveIcon} disabled={isSavingIcon || !newIcon || newIcon===icon}>{isSavingIcon && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save</Button></div>}
            disableClose={isSavingIcon}
          />, document.body)}

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
  onAddTile,
  onRefresh,
  refreshStatus
}: InterfaceNavProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set([projectId]))
  const [hasScroll, setHasScroll] = useState(false)
  const [favourites, setFavourites] = useState<Favourite[]>(initialFavourites || [])
  const handleFavouritesUpdate = (list: Favourite[]) => {
    setFavourites(list);
    // Refresh project tree so pinned section updates
    queryClient.invalidateQueries({ predicate: (q) => q.queryKey?.[0] === 'projects' });
    // Also refresh the local project tree state so that the UI updates immediately
    fetchProjectTree();
  };
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectIcon, setNewProjectIcon] = useState<string | undefined>(undefined)
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

  // Theme dialog state
  const [themeDialogOpen, setThemeDialogOpen] = useState(false)
  const [themeColor, setThemeColor] = useState<string>("")
  const [themeInterfaceId, setThemeInterfaceId] = useState<string | null>(null)
  const [isSavingTheme, setIsSavingTheme] = useState(false)
  const [renameProjectName, setRenameProjectName] = useState('')
  const [renameProjectError, setRenameProjectError] = useState('')
  const [isRenamingProject, setIsRenamingProject] = useState(false)

  // New project tree state (icon + interfaces fetched in one call)
  const [projectTree, setProjectTree] = useState<Array<{project:string; icon:string; interfaces:string[]; favorite:boolean; position:number|null}>>([]);

  const fetchProjectTree = async () => {
    try {
      const res = await fetch('/api/projects/tree');
      if(res.ok){
        const data = await res.json();
        setProjectTree(data);
        setProjects(data.map((p:any)=>p.project));
      } else {
        const bodyText = await res.text();
        console.error('fetchProjectTree failed', res.status, bodyText);
      }
    } catch(e){ console.error('Failed to fetch project tree', e); }
  };

  useEffect(() => { fetchProjectTree(); }, []);

  // ------------------------------------------------------------
  // Project list refresh watchdog (similar to interface switch)
  // ------------------------------------------------------------
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Abort project refresh if it hangs for >30 s
  const handleProjectRefresh = async () => {
    if (projectsRefreshing) return;
    setProjectsRefreshing(true);

    // Start watchdog timer
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      setProjectsRefreshing(false);
      showErrorToast("Project list refresh timed out.");
    }, 30000); // 30 s timeout

    try {
      await withLoadingToast(
        async () => {
          await fetchProjectTree();
        },
        {
          loading: 'Refreshing project list...',
          success: 'Project list refreshed!',
          error: 'Failed to refresh projects.'
        },
        3000
      );
    } catch (err) {
      console.error("Project refresh failed:", err);
    } finally {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      setProjectsRefreshing(false);
    }
  };

  const projects = useStoreContext((s) => s.projects)

  // Track global (light/dark) theme changes
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient()
  const routerRoot = useRouter()

  /** ------------------------------------------------------------------
   * Navigation-timeout handling
   * When we attempt to switch interface/project we set the global
   * `isSwitchingInterface` flag (handled by parent).  If the backend
   * does not respond within 30 s we:
   *   1. Show an error toast (already done in parent but we double-guard).
   *   2. Revert navigation to the previous URL so late responses can’t
   *      update the UI unexpectedly (“ghost switch”).
   * ------------------------------------------------------------------ */
  const previousUrlRef = useRef<string>(typeof window!== 'undefined' ? window.location.href : '')
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear timeout whenever navigation succeeds (interfaceId changes)
  useEffect(() => {
    if (navTimeoutRef.current) {
      clearTimeout(navTimeoutRef.current)
      navTimeoutRef.current = null
    }
    if (typeof window !== 'undefined') {
      previousUrlRef.current = window.location.href
    }
  }, [interfaceId])

  const setProjects = useStoreContext((s) => s.setProjects)

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
    const result = await createProject(newProjectName, projectActions, projects, newProjectIcon)
    
    if (result.success && result.projectName) {
      // Immediately create a default interface named "Default"
      const existingIfaces: any[] = []
      const ifaceRes = await createInterface(
        'Default',
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
      setNewProjectIcon(undefined)
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
    // Start safety timer BEFORE pushing so we can revert if needed
    navTimeoutRef.current = setTimeout(() => {
      // Timed out – revert navigation & reset state
      showErrorToast('Navigation timed out. Please try again.', 'Failed to load the selected interface.')
      setIsSwitchingInterface(false)
      routerRoot.replace(previousUrlRef.current)
    }, 60000)

    routerRoot.push(url)
  }

  // Debounced updater to limit network calls while dragging around the colour picker
  const debouncedUpdateTheme = useRef(
    debounce(async (color: string) => {
      try {
        await interfaceActions.update({ interface_id: interfaceId, data: { color } });
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
    // Optimistically remove override so default theme colour (light/dark) applies instantly
    setThemeColor('');

    try {
      // Clear custom colour on backend (non-blocking for UI)
      await interfaceActions.update({ interface_id: interfaceId, data: { color: null as any } });
      await queryClient.invalidateQueries({ predicate: (q) => q.queryKey?.[0] === 'interfaces' });
    } catch (err) {
      console.error('Failed to reset theme colour', err);
      // If reset fails, revert to previous colour by refetching
      try {
        const iface = await interfaceActions.get({ interface_id: interfaceId });
        if (iface?.color) setThemeColor(iface.color); else setThemeColor('');
      } catch {}
    }
  };

  // Inline style to override primary/accent only within sidebar scope
  const sidebarStyle = useMemo<CSSProperties>(() => (
    themeColor
      ? ({ '--primary': themeColor, '--accent': themeColor } as CSSProperties)
      : {}
  ), [themeColor]);

  /* ------------------------------------------------------------------
   * Reset theme colour when nothing is selected
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!projectId || !interfaceId) {
      // No override when nothing selected -> follow global theme
      setThemeColor('');
    }
  }, [projectId, interfaceId]);

  /* ------------------------------------------------------------------
   * Sync theme colour with the currently active interface
   * ------------------------------------------------------------------ */
  useEffect(() => {
    const loadInterfaceColor = async () => {
      if (!interfaceId) return;
      try {
        const iface = await interfaceActions.get({ interface_id: interfaceId });
        if (iface && typeof iface.color === 'string' && iface.color.trim() !== '') {
          setThemeColor(iface.color.trim());
        } else {
          // Fallback to default if no colour saved on interface
          setThemeColor(''); // Use default theme colour
        }
      } catch (err) {
        console.error('Failed to fetch interface colour', err);
      }
    };

    loadInterfaceColor();
  }, [interfaceId]);

  // No need to store default css primary in state; picker uses computed value directly.
  // Thus the colour will automatically follow theme changes when no custom override.

  // Helper to fetch the current default --primary from root (light/dark aware)
  const getDefaultPrimary = () => (
    typeof window !== 'undefined'
      ? (getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#2a862a')
      : '#2a862a'
  );

  // Value to feed into ColorPicker component (must be a valid colour string)
  const pickerColor = themeColor && themeColor.trim() !== '' ? themeColor : getDefaultPrimary();

  /* ------------------------------------------------------------------
   * Propagate project theme colour to the global CSS variables
   * ------------------------------------------------------------------ */
  useEffect(() => {
    // Skip on server
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    if (themeColor && themeColor.trim() !== '') {
      root.style.setProperty('--primary', themeColor.trim());
      root.style.setProperty('--accent', themeColor.trim());
    } else {
      // Remove overrides so default palette (or dark/light theme switch) applies
      root.style.removeProperty('--primary');
      root.style.removeProperty('--accent');
    }
  }, [themeColor]);

  /* ------------------------------------------------------------------
   * Visibility of Edit / Interactive controls
   * Hide controls when there is no active project or interface selected
   *   - This occurs on the demo landing page or base /interfaces route
   * ------------------------------------------------------------------ */
  const showModeControls = Boolean(projectId && interfaceId);

  return (
    <TooltipProvider>
      <div data-interface-color style={sidebarStyle} className={cn(
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
                    onSelect={handleProjectRefresh}
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
          isCollapsed ? "overflow-x-hidden" : "opacity-100"
        )}>
          {/* Projects list container */}
          <div className="flex-1 flex flex-col overflow-hidden px-2 pb-4">
            <div className="space-y-1 flex flex-col flex-1 min-h-0">
              {(projectTree.length === 0 || projectsRefreshing) ? (
                <div className={cn("text-muted-foreground py-2", isCollapsed ? "flex justify-center" : "flex items-center gap-2 px-4")}> 
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {!isCollapsed && <span>{projectsRefreshing ? 'Refreshing projects…' : 'Loading projects…'}</span>}
                </div>
               ) : (
                 <>
                   {/* refresh indicator removed; hidden list during refresh */}
                   {/* Favourites pinned */}
                   <div className="space-y-1">
                     {projectTree.filter((p:any)=>p.favorite).length>0 && !isCollapsed && (
                       <div className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-muted-foreground">
                         <Star className="h-3 w-3 text-[color:var(--favourite)]" />
                         <span>Favourites</span>
                       </div>
                     )}
                     {projectTree.filter((p:any)=>p.favorite).map((projItem:any)=>(
                       <ProjectItem key={projItem.project} project={projItem.project} icon={projItem.icon} favourite={true} currentInterfaceId={interfaceId} expandedProjects={expandedProjects} toggleProject={toggleProject} interfaceActions={interfaceActions} tabActions={tabActions} tileActions={tileActions} favouritesActions={favouritesActions} favourites={favourites} queryClient={queryClient} onProjectAction={(proj, action)=>{setActiveProject(proj); if(action==='rename'){setRenameProjectName(proj);} setProjectDialogOpen(action);}} onOpenThemeDialog={(ifaceId,color)=>{setThemeInterfaceId(ifaceId); setThemeColor(color??''); setThemeDialogOpen(true);}} onNavigate={navigateSoft} onRefresh={onRefresh} refreshStatus={refreshStatus} projectsRefreshing={projectsRefreshing} prefetchedInterfaces={projItem.interfaces} isSidebarCollapsed={isCollapsed} onFavouritesUpdate={handleFavouritesUpdate} />
                     ))}
                   </div>

                   {/* separator */}
                   {projectTree.filter((p:any)=>p.favorite).length>0 && projectTree.filter((p:any)=>!p.favorite).length>0 && (
                     <Separator className="my-2" />
                   )}

                   {/* Scrollable other projects */}
                   <div ref={checkScroll as any} className={cn("flex-1 min-h-0 overflow-y-auto overflow-x-hidden command-scrollbar", !isCollapsed && "pr-2")}> 
                     <div className="space-y-1">
                       {projectTree.filter((p:any)=>!p.favorite).map((projItem:any)=>(
                         <ProjectItem key={projItem.project} project={projItem.project} icon={projItem.icon} favourite={false} currentInterfaceId={interfaceId} expandedProjects={expandedProjects} toggleProject={toggleProject} interfaceActions={interfaceActions} tabActions={tabActions} tileActions={tileActions} favouritesActions={favouritesActions} favourites={favourites} queryClient={queryClient} onProjectAction={(proj, action)=>{setActiveProject(proj); if(action==='rename'){setRenameProjectName(proj);} setProjectDialogOpen(action);}} onOpenThemeDialog={(ifaceId,color)=>{setThemeInterfaceId(ifaceId); setThemeColor(color??''); setThemeDialogOpen(true);}} onNavigate={navigateSoft} onRefresh={onRefresh} refreshStatus={refreshStatus} projectsRefreshing={projectsRefreshing} prefetchedInterfaces={projItem.interfaces} isSidebarCollapsed={isCollapsed} onFavouritesUpdate={handleFavouritesUpdate} />
                       ))}
                     </div>
                   </div>
                 </>
               )}
            </div>
            
            {/* Fade effect when scrollable */}
            {hasScroll && !isCollapsed && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[color:var(--background)] to-transparent pointer-events-none" />
            )}
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
                <IconPicker value={newProjectIcon as any} onValueChange={(val)=>setNewProjectIcon(val)} triggerPlaceholder="Select icon" />
              </div>
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
          <div
            className={cn(
              "border-t border-[color:var(--border)] p-2 space-y-2 bg-[color:var(--background)] flex-shrink-0 transform transition-transform duration-300",
              showModeControls ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
            )}
          >
            <div> {/* Wrapper to group Edit and Add Tile */}
              {/* Edit Mode Row */}
              <div className="flex items-center justify-between w-full px-2 py-1 rounded-md">
                <div className="flex items-center gap-2">
                  <Hammer className={cn('h-4 w-4', isEditMode && 'text-primary')} />
                  <span className="text-sm whitespace-nowrap">Edit Mode</span>
                </div>
                <Switch checked={isEditMode} onCheckedChange={onEditModeToggle} />
              </div>
              {/* Add Tile Row - Animated with proper tree branch */}
              <div className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden",
                isEditMode ? "max-h-12" : "max-h-0"
              )}>
                <div className={cn(
                  "transition-opacity duration-300",
                  isEditMode ? "opacity-100" : "opacity-0"
                )}>
                  <div className="relative ml-2 pr-2 cursor-pointer group" onClick={onAddTile}>
                    {/* L-shaped branch - copied from InterfaceItem */}
                    <div className="absolute left-2 top-[18px] w-4 h-px bg-[color:var(--muted)]" />
                    {/* Extend the vertical line through the entire row to connect with subsequent items */}
                    <div className="absolute left-2 top-0 bottom-0 w-px bg-[color:var(--muted)]" />
 
                    {/* Content - styled like InterfaceItem's button */}
                    <div className="pl-6 pr-2 py-2 text-sm rounded-md transition-colors flex items-center gap-1 text-[color:var(--muted-foreground)] group-hover:text-[color:var(--foreground)] group-hover:bg-accent/30">
                      <Plus className="h-4 w-4 text-primary" />
                      <span>Add Tile</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Set Theme Row - mirrors Add Tile styling */}
              <div className={cn(
                'transition-all duration-300 ease-in-out overflow-hidden',
                isEditMode ? 'max-h-12' : 'max-h-0'
              )}>
                <div className={cn('transition-opacity duration-300', isEditMode ? 'opacity-100' : 'opacity-0')}>
                  <ColorPicker value={pickerColor} onChange={handleThemeChange} showReset={true} onReset={handleThemeReset}>
                    <div className="relative ml-2 pr-2 cursor-pointer group">
                      {/* Branch */}
                      <div className="absolute left-2 top-[18px] w-4 h-px bg-[color:var(--muted)]" />
                      <div className="absolute left-2 top-0 h-[19px] w-px bg-[color:var(--muted)]" />
                      {/* Content */}
                      <div className="pl-6 pr-2 py-2 text-sm rounded-md transition-colors flex items-center gap-1 text-[color:var(--muted-foreground)] group-hover:text-[color:var(--foreground)] group-hover:bg-accent/30">
                        <Palette className="h-4 w-4 text-primary" />
                        <span>Set Project Color</span>
                      </div>
                    </div>
                  </ColorPicker>
                </div>
              </div>
            </div>

            {/* Interactive Mode Row */}
            <div className="flex items-center justify-between w-full px-2 py-1 rounded-md hover:bg-accent/30">
              <div className="flex items-center gap-2">
                <SquareMousePointer className={cn('h-4 w-4', isCommandMode && 'text-primary')} />
                <span className="text-sm whitespace-nowrap transition-opacity duration-300">Dashboard Mode</span>
              </div>
              <Switch checked={isCommandMode} onCheckedChange={onCommandModeToggle} />
            </div>
          </div>
        )}

        {/* Collapsed sidebar: icons inline at bottom */}
        {isCollapsed && (
          <div
            className={cn(
              "absolute inset-x-0 bottom-4 flex flex-col items-center pointer-events-auto transform transition-transform duration-300",
              showModeControls ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
            )}
          >
            {/* Divider */}
            <Separator orientation="horizontal" className="w-8 mb-2" />
            {/* Edit Icon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onEditModeToggle}
                  className={cn('h-8 w-8',
                    isEditMode
                      ? 'text-primary hover:text-primary-foreground'
                      : 'text-muted-foreground hover:text-primary-foreground'
                  )}
                >
                  <Hammer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isEditMode ? "Disable Edit Mode" : "Enable Edit Mode"}
              </TooltipContent>
            </Tooltip>
            {/* Add Tile Icon (only visible when edit mode) */}
            <div className={cn(
              "transition-all duration-300 ease-in-out overflow-hidden flex items-center justify-center",
              isEditMode ? "max-h-8 mt-4" : "max-h-0 mt-0 opacity-0"
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={onAddTile} className="h-8 w-8 text-muted-foreground hover:text-primary-foreground" tabIndex={isEditMode ? 0 : -1}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Add Tile</TooltipContent>
              </Tooltip>
            </div>
            {/* Set Theme Icon (visible in edit mode) */}
            <div
              className={cn(
                'transition-all duration-300 ease-in-out overflow-hidden flex items-center justify-center',
                isEditMode ? 'max-h-8 mt-2' : 'max-h-0 mt-0 opacity-0'
              )}
            >
              <ColorPicker value={pickerColor} onChange={handleThemeChange} showReset={true} onReset={handleThemeReset}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ActionButton
                      size="icon"
                      variant="ghost"
                      tooltip="Set Project Color"
                      className="h-8 w-8 text-muted-foreground hover:text-primary-foreground"
                      icon={<Palette className="h-4 w-4" />}
                      disabled={!isEditMode}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right">Set Project Color</TooltipContent>
                </Tooltip>
              </ColorPicker>
            </div>
            {/* Interactive Icon */}
            <div className="mt-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onCommandModeToggle}
                    className={cn('h-8 w-8',
                      isCommandMode
                        ? 'text-primary hover:text-primary-foreground'
                        : 'text-muted-foreground hover:text-primary-foreground'
                    )}
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
      {typeof window!=='undefined' && projectDialogOpen==='delete' && activeProject && createPortal(
        <BaseDialog
          button={null as any}
          open={true}
          setOpen={(open:boolean)=>{ if(!open) setProjectDialogOpen(null)}}
          title={`Delete Project "${activeProject}"`}
          body={<p className="pt-4">Are you sure you want to delete this project? This action cannot be undone.</p>}
          footer={<div className="flex gap-2"><Button variant="outline" onClick={()=>setProjectDialogOpen(null)} disabled={isCreatingProject}>Cancel</Button><Button variant="destructive" onClick={()=>handleConfirmDeleteProject()} disabled={isCreatingProject}>{isCreatingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Delete</Button></div>}
          disableClose={isCreatingProject}
        />, document.body)}
      {typeof window!=='undefined' && projectDialogOpen==='create-interface' && activeProject && createPortal(
        <BaseDialog
          button={null as any}
          open={true}
          setOpen={(o:boolean)=>{ if(!o) setProjectDialogOpen(null)}}
          title={`Create Interface in "${activeProject}"`}
          body={<div className="space-y-2 pt-4"><Label htmlFor="ci-name">Interface Name</Label><Input id="ci-name" value={newInterfaceNameDialog} onChange={e=>{setNewInterfaceNameDialog(e.target.value); setCreateInterfaceError('')}} onKeyDown={e=> e.key==='Enter' && handleConfirmCreateInterface()} autoFocus />{createInterfaceError && <p className="text-xs text-destructive">{createInterfaceError}</p>}</div>}
          footer={<div className="flex gap-2"><Button variant="outline" onClick={()=>setProjectDialogOpen(null)} disabled={isCreatingInterface}>Cancel</Button><Button onClick={handleConfirmCreateInterface} disabled={isCreatingInterface}>{isCreatingInterface && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Create</Button></div>}
          disableClose={isCreatingInterface}
        />, document.body)}
      {typeof window!=='undefined' && projectDialogOpen==='rename' && activeProject && createPortal(
        <BaseDialog
          button={null as any}
          open={true}
          setOpen={(o:boolean)=>{ if(!o) setProjectDialogOpen(null)}}
          title={`Rename Project "${activeProject}"`}
          body={<div className="space-y-2 pt-4"><Label htmlFor="rp-name">New Project Name</Label><Input id="rp-name" value={renameProjectName} onChange={e=>{setRenameProjectName(e.target.value); setRenameProjectError('')}} onKeyDown={e=> e.key==='Enter' && handleConfirmRenameProject()} autoFocus />{renameProjectError && <p className="text-xs text-destructive">{renameProjectError}</p>}</div>}
          footer={<div className="flex gap-2"><Button variant="outline" onClick={()=>setProjectDialogOpen(null)} disabled={isRenamingProject}>Cancel</Button><Button onClick={handleConfirmRenameProject} disabled={isRenamingProject}>{isRenamingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Rename</Button></div>}
          disableClose={isRenamingProject}
        />, document.body)}
    </TooltipProvider>
  )
} 