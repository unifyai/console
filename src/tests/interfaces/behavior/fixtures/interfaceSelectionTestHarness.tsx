/**
 * Interface Selection Test Harness
 *
 * Tests interface selection behaviors (M1-M4):
 * - M1: List interfaces
 * - M2: Switch interface
 * - M3: Create interface
 * - M4: Delete interface
 *
 * Uses the REAL InterfacePicker component from:
 * @/components/Pages/Interfaces/Interface/Nav/InterfacePicker
 *
 * Combined with the real Zustand store for state management.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreApiContext } from '@/contexts/providers/StoreProvider';
import { useStore } from 'zustand';
import { StoreState } from '@/contexts/slices/slice';

// REAL Component Import
import { InterfacePicker, InterfaceItem } from '@/components/Pages/Interfaces/Interface/Nav';

// ============================================================================
// Types
// ============================================================================

interface InterfaceData {
  id: string;
  name: string;
  icon?: string;
  projectId: string;
  tabIds?: string[];
}

export interface InterfaceSelectionTestOptions {
  projectId?: string;
  initialInterfaces?: InterfaceData[];
  activeInterfaceId?: string | null;
}

export interface InterfaceSelectionTestResult {
  container: HTMLElement;
  user: ReturnType<typeof userEvent.setup>;
  // Interface queries (from store)
  getInterfaces: () => string[];
  getActiveInterface: () => string | null;
  getInterfaceById: (id: string) => InterfaceData | null;
  // Interface mutations (via store)
  selectInterface: (interfaceId: string) => Promise<void>;
  createInterface: (name: string) => Promise<void>;
  deleteInterface: (interfaceId: string) => Promise<void>;
  renameInterface: (interfaceId: string, newName: string) => Promise<void>;
  // UI interactions (real component)
  openInterfacePicker: () => Promise<void>;
  closeInterfacePicker: () => Promise<void>;
  isPickerOpen: () => boolean;
  searchInterfaces: (query: string) => Promise<void>;
  getVisibleInterfaces: () => string[];
  clickInterface: (interfaceName: string) => Promise<void>;
  // State checks
  isLoading: () => boolean;
  isEmpty: () => boolean;
  // Delete dialog (mock, since delete is handled outside InterfacePicker)
  clickDeleteButton: (interfaceName: string) => Promise<void>;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => Promise<void>;
  isDeleteDialogOpen: () => boolean;
  // Create dialog (mock, since create is handled outside InterfacePicker)
  clickCreateButton: () => Promise<void>;
  isCreateDialogOpen: () => boolean;
  // Cleanup
  unmount: () => void;
}

// ============================================================================
// Initial State Builder
// ============================================================================

function createInitialStoreState(options: InterfaceSelectionTestOptions): Partial<StoreState> {
  const projectId = options.projectId || 'test-project';
  const interfaces = options.initialInterfaces || [
    { id: 'iface-1', name: 'Main Interface', projectId, tabIds: ['tab-1'] },
    { id: 'iface-2', name: 'Debug Interface', projectId, tabIds: ['tab-2'] },
  ];

  // Build interfacesById
  const interfacesById: Record<string, any> = {};
  interfaces.forEach((iface) => {
    interfacesById[iface.id] = {
      id: iface.id,
      name: iface.name,
      icon: iface.icon,
      projectId: iface.projectId,
      tabIds: iface.tabIds || [],
      tabNames: [],
      activeTabId: (iface.tabIds || [])[0] || null,
    };
  });

  // Build tabsById for interfaces that have tabs
  const tabsById: Record<string, any> = {};
  interfaces.forEach((iface) => {
    (iface.tabIds || []).forEach((tabId) => {
      tabsById[tabId] = {
        id: tabId,
        name: `Tab for ${iface.name}`,
        interfaceId: iface.id,
        tileIds: [],
      };
    });
  });

  return {
    // Project state
    projects: [projectId],
    projectsById: {
      [projectId]: {
        id: projectId,
        name: projectId,
        description: '',
        contexts: [],
        interfaceIds: interfaces.map((i) => i.id),
        activeInterfaceId: options.activeInterfaceId ?? interfaces[0]?.id ?? null,
      },
    },
    activeProjectId: projectId,

    // Interface state
    interfacesById,
    activeInterfaceId: options.activeInterfaceId ?? null,

    // Tab state
    tabsById,
    activeTabId: null,

    // Tile state
    tilesById: {},
  };
}

// ============================================================================
// State Container Interface
// ============================================================================

interface StateContainer {
  getInterfaces: () => string[];
  getActiveInterface: () => string | null;
  getInterfaceById: (id: string) => InterfaceData | null;
  selectInterface: (interfaceId: string) => void;
  createInterface: (name: string) => void;
  deleteInterface: (interfaceId: string) => void;
  renameInterface: (interfaceId: string, newName: string) => void;
}

// ============================================================================
// Inner Component (renders REAL InterfacePicker)
// ============================================================================

interface InterfaceSelectionInnerProps {
  stateContainerRef: React.MutableRefObject<StateContainer | null>;
  projectId: string;
}

function InterfaceSelectionInner({ stateContainerRef, projectId }: InterfaceSelectionInnerProps) {
  const storeApi = useStoreApiContext();
  const store = useStore(storeApi);

  // Local state for UI
  const [isLoading, setIsLoading] = useState(false);
  const [isChangingInterface, setIsChangingInterface] = useState(false);
  const [transitioningToInterface, setTransitioningToInterface] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [interfaceToDelete, setInterfaceToDelete] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newInterfaceName, setNewInterfaceName] = useState('');

  // Get interfaces for current project
  const projectData = store.projectsById?.[projectId];
  const interfaceIds = useMemo(() => projectData?.interfaceIds || [], [projectData?.interfaceIds]);
  const interfacesById = useMemo(() => store.interfacesById || {}, [store.interfacesById]);
  const activeInterfaceId = store.activeInterfaceId;

  // Convert to InterfaceItem format for the picker
  const interfaceItems: InterfaceItem[] = useMemo(() => {
    return interfaceIds
      .map((id) => interfacesById[id])
      .filter(Boolean)
      .map((iface) => ({
        name: iface.name,
        icon: (iface as any).icon,
      }));
  }, [interfaceIds, interfacesById]);

  // Get selected interface
  const selectedInterface = useMemo(() => {
    if (!activeInterfaceId) return null;
    const iface = interfacesById[activeInterfaceId];
    if (!iface) return null;
    return { name: iface.name, icon: (iface as any).icon };
  }, [activeInterfaceId, interfacesById]);

  // Expose state container
  useEffect(() => {
    stateContainerRef.current = {
      getInterfaces: () => {
        const project = store.projectsById?.[projectId];
        return (project?.interfaceIds || [])
          .map((id) => store.interfacesById?.[id]?.name)
          .filter(Boolean);
      },
      getActiveInterface: () => store.activeInterfaceId,
      getInterfaceById: (id) => {
        const iface = store.interfacesById?.[id];
        if (!iface) return null;
        return {
          id: iface.id,
          name: iface.name,
          icon: (iface as any).icon,
          projectId: iface.projectId || '',
          tabIds: iface.tabIds,
        };
      },
      selectInterface: (interfaceId) => {
        store.setActiveInterface(interfaceId);
      },
      createInterface: (name) => {
        const newId = `iface-${Date.now()}`;
        store.initInterface(projectId, newId, { name });
        store.setActiveInterface(newId);
      },
      deleteInterface: (interfaceId) => {
        store.removeInterface(projectId, interfaceId);
      },
      renameInterface: (interfaceId, newName) => {
        store.updateInterface(interfaceId, { name: newName });
      },
    };
    // stateContainerRef is stable and doesn't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, projectId]);

  const handleSelectInterface = async (interfaceName: string) => {
    // Find interface ID by name
    const ifaceId = interfaceIds.find((id) => interfacesById[id]?.name === interfaceName);
    if (!ifaceId) return;

    setIsChangingInterface(true);
    setTransitioningToInterface(interfaceName);
    // Simulate async operation
    await new Promise((r) => setTimeout(r, 50));
    store.setActiveInterface(ifaceId);
    setIsChangingInterface(false);
    setTransitioningToInterface(null);
  };

  const handleCreateInterface = () => {
    if (newInterfaceName.trim()) {
      const newId = `iface-${Date.now()}`;
      store.initInterface(projectId, newId, { name: newInterfaceName.trim() });
      store.setActiveInterface(newId);
      setNewInterfaceName('');
      setCreateDialogOpen(false);
    }
  };

  const handleDeleteInterface = () => {
    if (interfaceToDelete) {
      // Find interface ID by name
      const ifaceId = interfaceIds.find((id) => interfacesById[id]?.name === interfaceToDelete);
      if (ifaceId) {
        store.removeInterface(projectId, ifaceId);
      }
      setInterfaceToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div data-testid="interface-selection-harness">
      {/* Header */}
      <div data-testid="interface-header">
        <h2>Interfaces</h2>
        <p>Project: {projectId}</p>
      </div>

      {/* REAL InterfacePicker Component */}
      <div data-testid="interface-picker-container">
        <InterfacePicker
          interfaces={interfaceItems}
          selectedInterface={selectedInterface}
          isLoading={isLoading}
          isFetching={false}
          transitioningToInterface={transitioningToInterface}
          isChangingInterface={isChangingInterface}
          onSelect={handleSelectInterface}
        />
      </div>

      {/* Action buttons (outside the picker) */}
      <div data-testid="interface-actions">
        <button data-testid="create-interface-button" onClick={() => setCreateDialogOpen(true)}>
          Create Interface
        </button>

        {/* Delete buttons for each interface */}
        {interfaceItems.map((iface) => (
          <button
            key={iface.name}
            data-testid={`interface-delete-${iface.name}`}
            onClick={() => {
              setInterfaceToDelete(iface.name);
              setDeleteDialogOpen(true);
            }}
          >
            Delete {iface.name}
          </button>
        ))}
      </div>

      {/* Create Interface Dialog */}
      {createDialogOpen && (
        <div data-testid="create-interface-dialog" role="dialog">
          <h3>Create New Interface</h3>
          <input
            data-testid="new-interface-name-input"
            type="text"
            placeholder="Interface name"
            value={newInterfaceName}
            onChange={(e) => setNewInterfaceName(e.target.value)}
          />
          <button data-testid="create-interface-submit" onClick={handleCreateInterface}>
            Create
          </button>
          <button
            data-testid="create-interface-cancel"
            onClick={() => {
              setCreateDialogOpen(false);
              setNewInterfaceName('');
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && (
        <div data-testid="delete-interface-dialog" role="alertdialog">
          <h3>Delete Interface</h3>
          <p>Are you sure you want to delete &quot;{interfaceToDelete}&quot;?</p>
          <button data-testid="delete-interface-confirm" onClick={handleDeleteInterface}>
            Delete
          </button>
          <button
            data-testid="delete-interface-cancel"
            onClick={() => {
              setDeleteDialogOpen(false);
              setInterfaceToDelete(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Active Interface Display */}
      {selectedInterface && (
        <div data-testid="active-interface-display">Active: {selectedInterface.name}</div>
      )}

      {/* Test controls */}
      <div data-testid="test-controls" style={{ display: 'none' }}>
        <button data-testid="set-loading" onClick={() => setIsLoading(true)}>
          Set Loading
        </button>
        <button data-testid="clear-loading" onClick={() => setIsLoading(false)}>
          Clear Loading
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Render Function
// ============================================================================

export function renderInterfaceSelection(
  options: InterfaceSelectionTestOptions = {}
): InterfaceSelectionTestResult {
  const stateContainerRef: React.MutableRefObject<StateContainer | null> = { current: null };
  const projectId = options.projectId || 'test-project';
  const user = userEvent.setup();

  const initialState = createInitialStoreState(options);

  const { container, unmount } = render(
    <StoreProvider initialState={initialState}>
      <InterfaceSelectionInner stateContainerRef={stateContainerRef} projectId={projectId} />
    </StoreProvider>
  );

  return {
    container,
    user,

    // Interface queries (from store)
    getInterfaces: () => stateContainerRef.current?.getInterfaces() ?? [],
    getActiveInterface: () => stateContainerRef.current?.getActiveInterface() ?? null,
    getInterfaceById: (id) => stateContainerRef.current?.getInterfaceById(id) ?? null,

    // Interface mutations (via store)
    selectInterface: async (interfaceId) => {
      await act(async () => {
        stateContainerRef.current?.selectInterface(interfaceId);
      });
    },
    createInterface: async (name) => {
      await act(async () => {
        stateContainerRef.current?.createInterface(name);
      });
    },
    deleteInterface: async (interfaceId) => {
      await act(async () => {
        stateContainerRef.current?.deleteInterface(interfaceId);
      });
    },
    renameInterface: async (interfaceId, newName) => {
      await act(async () => {
        stateContainerRef.current?.renameInterface(interfaceId, newName);
      });
    },

    // UI interactions (real component)
    openInterfacePicker: async () => {
      const trigger = screen.getByTestId('interface-picker-trigger');
      await user.click(trigger);
      await waitFor(() => {
        if (!screen.queryByTestId('interface-picker-content')) {
          throw new Error('Interface picker content not found');
        }
      });
    },

    closeInterfacePicker: async () => {
      await user.keyboard('{Escape}');
    },

    isPickerOpen: () => {
      return screen.queryByTestId('interface-picker-content') !== null;
    },

    searchInterfaces: async (query) => {
      // First open the picker if not open
      if (!screen.queryByTestId('interface-picker-content')) {
        const trigger = screen.getByTestId('interface-picker-trigger');
        await user.click(trigger);
        await waitFor(() => {
          if (!screen.queryByTestId('interface-picker-content')) {
            throw new Error('Interface picker content not found');
          }
        });
      }

      const input = screen.getByTestId('interface-search-input');
      await user.clear(input);
      if (query) {
        await user.type(input, query);
      }
    },

    getVisibleInterfaces: () => {
      const content = screen.queryByTestId('interface-picker-content');
      if (!content) return [];

      // Find all interface options
      const options = within(content).queryAllByTestId(/^interface-option-/);
      return options.map((opt) => {
        const testId = opt.getAttribute('data-testid') || '';
        return testId.replace('interface-option-', '');
      });
    },

    clickInterface: async (interfaceName) => {
      // First open the picker if not open
      if (!screen.queryByTestId('interface-picker-content')) {
        const trigger = screen.getByTestId('interface-picker-trigger');
        await user.click(trigger);
        await waitFor(() => {
          if (!screen.queryByTestId('interface-picker-content')) {
            throw new Error('Interface picker content not found');
          }
        });
      }

      const option = screen.getByTestId(`interface-option-${interfaceName}`);
      await user.click(option);
    },

    // State checks
    isLoading: () => {
      return screen.queryByTestId('interface-picker-loading') !== null;
    },

    isEmpty: () => {
      return screen.queryByTestId('interface-picker-empty') !== null;
    },

    // Delete dialog
    clickDeleteButton: async (interfaceName) => {
      const button = screen.getByTestId(`interface-delete-${interfaceName}`);
      await user.click(button);
    },

    confirmDelete: async () => {
      const button = screen.getByTestId('delete-interface-confirm');
      await user.click(button);
    },

    cancelDelete: async () => {
      const button = screen.getByTestId('delete-interface-cancel');
      await user.click(button);
    },

    isDeleteDialogOpen: () => {
      return screen.queryByTestId('delete-interface-dialog') !== null;
    },

    // Create dialog
    clickCreateButton: async () => {
      const button = screen.getByTestId('create-interface-button');
      await user.click(button);
    },

    isCreateDialogOpen: () => {
      return screen.queryByTestId('create-interface-dialog') !== null;
    },

    unmount,
  };
}

// Export types for tests
export type { InterfaceData };
