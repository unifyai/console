"use client"

import React, { useState } from 'react'
import { cn } from '@/utils/misc/cn'
import { 
  ChevronsUpDown,
  Check,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/UI/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/UI/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/UI/command"
import { renderSidebarIcon } from './utils'

// ============================================================================
// Types
// ============================================================================

export interface ProjectItem {
  project: string;
  icon?: string;
  favorite?: boolean;
}

export interface ProjectPickerProps {
  /** List of available projects */
  projects: ProjectItem[];
  /** Currently selected project ID */
  selectedProject: string | null;
  /** Icon for the selected project (for display in trigger) */
  selectedProjectIcon?: string;
  /** Whether projects are loading */
  isLoading: boolean;
  /** Whether projects are being fetched (refetch) */
  isFetching?: boolean;
  /** Whether there was an error loading projects */
  isError: boolean;
  /** Project currently being transitioned to (shows loading state) */
  transitioningToProject?: string | null;
  /** Whether a project change is in progress */
  isChangingProject?: boolean;
  /** Callback when a project is selected */
  onSelect: (projectId: string) => void;
  /** Callback to refresh the project list */
  onRefresh: () => void;
  /** Whether the popover is controlled externally */
  open?: boolean;
  /** Callback when popover open state changes */
  onOpenChange?: (open: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ProjectPicker({
  projects,
  selectedProject,
  selectedProjectIcon,
  isLoading,
  isFetching = false,
  isError,
  transitioningToProject,
  isChangingProject = false,
  onSelect,
  onRefresh,
  open: controlledOpen,
  onOpenChange,
}: ProjectPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Support both controlled and uncontrolled modes
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const handleSelect = (projectId: string) => {
    onSelect(projectId);
    setOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="flex-1 min-w-0 justify-between h-8 text-body-sm"
          data-testid="project-picker-trigger"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            {renderSidebarIcon(selectedProjectIcon, "h-4 w-4 flex-shrink-0", "project")}
            <span className="truncate">{selectedProject || "Select project"}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] min-w-[12rem] max-w-[20rem] p-0" 
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-testid="project-picker-content"
      >
        <Command>
          <CommandInput placeholder="Search projects..." data-testid="project-search-input" />
          {!isLoading && !isFetching && (
            <CommandEmpty>No project found.</CommandEmpty>
          )}
          <CommandGroup className='max-h-[250px] overflow-y-auto' style={{'scrollbarWidth': 'none'}}>
            {isError ? (
              <div className="p-3 text-center" data-testid="project-picker-error">
                <p className="text-body text-destructive mb-2">Failed to load projects</p>
                <Button size="sm" variant="ghost" onClick={onRefresh}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </div>
            ) : (isLoading || isFetching) ? (
              <div className="p-1" data-testid="project-picker-loading">
                <div className="p-2 text-center text-caption text-muted-foreground mb-1">Loading projects...</div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-sm">
                    <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                    <div className="flex-1 h-4 bg-muted animate-pulse rounded" style={{ width: `${70 + i * 10}%` }} />
                  </div>
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="p-3 text-center text-body text-muted-foreground" data-testid="project-picker-empty">
                <svg className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                No projects found
              </div>
            ) : (
              projects.map((project) => {
                const isSelected = selectedProject === project.project;
                const isProjectLoading = isChangingProject && transitioningToProject === project.project;
                return (
                  <CommandItem
                    key={project.project}
                    value={project.project}
                    onSelect={() => handleSelect(project.project)}
                    className={cn("text-body-sm", isSelected && !isProjectLoading && "text-primary")}
                    data-testid={`project-option-${project.project}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 w-full">
                      {isProjectLoading ? (
                        renderSidebarIcon(project.icon, "h-4 w-4 flex-shrink-0", "project")
                      ) : isSelected ? (
                        <Check className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        renderSidebarIcon(project.icon, "h-4 w-4 flex-shrink-0", "project")
                      )}
                      <span className="truncate flex-1">{project.project}</span>
                      {isProjectLoading && (
                        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                      )}
                    </div>
                  </CommandItem>
                );
              })
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default ProjectPicker;

