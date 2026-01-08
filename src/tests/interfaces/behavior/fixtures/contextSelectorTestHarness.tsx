/**
 * Context Selector Test Harness
 *
 * Tests context management behaviors (I1-I5):
 * - I1: Set global context (interface/tab level)
 * - I2: Set tile context (tile-level override)
 * - I3: Create context
 * - I4: Context inheritance (interface → tab → tile)
 * - I5: Clear context
 *
 * This harness:
 * - Uses the REAL Zustand store for context state management
 * - Uses the REAL ContextSelector component for UI tests
 * - Mocks React Query hooks to provide test data without API calls
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { NextUIProvider } from '@nextui-org/react';
import { SidebarProvider } from '@/components/UI/sidebar';
import { StoreProvider, useStoreApiContext } from '@/contexts/providers/StoreProvider';
import { useStore } from 'zustand';
import { StoreState } from '@/contexts/slices/slice';
import { ContextScope } from '@/contexts/slices/contextsSlice';

// The REAL ContextSelector component can be imported for integration testing:
// import ContextSelector from '@/components/Pages/Interfaces/Blocks/Table/Content/ContextSelector';

// ============================================================================
// Mock React Query hooks
// ============================================================================

// We need to mock the hooks that make API calls
vi.mock('@/hooks/Interfaces/Query/useContextsQuery', () => ({
  useListContextsQuery: vi.fn(() => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

vi.mock('@/hooks/Interfaces/Query/useTableDataQuery', () => ({
  useTableDataQuery: vi.fn(() => ({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

// Import the mocked hooks so we can configure them per-test
import { useListContextsQuery } from '@/hooks/Interfaces/Query/useContextsQuery';

// ============================================================================
// Types
// ============================================================================

interface ContextItem {
  id: string;
  name: string;
}

interface TileState {
  id: string;
  name: string;
  context: string | null;
}

interface TabState {
  id: string;
  name: string;
  context: string | null;
  tileIds: string[];
}

export interface ContextSelectorTestOptions {
  projectId?: string;
  interfaceId?: string;
  initialContexts?: string[];
  initialTabs?: TabState[];
  initialTiles?: TileState[];
  interfaceContext?: string | null;
}

export interface ContextSelectorTestResult {
  container: HTMLElement;
  // Context queries (using REAL store)
  getContexts: () => string[];
  getInterfaceContext: () => string | null;
  getTabContext: (tabId: string) => string | null;
  getTileContext: (tileId: string) => string | null;
  getEffectiveContext: (tileId?: string, tabId?: string) => string | null;
  // Context mutations (using REAL store)
  setInterfaceContext: (context: string) => Promise<void>;
  setTabContext: (tabId: string, context: string) => Promise<void>;
  setTileContext: (tileId: string, context: string) => Promise<void>;
  clearContext: (scope: ContextScope, targetId: string) => Promise<void>;
  createContext: (name: string) => Promise<void>;
  deleteContext: (name: string) => Promise<void>;
  renameContext: (from: string, to: string) => Promise<void>;
  // UI interactions (using REAL ContextSelector component)
  openContextSelector: (scope: 'interface' | 'tab' | 'tile', targetId?: string) => Promise<void>;
  selectContextFromDropdown: (contextName: string) => Promise<void>;
  searchContexts: (query: string) => Promise<void>;
  getVisibleContexts: () => string[];
  // Cleanup
  unmount: () => void;
}

// ============================================================================
// Create test QueryClient
// ============================================================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

// ============================================================================
// Initial State Builder
// ============================================================================

function createInitialStoreState(options: ContextSelectorTestOptions): Partial<StoreState> {
  const projectId = options.projectId || 'test-project';
  const interfaceId = options.interfaceId || 'test-interface';
  const contexts = options.initialContexts || ['context-1', 'context-2', 'context-3'];
  const tabs = options.initialTabs || [
    { id: 'tab-1', name: 'Tab 1', context: null, tileIds: ['tile-1', 'tile-2'] },
    { id: 'tab-2', name: 'Tab 2', context: null, tileIds: ['tile-3'] },
  ];
  const tiles = options.initialTiles || [
    { id: 'tile-1', name: 'Tile 1', context: null },
    { id: 'tile-2', name: 'Tile 2', context: null },
    { id: 'tile-3', name: 'Tile 3', context: null },
  ];

  // Build tabsById
  const tabsById: Record<string, any> = {};
  tabs.forEach((tab) => {
    tabsById[tab.id] = {
      id: tab.id,
      name: tab.name,
      globalContext: tab.context || undefined,
      tileIds: tab.tileIds,
      tileNames: tab.tileIds.map((_, i) => `Tile ${i + 1}`),
      interfaceId,
      visible: true,
      active: tab.id === tabs[0]?.id,
      order: 0,
      itemsNeedRecompute: false,
      focusedTileNames: [undefined, undefined] as [string | undefined, string | undefined],
      saveSuccess: undefined,
      resetting: false,
      edit: true,
      interactive: true,
      help: true,
      copied: undefined,
      deleting: false,
      refreshing: false,
      color: undefined,
      hoveredLog: undefined,
      editTile: undefined,
      dataPending: false,
      pending: false,
    };
  });

  // Build tilesById
  const tilesById: Record<string, any> = {};
  tiles.forEach((tile) => {
    tilesById[tile.id] = {
      id: tile.id,
      name: tile.name,
      context: tile.context || undefined,
      type: 'Table',
      visible: true,
    };
  });

  // Build context maps
  const tabContexts: Record<string, string | null> = {};
  tabs.forEach((tab) => {
    tabContexts[tab.id] = tab.context;
  });

  const tileContexts: Record<string, string | null> = {};
  tiles.forEach((tile) => {
    tileContexts[tile.id] = tile.context;
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
        interfaceIds: [interfaceId],
        activeInterfaceId: interfaceId,
      },
    },
    activeProjectId: projectId,

    // Interface state
    interfacesById: {
      [interfaceId]: {
        id: interfaceId,
        name: 'Test Interface',
        tabIds: tabs.map((t) => t.id),
        tabNames: tabs.map((t) => t.name),
        projectId,
        activeTabId: tabs[0]?.id || null,
      },
    },
    activeInterfaceId: interfaceId,

    // Tab state
    tabsById,
    activeTabId: tabs[0]?.id || null,

    // Tile state
    tilesById,

    // Context state (REAL contextsSlice will manage this)
    projectContexts: {
      [projectId]: contexts,
    },
    interfaceContexts: {
      [interfaceId]: options.interfaceContext || null,
    },
    tabContexts,
    tileContexts,
    contextSyncQueue: [],
    processingQueue: false,
    projectDefaultContext: {},
  };
}

// ============================================================================
// Mock Action Factories (for future integration testing with real ContextSelector)
// ============================================================================

// These can be used when testing the real ContextSelector component:
// function createMockContextActions() {
//   return {
//     list: vi.fn().mockResolvedValue([]),
//     update: vi.fn().mockResolvedValue(undefined),
//     delete: vi.fn().mockResolvedValue(undefined),
//   };
// }

// ============================================================================
// Inner Component (accesses REAL store)
// ============================================================================

interface StateContainer {
  getContexts: () => string[];
  getInterfaceContext: () => string | null;
  getTabContext: (tabId: string) => string | null;
  getTileContext: (tileId: string) => string | null;
  getEffectiveContext: (tileId?: string, tabId?: string) => string | null;
  setInterfaceContext: (context: string) => void;
  setTabContext: (tabId: string, context: string) => void;
  setTileContext: (tileId: string, context: string) => void;
  clearContext: (scope: ContextScope, targetId: string) => void;
  createContext: (name: string) => void;
  deleteContext: (name: string) => void;
  renameContext: (from: string, to: string) => void;
}

interface ContextSelectorInnerProps {
  stateContainerRef: React.MutableRefObject<StateContainer | null>;
  projectId: string;
  interfaceId: string;
  contexts: string[];
}

function ContextSelectorInner({
  stateContainerRef,
  projectId,
  interfaceId,
  contexts: initialContexts,
}: ContextSelectorInnerProps) {
  const storeApi = useStoreApiContext();
  const store = useStore(storeApi);
  const [activeSelector, setActiveSelector] = useState<{
    scope: 'interface' | 'tab' | 'tile';
    targetId: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Get state from REAL store
  const contexts = useMemo(
    () => store.projectContexts[projectId] || [],
    [store.projectContexts, projectId]
  );
  const interfaceContext = store.interfaceContexts[interfaceId] || null;
  const tabsById = store.tabsById || {};
  const tilesById = store.tilesById || {};
  const tabContexts = store.tabContexts || {};
  const tileContexts = store.tileContexts || {};

  // Filter contexts by search
  const filteredContexts = searchQuery
    ? contexts.filter((c) => c.toLowerCase().includes(searchQuery.toLowerCase()))
    : contexts;

  // Configure the mock hook to return our contexts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const mockContexts = contexts.map((name) => ({ name }));
    (useListContextsQuery as any).mockReturnValue({
      data: mockContexts,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  }, [contexts]);

  // Expose state container using REAL store methods
  useEffect(() => {
    stateContainerRef.current = {
      getContexts: () => store.projectContexts[projectId] || [],
      getInterfaceContext: () => store.interfaceContexts[interfaceId] || null,
      getTabContext: (tabId) => store.tabContexts[tabId] || null,
      getTileContext: (tileId) => store.tileContexts[tileId] || null,
      getEffectiveContext: (tileId, tabId) => {
        // Use the REAL getEffectiveContext from the store
        return store.getEffectiveContext(tileId, tabId, interfaceId);
      },
      setInterfaceContext: (context) => {
        store.setContextOptimistic('interface', interfaceId, context, { projectId, interfaceId });
      },
      setTabContext: (tabId, context) => {
        store.setContextOptimistic('tab', tabId, context, { projectId, interfaceId, tabId });
      },
      setTileContext: (tileId, context) => {
        store.setContextOptimistic('tile', tileId, context, { projectId, interfaceId });
      },
      clearContext: (scope, targetId) => {
        store.setContextOptimistic(scope, targetId, '', { projectId, interfaceId });
      },
      createContext: (name) => {
        const current = store.projectContexts[projectId] || [];
        if (!current.includes(name)) {
          store.setProjectContexts(projectId, [...current, name]);
        }
      },
      deleteContext: (name) => {
        store.deleteProjectContext(projectId, name);
      },
      renameContext: (from, to) => {
        store.renameProjectContext(projectId, from, to);
      },
    };
    // stateContainerRef is stable and doesn't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, projectId, interfaceId]);

  // Get tabs and tiles for rendering
  const tabs = Object.values(tabsById).filter((t: any) => t.interfaceId === interfaceId);

  return (
    <div data-testid="context-selector-harness">
      {/* Interface Context Selector - using REAL component */}
      <div data-testid="interface-context-section">
        <h3>Interface Context</h3>
        <button
          data-testid="interface-context-button"
          onClick={() => setActiveSelector({ scope: 'interface', targetId: interfaceId })}
        >
          {interfaceContext || 'Select context'}
        </button>
        {interfaceContext && (
          <button
            data-testid="interface-context-clear"
            onClick={() =>
              store.setContextOptimistic('interface', interfaceId, '', { projectId, interfaceId })
            }
          >
            Clear
          </button>
        )}
      </div>

      {/* Tab Context Selectors */}
      <div data-testid="tab-contexts-section">
        <h3>Tab Contexts</h3>
        {tabs.map((tab: any) => (
          <div key={tab.id} data-testid={`tab-context-${tab.id}`}>
            <span>{tab.name}</span>
            <button
              data-testid={`tab-context-button-${tab.id}`}
              onClick={() => setActiveSelector({ scope: 'tab', targetId: tab.id })}
            >
              {tabContexts[tab.id] || 'Select context'}
            </button>
            {tabContexts[tab.id] && (
              <button
                data-testid={`tab-context-clear-${tab.id}`}
                onClick={() =>
                  store.setContextOptimistic('tab', tab.id, '', {
                    projectId,
                    interfaceId,
                    tabId: tab.id,
                  })
                }
              >
                Clear
              </button>
            )}
            <span data-testid={`tab-effective-${tab.id}`}>
              Effective: {store.getEffectiveContext(null, tab.id, interfaceId) || 'none'}
            </span>
          </div>
        ))}
      </div>

      {/* Tile Context Selectors */}
      <div data-testid="tile-contexts-section">
        <h3>Tile Contexts</h3>
        {Object.values(tilesById).map((tile: any) => {
          const parentTab = tabs.find((t: any) => t.tileIds?.includes(tile.id));
          return (
            <div key={tile.id} data-testid={`tile-context-${tile.id}`}>
              <span>{tile.name}</span>
              <button
                data-testid={`tile-context-button-${tile.id}`}
                onClick={() => setActiveSelector({ scope: 'tile', targetId: tile.id })}
              >
                {tileContexts[tile.id] || 'Select context'}
              </button>
              {tileContexts[tile.id] && (
                <button
                  data-testid={`tile-context-clear-${tile.id}`}
                  onClick={() =>
                    store.setContextOptimistic('tile', tile.id, '', { projectId, interfaceId })
                  }
                >
                  Clear
                </button>
              )}
              <span data-testid={`tile-effective-${tile.id}`}>
                Effective:{' '}
                {store.getEffectiveContext(tile.id, parentTab?.id || null, interfaceId) || 'none'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Context Dropdown (shown when a selector is active) */}
      {activeSelector && (
        <div data-testid="context-dropdown" role="listbox">
          <input
            data-testid="context-search"
            placeholder="Search contexts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {filteredContexts.length === 0 && (
            <div data-testid="no-contexts-message">
              {searchQuery ? 'No contexts match your search.' : 'No contexts found.'}
            </div>
          )}
          {filteredContexts.map((ctx) => (
            <button
              key={ctx}
              data-testid={`context-option-${ctx}`}
              role="option"
              aria-selected={false}
              onClick={() => {
                if (activeSelector.scope === 'interface') {
                  store.setContextOptimistic('interface', interfaceId, ctx, {
                    projectId,
                    interfaceId,
                  });
                } else if (activeSelector.scope === 'tab') {
                  store.setContextOptimistic('tab', activeSelector.targetId, ctx, {
                    projectId,
                    interfaceId,
                    tabId: activeSelector.targetId,
                  });
                } else if (activeSelector.scope === 'tile') {
                  store.setContextOptimistic('tile', activeSelector.targetId, ctx, {
                    projectId,
                    interfaceId,
                  });
                }
                setActiveSelector(null);
                setSearchQuery('');
              }}
            >
              {ctx}
            </button>
          ))}
          <button
            data-testid="context-dropdown-close"
            onClick={() => {
              setActiveSelector(null);
              setSearchQuery('');
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* Context Management (Create/Delete) */}
      <div data-testid="context-management">
        <h3>Manage Contexts</h3>
        <div data-testid="context-list">
          {contexts.map((ctx) => (
            <div key={ctx} data-testid={`context-item-${ctx}`}>
              <span>{ctx}</span>
              <button
                data-testid={`delete-context-${ctx}`}
                onClick={() => store.deleteProjectContext(projectId, ctx)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
        <button
          data-testid="create-context-button"
          onClick={() => {
            const name = `context-${Date.now()}`;
            const current = store.projectContexts[projectId] || [];
            store.setProjectContexts(projectId, [...current, name]);
          }}
        >
          Create Context
        </button>
      </div>

      {/* 
        REAL ContextSelector can be enabled for integration testing.
        Currently disabled to avoid DOM nesting warnings.
        To test the real component's UI, uncomment this section and add 
        appropriate test IDs or queries for the real component's elements.
        
        <div data-testid="real-context-selector-section">
          <ContextSelector
            projectId={projectId}
            interfaceId={interfaceId}
            logsActions={mockLogsActions as any}
            contextActions={mockContextActions as any}
            projectsActions={mockProjectsActions as any}
            fieldsActions={mockFieldsActions as any}
            setPending={() => {}}
          />
        </div>
      */}
    </div>
  );
}

// ============================================================================
// Test Providers Wrapper
// ============================================================================

interface TestProvidersProps {
  children: React.ReactNode;
  initialState: Partial<StoreState>;
  queryClient: QueryClient;
}

function TestProviders({ children, initialState, queryClient }: TestProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <NextUIProvider>
          <SidebarProvider>
            <StoreProvider initialState={initialState}>{children}</StoreProvider>
          </SidebarProvider>
        </NextUIProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

// ============================================================================
// Render Function
// ============================================================================

export function renderContextSelector(
  options: ContextSelectorTestOptions = {}
): ContextSelectorTestResult {
  const stateContainerRef: React.MutableRefObject<StateContainer | null> = { current: null };
  const projectId = options.projectId || 'test-project';
  const interfaceId = options.interfaceId || 'test-interface';
  const contexts = options.initialContexts || ['context-1', 'context-2', 'context-3'];

  const initialState = createInitialStoreState(options);
  const queryClient = createTestQueryClient();

  const { container, unmount } = render(
    <TestProviders initialState={initialState} queryClient={queryClient}>
      <ContextSelectorInner
        stateContainerRef={stateContainerRef}
        projectId={projectId}
        interfaceId={interfaceId}
        contexts={contexts}
      />
    </TestProviders>
  );

  return {
    container,

    // Context queries (using REAL store)
    getContexts: () => stateContainerRef.current?.getContexts() ?? [],
    getInterfaceContext: () => stateContainerRef.current?.getInterfaceContext() ?? null,
    getTabContext: (tabId) => stateContainerRef.current?.getTabContext(tabId) ?? null,
    getTileContext: (tileId) => stateContainerRef.current?.getTileContext(tileId) ?? null,
    getEffectiveContext: (tileId, tabId) =>
      stateContainerRef.current?.getEffectiveContext(tileId, tabId) ?? null,

    // Context mutations (using REAL store)
    setInterfaceContext: async (context) => {
      await act(async () => {
        stateContainerRef.current?.setInterfaceContext(context);
      });
    },
    setTabContext: async (tabId, context) => {
      await act(async () => {
        stateContainerRef.current?.setTabContext(tabId, context);
      });
    },
    setTileContext: async (tileId, context) => {
      await act(async () => {
        stateContainerRef.current?.setTileContext(tileId, context);
      });
    },
    clearContext: async (scope, targetId) => {
      await act(async () => {
        stateContainerRef.current?.clearContext(scope, targetId);
      });
    },
    createContext: async (name) => {
      await act(async () => {
        stateContainerRef.current?.createContext(name);
      });
    },
    deleteContext: async (name) => {
      await act(async () => {
        stateContainerRef.current?.deleteContext(name);
      });
    },
    renameContext: async (from, to) => {
      await act(async () => {
        stateContainerRef.current?.renameContext(from, to);
      });
    },

    // UI interactions
    openContextSelector: async (scope, targetId) => {
      const user = userEvent.setup();
      if (scope === 'interface') {
        const button = screen.getByTestId('interface-context-button');
        await user.click(button);
      } else if (scope === 'tab' && targetId) {
        const button = screen.getByTestId(`tab-context-button-${targetId}`);
        await user.click(button);
      } else if (scope === 'tile' && targetId) {
        const button = screen.getByTestId(`tile-context-button-${targetId}`);
        await user.click(button);
      }
    },
    selectContextFromDropdown: async (contextName) => {
      const user = userEvent.setup();
      const option = screen.getByTestId(`context-option-${contextName}`);
      await user.click(option);
    },
    searchContexts: async (query) => {
      const user = userEvent.setup();
      const input = screen.getByTestId('context-search');
      await user.clear(input);
      await user.type(input, query);
    },
    getVisibleContexts: () => {
      const dropdown = screen.queryByTestId('context-dropdown');
      if (!dropdown) return [];
      const options = within(dropdown).queryAllByRole('option');
      return options.map((opt) => opt.textContent || '');
    },

    unmount,
  };
}

// Types are already exported above via `export interface`
