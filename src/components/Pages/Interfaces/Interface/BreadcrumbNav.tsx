"use client"

import React, { useState } from 'react'
import { 
  MoreHorizontal, 
  Check, 
  Loader2,
  Plus,
  Edit3,
  Trash2,
  Settings,
  Palette,
  Star,
  RefreshCw,
  Save,
  Download,
  Upload,
  FileInput
} from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from '@/components/UI/breadcrumb'
import { Button } from '@/components/UI/button'
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from '@/components/UI/dropdown-menu'
import { 
  Popover, 
  PopoverTrigger, 
  PopoverContent 
} from '@/components/UI/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/UI/command"
import { cn } from '@/utils/misc/cn'
import { Icon } from '@/components/UI/icon-picker'
import ColorPicker from '@/components/Common/Misc/ColorPicker'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/UI/tooltip'

interface BreadcrumbItemData {
  id: string
  name: string
  icon?: string
}

interface BreadcrumbNavItemProps {
  icon?: string | null
  label: string
  placeholder?: string
  isLoading?: boolean
  items: BreadcrumbItemData[]
  selectedValue?: string | null
  onSelect: (value: string) => void
  type: 'project' | 'interface'
  disabled?: boolean
  error?: boolean
  onRetry?: () => void
  className?: string
  renderActions?: () => React.ReactNode
  onDoubleClickName?: () => void
  onDoubleClickIcon?: () => void
  isCompact?: boolean
}

// Helper to render emoji vs lucide icon
function renderIcon(iconStr: string | undefined | null, className: string, type: 'project' | 'interface' = 'project') {
  const defaultIcons: Record<string, string> = {
    project: 'folder',
    interface: 'layout-grid',
  }
  
  const defaultIcon = defaultIcons[type]
  
  let icon = iconStr
  if (!icon || typeof icon !== 'string' || icon.trim() === '' || 
      icon === 'null' || icon === 'undefined' || icon === 'none') {
    icon = defaultIcon
  } else {
    icon = icon.trim()
  }
  
  // Check if it's an emoji or special character
  if (/[^a-zA-Z0-9_-]/.test(icon)) {
    return <span className={cn(className, "inline-flex items-center justify-center text-xs")}>{icon}</span>
  }
  
  return <Icon name={icon as any} className={className} />
}

function BreadcrumbNavItem({
  icon,
  label,
  placeholder,
  isLoading,
  items,
  selectedValue,
  onSelect,
  type,
  disabled,
  error,
  onRetry,
  className,
  renderActions,
  onDoubleClickName,
  onDoubleClickIcon,
  isCompact
}: BreadcrumbNavItemProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  
  const handleSelect = (value: string) => {
    onSelect(value)
    setPopoverOpen(false)
  }
  
  return (
    <BreadcrumbItem className={cn("min-w-0 flex items-center", isCompact && "flex-shrink-0", className)}>
      <div className="flex items-center group min-w-0 relative transition-all duration-200">
        <div className={cn(
          "flex items-center transition-all duration-200 min-w-0",
          disabled && "opacity-50 cursor-not-allowed"
        )}>
          {/* Main navigation area */}
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            {isCompact ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button 
                      className={cn(
                        "p-1 flex items-center justify-center hover:bg-accent/20 rounded transition-colors min-w-0",
                        disabled && "pointer-events-none"
                      )}
                      disabled={disabled}
                    >
                      <div
                        className="flex-shrink-0 cursor-pointer hover:opacity-70 transition-opacity"
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          if (onDoubleClickIcon && !disabled) {
                            onDoubleClickIcon()
                          }
                        }}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : error ? (
                          <span className="text-destructive text-xs">!</span>
                        ) : (
                          renderIcon(icon, "h-4 w-4", type)
                        )}
                      </div>
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <div>
                    <div className="font-medium">{label || placeholder || `Select ${type}`}</div>
                    {onDoubleClickIcon && <div className="text-muted-foreground mt-0.5">Double-click icon to change</div>}
                    {onDoubleClickName && <div className="text-muted-foreground">Click to select</div>}
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <PopoverTrigger asChild>
                <button 
                  className={cn(
                    "px-1.5 py-0.5 flex items-center gap-1 hover:bg-accent/30 rounded transition-colors text-xs min-w-0",
                    disabled && "pointer-events-none"
                  )}
                  disabled={disabled}
                >
                  <div
                    className="flex-shrink-0 cursor-pointer hover:opacity-70 transition-opacity"
                    title={onDoubleClickIcon ? "Double-click to change icon" : undefined}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      if (onDoubleClickIcon && !disabled) {
                        onDoubleClickIcon()
                      }
                    }}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : error ? (
                      <span className="text-destructive text-xs">Error</span>
                    ) : (
                      renderIcon(icon, "h-3.5 w-3.5", type)
                    )}
                  </div>
                  <span 
                    className="truncate font-medium block cursor-pointer hover:underline underline-offset-2 overflow-hidden"
                    title={onDoubleClickName ? "Double-click to rename" : undefined}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      if (onDoubleClickName && !disabled) {
                        onDoubleClickName()
                      }
                    }}
                  >
                    {label || placeholder || `Select ${type}`}
                  </span>
                </button>
              </PopoverTrigger>
            )}
            <PopoverContent className="w-[250px] p-0" align="start">
              <Command>
                <CommandInput placeholder={`Search ${type}s...`} />
                {items.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {error ? (
                      <div className="space-y-2">
                        <p className="text-destructive">Failed to load {type}s</p>
                        {onRetry && (
                          <Button size="sm" variant="ghost" onClick={onRetry}>
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        )}
                      </div>
                    ) : (
                      `No ${type}s found`
                    )}
                  </div>
                ) : (
                  <>
                    <CommandEmpty>No {type} found.</CommandEmpty>
                    <CommandGroup>
                      {items.map((item) => {
                        const isSelected = selectedValue === item.name
                        return (
                          <CommandItem
                            key={item.id}
                            value={item.name}
                            onSelect={() => handleSelect(item.name)}
                            className={cn(isSelected && "text-primary")}
                          >
                            <div className="flex items-center gap-2 w-full">
                              {isSelected ? (
                                <Check className="h-3.5 w-3.5 flex-shrink-0" />
                              ) : (
                                renderIcon(item.icon, "h-3.5 w-3.5 flex-shrink-0", type)
                              )}
                              <span className="truncate text-xs">{item.name}</span>
                            </div>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </>
                )}
              </Command>
            </PopoverContent>
          </Popover>
          
          {/* Actions dropdown - slides in on hover */}
          {renderActions && (
            <div className={cn(
              "overflow-hidden transition-all duration-200 ease-out",
              actionsOpen ? "w-6 ml-0.5" : "w-0 group-hover:w-6 group-hover:ml-0.5"
            )}>
              <DropdownMenu open={actionsOpen} onOpenChange={setActionsOpen}>
                <DropdownMenuTrigger asChild>
                  <button 
                    className={cn(
                      "h-5 w-5 flex items-center justify-center hover:bg-accent/50 rounded transition-all duration-200 delay-75 cursor-pointer",
                      actionsOpen ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100",
                      disabled && "pointer-events-none"
                    )}
                    disabled={disabled}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-w-[200px] text-xs p-1">
                  {renderActions()}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </BreadcrumbItem>
  )
}

interface BreadcrumbNavProps {
  // Project props
  selectedProject: string
  projectTree: Array<{
    project: string
    icon: string
    interfaces: BreadcrumbItemData[]
    favorite: boolean
    position: number | null
  }>
  projectTreeLoading?: boolean
  projectTreeError?: boolean
  onProjectChange: (project: string) => void
  onProjectRefresh?: () => void
  
  // Interface props
  selectedInterface?: string | null
  currentInterfaces: BreadcrumbItemData[]
  interfacesLoading?: boolean
  interfacesError?: boolean
  onInterfaceChange: (interfaceName: string) => void
  
  // Action handlers
  onCreateProject?: () => void
  onRenameProject?: () => void
  onDeleteProject?: () => void
  onChangeProjectIcon?: () => void
  onImportInterface?: () => void
  onUploadLogs?: () => void
  onToggleFavorite?: () => void
  onRefreshAll?: () => void
  
  onSaveInterface?: () => void
  onSaveAsNewInterface?: () => void
  onCreateInterface?: () => void
  onRenameInterface?: () => void
  onDeleteInterface?: () => void
  onChangeInterfaceIcon?: () => void
  onExportInterface?: () => void
  
  // Theme
  themeColor?: string
  onThemeChange?: (color: string) => void
  onThemeReset?: () => void
  
  // State
  isProjectChanging?: boolean
  isInterfaceChanging?: boolean
  projectsRefreshing?: boolean
  
  className?: string
  isCompact?: boolean // Add this prop to control icon-only mode
}

export function BreadcrumbNav({
  selectedProject,
  projectTree,
  projectTreeLoading,
  projectTreeError,
  onProjectChange,
  onProjectRefresh,
  
  selectedInterface,
  currentInterfaces,
  interfacesLoading,
  interfacesError,
  onInterfaceChange,
  
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onChangeProjectIcon,
  onImportInterface,
  onUploadLogs,
  onToggleFavorite,
  onRefreshAll,
  
  onSaveInterface,
  onSaveAsNewInterface,
  onCreateInterface,
  onRenameInterface,
  onDeleteInterface,
  onChangeInterfaceIcon,
  onExportInterface,
  
  themeColor,
  onThemeChange,
  onThemeReset,
  
  isProjectChanging,
  isInterfaceChanging,
  projectsRefreshing,
  
  className,
  isCompact
}: BreadcrumbNavProps) {
  const currentProjectData = projectTree.find(p => p.project === selectedProject)
  const currentInterface = currentInterfaces.find(i => i.name === selectedInterface)
  const pickerColor = themeColor || '#2a862a'
  
  return (
    <TooltipProvider>
      <div className={cn("w-full", className)}>
        <Breadcrumb>
        <BreadcrumbList className={cn("flex-nowrap items-center", isCompact ? "gap-1.5" : "gap-0.5")}>
          {/* Project Breadcrumb */}
          <BreadcrumbNavItem
            icon={currentProjectData?.icon}
            label={selectedProject}
            placeholder="Select project"
            isLoading={projectTreeLoading || isProjectChanging}
            error={projectTreeError}
            onRetry={onProjectRefresh}
            items={projectTree.map(p => ({
              id: p.project,
              name: p.project,
              icon: p.icon
            }))}
            selectedValue={selectedProject}
            onSelect={onProjectChange}
            type="project"
            onDoubleClickName={onRenameProject}
            onDoubleClickIcon={onChangeProjectIcon}
            isCompact={isCompact}
            renderActions={() => (
              <>
                <DropdownMenuItem onSelect={onCreateProject}>
                  <Plus className="h-3.5 w-3.5 mr-2" />
                  Create Project
                </DropdownMenuItem>
                <DropdownMenuItem 
                  disabled={!selectedProject}
                  onSelect={onCreateInterface}
                >
                  <Plus className="h-3.5 w-3.5 mr-2" />
                  Create Interface
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  disabled={!selectedProject}
                  onSelect={onRenameProject}
                >
                  <Edit3 className="h-3.5 w-3.5 mr-2" />
                  Rename Project
                </DropdownMenuItem>
                <DropdownMenuItem 
                  disabled={!selectedProject}
                  onSelect={onChangeProjectIcon}
                >
                  <Settings className="h-3.5 w-3.5 mr-2" />
                  Change Icon
                </DropdownMenuItem>
                {selectedInterface && onThemeChange && (
                  <ColorPicker 
                    value={pickerColor} 
                    onChange={onThemeChange} 
                    useDialog={true} 
                    showReset={true} 
                    onReset={onThemeReset}
                  >
                    <DropdownMenuItem>
                      <Palette className="h-3.5 w-3.5 mr-2" />
                      Set Project Color
                    </DropdownMenuItem>
                  </ColorPicker>
                )}
                <DropdownMenuItem 
                  disabled={!selectedProject}
                  onSelect={onImportInterface}
                >
                  <Upload className="h-3.5 w-3.5 mr-2" />
                  Import Interface
                </DropdownMenuItem>
                {selectedProject !== 'Usage' && (
                  <DropdownMenuItem 
                    disabled={!selectedProject}
                    onSelect={onUploadLogs}
                  >
                    <FileInput className="h-3.5 w-3.5 mr-2" />
                    Upload Logs
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  disabled={!selectedProject}
                  onSelect={onToggleFavorite}
                >
                  <Star className={cn(
                    "h-3.5 w-3.5 mr-2", 
                    currentProjectData?.favorite && "fill-current"
                  )} />
                  {currentProjectData?.favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onRefreshAll}>
                  <RefreshCw className={cn(
                    "h-3.5 w-3.5 mr-2", 
                    projectsRefreshing && "animate-spin"
                  )} />
                  {projectsRefreshing ? 'Refreshing...' : 'Refresh All'}
                </DropdownMenuItem>
                {selectedProject !== 'Usage' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      disabled={!selectedProject}
                      onSelect={onDeleteProject}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete Project
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
          />
          
          {/* Interface Breadcrumb */}
          {selectedProject && currentInterfaces.length > 0 && (
            <>
              <BreadcrumbSeparator className="flex-shrink-0 [&>svg]:size-3 opacity-50" />
              <BreadcrumbNavItem
                icon={currentInterface?.icon}
                label={currentInterface?.name || ''}
                placeholder="Select interface"
                isLoading={interfacesLoading || isInterfaceChanging}
                error={interfacesError}
                items={currentInterfaces}
                selectedValue={selectedInterface}
                onSelect={onInterfaceChange}
                type="interface"
                onDoubleClickName={onRenameInterface}
                onDoubleClickIcon={onChangeInterfaceIcon}
                isCompact={isCompact}
                renderActions={() => (
                  <>
                    <DropdownMenuItem 
                      disabled={!currentInterface}
                      onSelect={onSaveInterface}
                    >
                      <Save className="h-3.5 w-3.5 mr-2" />
                      Save Interface
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      disabled={!currentInterface}
                      onSelect={onSaveAsNewInterface}
                    >
                      <div className="h-3.5 w-3.5 mr-2 relative">
                        <Save className="h-3.5 w-3.5" />
                        <Plus className="h-2 w-2 absolute -top-1 -right-1 rounded-full bg-background text-foreground" />
                      </div>
                      Save as New
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      disabled={!selectedProject}
                      onSelect={onCreateInterface}
                    >
                      <Plus className="h-3.5 w-3.5 mr-2" />
                      Create Interface
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      disabled={!currentInterface}
                      onSelect={onRenameInterface}
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-2" />
                      Rename Interface
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      disabled={!currentInterface}
                      onSelect={onChangeInterfaceIcon}
                    >
                      <Settings className="h-3.5 w-3.5 mr-2" />
                      Change Icon
                    </DropdownMenuItem>
                    {selectedInterface && onThemeChange && (
                      <ColorPicker 
                        value={pickerColor} 
                        onChange={onThemeChange} 
                        useDialog={true} 
                        showReset={true} 
                        onReset={onThemeReset}
                      >
                        <DropdownMenuItem>
                          <Palette className="h-3.5 w-3.5 mr-2" />
                          Set Interface Color
                        </DropdownMenuItem>
                      </ColorPicker>
                    )}
                    <DropdownMenuItem 
                      disabled={!currentInterface}
                      onSelect={onExportInterface}
                    >
                      <Download className="h-3.5 w-3.5 mr-2" />
                      Export as Template
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      disabled={!currentInterface}
                      onSelect={onDeleteInterface}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete Interface
                    </DropdownMenuItem>
                  </>
                )}
              />
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
    </TooltipProvider>
  )
} 

// Add this component for collapsed mode
interface CollapsedBreadcrumbNavProps {
  selectedProject: string
  selectedInterface?: string | null
  currentProjectData?: { icon: string } | null
  currentInterface?: { icon: string } | null
  // Project selection
  projects: Array<{ id: string; name: string; icon?: string }>
  projectsLoading?: boolean
  projectsError?: boolean
  onProjectSelect: (projectName: string) => void
  onProjectRetry?: () => void
  // Interface selection
  interfaces: Array<{ id: string; name: string; icon?: string }>
  interfacesLoading?: boolean
  interfacesError?: boolean
  onInterfaceSelect: (interfaceName: string) => void
  onInterfaceRetry?: () => void
  onProjectDoubleClickIcon?: () => void
  onInterfaceDoubleClickIcon?: () => void
  className?: string
}

export function CollapsedBreadcrumbNav({
  selectedProject,
  selectedInterface,
  currentProjectData,
  currentInterface,
  projects,
  projectsLoading,
  projectsError,
  onProjectSelect,
  onProjectRetry,
  interfaces,
  interfacesLoading,
  interfacesError,
  onInterfaceSelect,
  onInterfaceRetry,
  onProjectDoubleClickIcon,
  onInterfaceDoubleClickIcon,
  className
}: CollapsedBreadcrumbNavProps) {
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false)
  const [interfacePopoverOpen, setInterfacePopoverOpen] = useState(false)
  
  const handleProjectSelect = (projectName: string) => {
    onProjectSelect(projectName)
    setProjectPopoverOpen(false)
  }
  
  const handleInterfaceSelect = (interfaceName: string) => {
    onInterfaceSelect(interfaceName)
    setInterfacePopoverOpen(false)
  }
  
  return (
    <div className={cn("p-1 space-y-1", className)}>
      {/* Project Icon */}
      <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            onDoubleClick={(e) => {
              e.stopPropagation()
              if (onProjectDoubleClickIcon) {
                onProjectDoubleClickIcon()
              }
            }}
            className="h-7 w-7 w-full"
          >
            {renderIcon(currentProjectData?.icon, "h-3.5 w-3.5", "project")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0" side="right" align="start">
          <Command>
            <CommandInput placeholder="Search projects..." />
            {!projects || projects.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {projectsError ? (
                  <div className="space-y-2">
                    <p className="text-destructive">Failed to load projects</p>
                    {onProjectRetry && (
                      <Button size="sm" variant="ghost" onClick={onProjectRetry}>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Retry
                      </Button>
                    )}
                  </div>
                ) : (
                  "No projects found"
                )}
              </div>
            ) : (
              <>
                <CommandEmpty>No project found.</CommandEmpty>
                <CommandGroup>
                  {projects.map((item) => {
                    const isSelected = selectedProject === item.name
                    return (
                      <CommandItem
                        key={item.id}
                        value={item.name}
                        onSelect={() => handleProjectSelect(item.name)}
                        className={cn(isSelected && "text-primary")}
                      >
                        <div className="flex items-center gap-2 w-full">
                          {isSelected ? (
                            <Check className="h-3.5 w-3.5 flex-shrink-0" />
                          ) : (
                            <div className="h-3.5 w-3.5 flex-shrink-0" />
                          )}
                          {renderIcon(item.icon, "h-3.5 w-3.5 flex-shrink-0", "project")}
                          <span className="truncate flex-1">{item.name}</span>
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      
      {/* Interface Icon */}
      {selectedProject && (
        <Popover open={interfacePopoverOpen} onOpenChange={setInterfacePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (onInterfaceDoubleClickIcon) {
                  onInterfaceDoubleClickIcon()
                }
              }}
              className="h-7 w-7 w-full"
            >
              {renderIcon(currentInterface?.icon, "h-3.5 w-3.5", "interface")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" side="right" align="start">
            <Command>
              <CommandInput placeholder="Search interfaces..." />
              {!interfaces || interfaces.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {interfacesError ? (
                    <div className="space-y-2">
                      <p className="text-destructive">Failed to load interfaces</p>
                      {onInterfaceRetry && (
                        <Button size="sm" variant="ghost" onClick={onInterfaceRetry}>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
                    </div>
                  ) : (
                    "No interfaces found"
                  )}
                </div>
              ) : (
                <>
                  <CommandEmpty>No interface found.</CommandEmpty>
                  <CommandGroup>
                    {interfaces.map((item) => {
                      const isSelected = selectedInterface === item.name
                      return (
                        <CommandItem
                          key={item.id}
                          value={item.name}
                          onSelect={() => handleInterfaceSelect(item.name)}
                          className={cn(isSelected && "text-primary")}
                        >
                          <div className="flex items-center gap-2 w-full">
                            {isSelected ? (
                              <Check className="h-3.5 w-3.5 flex-shrink-0" />
                            ) : (
                              <div className="h-3.5 w-3.5 flex-shrink-0" />
                            )}
                            {renderIcon(item.icon, "h-3.5 w-3.5 flex-shrink-0", "interface")}
                            <span className="truncate flex-1">{item.name}</span>
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </>
              )}
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
} 