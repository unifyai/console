'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '@/utils/misc/cn';
import { ChevronsUpDown, Check, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/UI/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/UI/command';
import Tooltip from '@/components/Common/Misc/Tooltip';
import { renderSidebarIcon } from './utils';

// ============================================================================
// Types
// ============================================================================

export interface ProjectItem {
  projectName: string;
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

  // Sort projects with selected/transitioning at top
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const aIsSelected = a.projectName === selectedProject;
      const bIsSelected = b.projectName === selectedProject;
      const aIsTransitioning = a.projectName === transitioningToProject;
      const bIsTransitioning = b.projectName === transitioningToProject;

      // Transitioning item first, then selected, then rest alphabetically
      if (aIsTransitioning && !bIsTransitioning) return -1;
      if (bIsTransitioning && !aIsTransitioning) return 1;
      if (aIsSelected && !bIsSelected) return -1;
      if (bIsSelected && !aIsSelected) return 1;
      return a.projectName.localeCompare(b.projectName);
    });
  }, [projects, selectedProject, transitioningToProject]);

  // Determine what to show in the trigger
  const displayProject = transitioningToProject || selectedProject;
  const displayIcon = transitioningToProject
    ? projects.find((p) => p.projectName === transitioningToProject)?.icon
    : selectedProjectIcon;

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="h-8 min-w-0 flex-1 justify-between"
          data-testid="project-picker-trigger"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            {isChangingProject ? (
              <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" />
            ) : (
              renderSidebarIcon(displayIcon, 'h-3.5 w-3.5 flex-shrink-0', 'project')
            )}
            <span className="text-label truncate">{displayProject || 'Select project'}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] max-w-[20rem] overflow-hidden p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-testid="project-picker-content"
        side="bottom"
        align="start"
        sideOffset={4}
        avoidCollisions={true}
        collisionPadding={{ top: 100, bottom: 100, left: 16, right: 16 }}
      >
        <Command>
          <CommandInput
            placeholder="Search projects..."
            className="text-label"
            data-testid="project-search-input"
          />
          <CommandList className="max-h-[300px] overflow-hidden p-0">
            <ScrollArea className="h-[250px]">
              {!isLoading && !isFetching && (
                <CommandEmpty className="text-label px-2 py-3">No project found.</CommandEmpty>
              )}
              <CommandGroup>
                {isError ? (
                  <div className="p-3 text-center" data-testid="project-picker-error">
                    <p className="text-label text-error mb-2">Failed to load projects</p>
                    <Button size="sm" variant="ghost" onClick={onRefresh} className="text-label">
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Retry
                    </Button>
                  </div>
                ) : isLoading || isFetching ? (
                  <div
                    className="flex flex-col items-center justify-center gap-2 p-4"
                    data-testid="project-picker-loading"
                  >
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <div className="text-caption">Loading projects...</div>
                  </div>
                ) : projects.length === 0 ? (
                  <div className="text-caption p-3 text-center" data-testid="project-picker-empty">
                    <svg
                      className="text-muted-foreground/50 mx-auto mb-2 h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                    No projects found
                  </div>
                ) : (
                  sortedProjects.map((project) => {
                    const isSelected = selectedProject === project.projectName;
                    const isProjectLoading =
                      isChangingProject && transitioningToProject === project.projectName;
                    return (
                      <CommandItem
                        key={project.projectName}
                        value={project.projectName}
                        onSelect={() => handleSelect(project.projectName)}
                        className={cn(
                          'text-label max-w-full overflow-hidden',
                          isSelected && !isProjectLoading && 'bg-accent'
                        )}
                        data-testid={`project-option-${project.projectName}`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {isProjectLoading ? (
                            <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" />
                          ) : isSelected ? (
                            <Check className="h-3.5 w-3.5 flex-shrink-0" />
                          ) : (
                            renderSidebarIcon(project.icon, 'h-3.5 w-3.5 flex-shrink-0', 'project')
                          )}
                          <div className="w-0 min-w-0 flex-1 overflow-hidden">
                            <Tooltip content={project.projectName} side="right">
                              <div className="truncate text-left">{project.projectName}</div>
                            </Tooltip>
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })
                )}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default ProjectPicker;
