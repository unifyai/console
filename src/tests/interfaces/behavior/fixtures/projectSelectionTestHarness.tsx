/**
 * Project Selection Test Harness
 *
 * Tests project selection behaviors (L1-L5):
 * - L1: List projects
 * - L2: Select project
 * - L3: Create project
 * - L4: Search projects
 * - L5: Delete project
 *
 * Uses the REAL ProjectPicker component from:
 * @/components/Pages/Interfaces/Interface/Nav/ProjectPicker
 *
 * Combined with the real Zustand store for state management.
 */

import React, { useState, useEffect } from 'react';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreApiContext } from '@/contexts/providers/StoreProvider';
import { useStore } from 'zustand';
import { StoreState } from '@/contexts/slices/slice';

// REAL Component Import
import { ProjectPicker, ProjectItem } from '@/components/Pages/Interfaces/Interface/Nav';

// ============================================================================
// Types
// ============================================================================

interface ProjectData {
  id: string;
  name: string;
  icon?: string;
  interfaceIds?: string[];
}

export interface ProjectSelectionTestOptions {
  initialProjects?: ProjectData[];
  activeProjectId?: string | null;
}

export interface ProjectSelectionTestResult {
  container: HTMLElement;
  user: ReturnType<typeof userEvent.setup>;
  // Project queries (from store)
  getProjects: () => string[];
  getActiveProject: () => string | null;
  getProjectById: (id: string) => ProjectData | null;
  // Project mutations (via store)
  selectProject: (projectId: string) => Promise<void>;
  createProject: (name: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  renameProject: (projectId: string, newName: string) => Promise<void>;
  // UI interactions (real component)
  openProjectPicker: () => Promise<void>;
  closeProjectPicker: () => Promise<void>;
  isPickerOpen: () => boolean;
  searchProjects: (query: string) => Promise<void>;
  getVisibleProjects: () => string[];
  clickProject: (projectName: string) => Promise<void>;
  // State checks
  isLoading: () => boolean;
  isError: () => boolean;
  isEmpty: () => boolean;
  // Delete dialog (mock, since delete is handled outside ProjectPicker)
  clickDeleteButton: (projectName: string) => Promise<void>;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => Promise<void>;
  isDeleteDialogOpen: () => boolean;
  // Create dialog (mock, since create is handled outside ProjectPicker)
  clickCreateButton: () => Promise<void>;
  isCreateDialogOpen: () => boolean;
  // Cleanup
  unmount: () => void;
}

// ============================================================================
// Initial State Builder
// ============================================================================

function createInitialStoreState(options: ProjectSelectionTestOptions): Partial<StoreState> {
  const projects = options.initialProjects || [
    { id: 'project-1', name: 'Project Alpha', interfaceIds: ['iface-1'] },
    { id: 'project-2', name: 'Project Beta', interfaceIds: ['iface-2'] },
    { id: 'project-3', name: 'Project Gamma', interfaceIds: [] },
  ];

  // Build projectsById - use project name as the key (matching real app behavior)
  const projectsById: Record<string, any> = {};
  projects.forEach(p => {
    projectsById[p.name] = {
      id: p.name,
      name: p.name,
      icon: (p as any).icon,
      description: '',
      contexts: [],
      interfaceIds: p.interfaceIds || [],
      activeInterfaceId: (p.interfaceIds || [])[0] || null,
    };
  });

  // Build interfaces for projects that have them
  const interfacesById: Record<string, any> = {};
  projects.forEach(p => {
    (p.interfaceIds || []).forEach(ifaceId => {
      interfacesById[ifaceId] = {
        id: ifaceId,
        name: `Interface for ${p.name}`,
        projectId: p.name,
        tabIds: [],
        tabNames: [],
        activeTabId: null,
      };
    });
  });

  return {
    projects: projects.map(p => p.name),
    projectsById,
    activeProjectId: options.activeProjectId ?? null,
    interfacesById,
    activeInterfaceId: null,
    tabsById: {},
    activeTabId: null,
    tilesById: {},
  };
}

// ============================================================================
// State Container Interface
// ============================================================================

interface StateContainer {
  getProjects: () => string[];
  getActiveProject: () => string | null;
  getProjectById: (id: string) => ProjectData | null;
  selectProject: (projectId: string) => void;
  createProject: (name: string) => void;
  deleteProject: (projectId: string) => void;
  renameProject: (projectId: string, newName: string) => void;
}

// ============================================================================
// Inner Component (renders REAL ProjectPicker)
// ============================================================================

interface ProjectSelectionInnerProps {
  stateContainerRef: React.MutableRefObject<StateContainer | null>;
}

function ProjectSelectionInner({ stateContainerRef }: ProjectSelectionInnerProps) {
  const storeApi = useStoreApiContext();
  const store = useStore(storeApi);
  
  // Local state for UI
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isChangingProject, setIsChangingProject] = useState(false);
  const [transitioningToProject, setTransitioningToProject] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Get projects from store and convert to ProjectItem format
  const projects = store.projects || [];
  const projectsById = store.projectsById || {};
  const activeProjectId = store.activeProjectId;

  const projectItems: ProjectItem[] = projects.map(name => ({
    project: name,
    icon: (projectsById[name] as any)?.icon,
    favorite: (projectsById[name] as any)?.favorite,
  }));

  const selectedProjectIcon = activeProjectId ? (projectsById[activeProjectId] as any)?.icon : undefined;

  // Expose state container
  useEffect(() => {
    stateContainerRef.current = {
      getProjects: () => store.projects || [],
      getActiveProject: () => store.activeProjectId,
      getProjectById: (id) => {
        const p = store.projectsById[id];
        if (!p) return null;
        return { id: p.id || '', name: p.name || '', icon: (p as any).icon, interfaceIds: p.interfaceIds };
      },
      selectProject: (projectId) => {
        store.setActiveProject(projectId);
      },
      createProject: (name) => {
        store.initProject(name, { name, interfaceIds: [] });
      },
      deleteProject: (projectId) => {
        store.removeProject(projectId);
      },
      renameProject: (projectId, newName) => {
        store.updateProject(projectId, { name: newName });
      },
    };
  }, [store]);

  const handleSelectProject = async (projectId: string) => {
    setIsChangingProject(true);
    setTransitioningToProject(projectId);
    // Simulate async operation
    await new Promise(r => setTimeout(r, 50));
    store.setActiveProject(projectId);
    setIsChangingProject(false);
    setTransitioningToProject(null);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 100);
  };

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      store.initProject(newProjectName.trim(), { name: newProjectName.trim(), interfaceIds: [] });
      store.setActiveProject(newProjectName.trim());
      setNewProjectName('');
      setCreateDialogOpen(false);
    }
  };

  const handleDeleteProject = () => {
    if (projectToDelete) {
      store.removeProject(projectToDelete);
      setProjectToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div data-testid="project-selection-harness">
      {/* Header */}
      <div data-testid="project-header">
        <h1>Select a project</h1>
      </div>

      {/* REAL ProjectPicker Component */}
      <div data-testid="project-picker-container">
        <ProjectPicker
          projects={projectItems}
          selectedProject={activeProjectId}
          selectedProjectIcon={selectedProjectIcon}
          isLoading={isLoading}
          isFetching={false}
          isError={isError}
          transitioningToProject={transitioningToProject}
          isChangingProject={isChangingProject}
          onSelect={handleSelectProject}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Action buttons (outside the picker) */}
      <div data-testid="project-actions">
        <button
          data-testid="create-project-button"
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Project
        </button>
        
        {/* Delete buttons for each project */}
        {projects.map(projectName => (
          <button
            key={projectName}
            data-testid={`project-delete-${projectName}`}
            onClick={() => {
              setProjectToDelete(projectName);
              setDeleteDialogOpen(true);
            }}
          >
            Delete {projectName}
          </button>
        ))}
      </div>

      {/* Create Project Dialog */}
      {createDialogOpen && (
        <div data-testid="create-project-dialog" role="dialog">
          <h2>Create New Project</h2>
          <input
            data-testid="new-project-name-input"
            type="text"
            placeholder="Project name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
          <button data-testid="create-project-submit" onClick={handleCreateProject}>
            Create
          </button>
          <button data-testid="create-project-cancel" onClick={() => {
            setCreateDialogOpen(false);
            setNewProjectName('');
          }}>
            Cancel
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && (
        <div data-testid="delete-project-dialog" role="alertdialog">
          <h2>Delete Project</h2>
          <p>Are you sure you want to delete &quot;{projectToDelete}&quot;?</p>
          <button data-testid="delete-project-confirm" onClick={handleDeleteProject}>
            Delete
          </button>
          <button data-testid="delete-project-cancel" onClick={() => {
            setDeleteDialogOpen(false);
            setProjectToDelete(null);
          }}>
            Cancel
          </button>
        </div>
      )}

      {/* Active Project Display */}
      {activeProjectId && (
        <div data-testid="active-project-display">
          Active: {activeProjectId}
        </div>
      )}

      {/* Error/Loading state buttons for testing */}
      <div data-testid="test-controls" style={{ display: 'none' }}>
        <button data-testid="set-loading" onClick={() => setIsLoading(true)}>Set Loading</button>
        <button data-testid="set-error" onClick={() => setIsError(true)}>Set Error</button>
        <button data-testid="clear-states" onClick={() => { setIsLoading(false); setIsError(false); }}>Clear</button>
      </div>
    </div>
  );
}

// ============================================================================
// Render Function
// ============================================================================

export function renderProjectSelection(
  options: ProjectSelectionTestOptions = {}
): ProjectSelectionTestResult {
  const stateContainerRef: React.MutableRefObject<StateContainer | null> = { current: null };
  const user = userEvent.setup();

  const initialState = createInitialStoreState(options);

  const { container, unmount } = render(
    <StoreProvider initialState={initialState}>
      <ProjectSelectionInner stateContainerRef={stateContainerRef} />
    </StoreProvider>
  );

  return {
    container,
    user,

    // Project queries (from store)
    getProjects: () => stateContainerRef.current?.getProjects() ?? [],
    getActiveProject: () => stateContainerRef.current?.getActiveProject() ?? null,
    getProjectById: (id) => stateContainerRef.current?.getProjectById(id) ?? null,

    // Project mutations (via store)
    selectProject: async (projectId) => {
      await act(async () => {
        stateContainerRef.current?.selectProject(projectId);
      });
    },
    createProject: async (name) => {
      await act(async () => {
        stateContainerRef.current?.createProject(name);
      });
    },
    deleteProject: async (projectId) => {
      await act(async () => {
        stateContainerRef.current?.deleteProject(projectId);
      });
    },
    renameProject: async (projectId, newName) => {
      await act(async () => {
        stateContainerRef.current?.renameProject(projectId, newName);
      });
    },

    // UI interactions (real component)
    openProjectPicker: async () => {
      const trigger = screen.getByTestId('project-picker-trigger');
      await user.click(trigger);
      await waitFor(() => {
        if (!screen.queryByTestId('project-picker-content')) {
          throw new Error('Project picker content not found');
        }
      });
    },

    closeProjectPicker: async () => {
      // Press Escape to close
      await user.keyboard('{Escape}');
    },

    isPickerOpen: () => {
      return screen.queryByTestId('project-picker-content') !== null;
    },

    searchProjects: async (query) => {
      // First open the picker if not open
      if (!screen.queryByTestId('project-picker-content')) {
        const trigger = screen.getByTestId('project-picker-trigger');
        await user.click(trigger);
        await waitFor(() => {
          if (!screen.queryByTestId('project-picker-content')) {
            throw new Error('Project picker content not found');
          }
        });
      }
      
      const input = screen.getByTestId('project-search-input');
      await user.clear(input);
      if (query) {
        await user.type(input, query);
      }
    },

    getVisibleProjects: () => {
      const content = screen.queryByTestId('project-picker-content');
      if (!content) return [];
      
      // Find all project options
      const options = within(content).queryAllByTestId(/^project-option-/);
      return options.map(opt => {
        const testId = opt.getAttribute('data-testid') || '';
        return testId.replace('project-option-', '');
      });
    },

    clickProject: async (projectName) => {
      // First open the picker if not open
      if (!screen.queryByTestId('project-picker-content')) {
        const trigger = screen.getByTestId('project-picker-trigger');
        await user.click(trigger);
        await waitFor(() => {
          if (!screen.queryByTestId('project-picker-content')) {
            throw new Error('Project picker content not found');
          }
        });
      }
      
      const option = screen.getByTestId(`project-option-${projectName}`);
      await user.click(option);
    },

    // State checks
    isLoading: () => {
      return screen.queryByTestId('project-picker-loading') !== null;
    },

    isError: () => {
      return screen.queryByTestId('project-picker-error') !== null;
    },

    isEmpty: () => {
      return screen.queryByTestId('project-picker-empty') !== null;
    },

    // Delete dialog
    clickDeleteButton: async (projectName) => {
      const button = screen.getByTestId(`project-delete-${projectName}`);
      await user.click(button);
    },

    confirmDelete: async () => {
      const button = screen.getByTestId('delete-project-confirm');
      await user.click(button);
    },

    cancelDelete: async () => {
      const button = screen.getByTestId('delete-project-cancel');
      await user.click(button);
    },

    isDeleteDialogOpen: () => {
      return screen.queryByTestId('delete-project-dialog') !== null;
    },

    // Create dialog
    clickCreateButton: async () => {
      const button = screen.getByTestId('create-project-button');
      await user.click(button);
    },

    isCreateDialogOpen: () => {
      return screen.queryByTestId('create-project-dialog') !== null;
    },

    unmount,
  };
}

// Export types for tests
export type { ProjectData };
