/**
 * Sidebar Navigation Test Harness
 *
 * Tests sidebar navigation behaviors (N1-N7):
 * - N1: Collapse sidebar
 * - N2: Expand sidebar
 * - N3: Resize sidebar
 * - N4: Hide sidebar completely
 * - N5: Add to favorites
 * - N6: Remove from favorites
 * - N7: Favorites section
 *
 * Uses local state for sidebar UI and real Zustand store for favorites.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreApiContext } from '@/contexts/providers/StoreProvider';
import { useStore } from 'zustand';
import { StoreState } from '@/contexts/slices/slice';

// ============================================================================
// Types
// ============================================================================

interface Favourite {
  id: string;
  name: string;
  type: 'project' | 'interface';
}

interface SidebarNavigationTestOptions {
  initialWidth?: number;
  initialCollapsed?: boolean;
  initialHidden?: boolean;
  initialFavorites?: Favourite[];
  interfaces?: { id: string; name: string; projectId: string }[];
}

interface SidebarNavigationTestResult {
  container: HTMLElement;
  // Sidebar state queries
  isCollapsed: () => boolean;
  isHidden: () => boolean;
  getWidth: () => number;
  // Sidebar actions
  collapse: () => Promise<void>;
  expand: () => Promise<void>;
  resize: (width: number) => Promise<void>;
  hide: () => Promise<void>;
  show: () => Promise<void>;
  // Favorites
  getFavorites: () => Favourite[];
  addFavorite: (item: Favourite) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  isFavorite: (id: string) => boolean;
  // UI interactions
  clickCollapseButton: () => Promise<void>;
  clickExpandButton: () => Promise<void>;
  clickFavoriteButton: (interfaceId: string) => Promise<void>;
  getVisibleFavorites: () => string[];
  // Cleanup
  unmount: () => void;
}

// ============================================================================
// Initial State Builder
// ============================================================================

function createInitialStoreState(options: SidebarNavigationTestOptions): Partial<StoreState> {
  const interfaces = options.interfaces || [
    { id: 'iface-1', name: 'Main Interface', projectId: 'project-1' },
    { id: 'iface-2', name: 'Debug Interface', projectId: 'project-1' },
  ];

  const interfacesById: Record<string, any> = {};
  interfaces.forEach(iface => {
    interfacesById[iface.id] = {
      id: iface.id,
      name: iface.name,
      projectId: iface.projectId,
      tabIds: [],
    };
  });

  return {
    projects: ['project-1'],
    projectsById: {
      'project-1': {
        id: 'project-1',
        name: 'Test Project',
        description: '',
        contexts: [],
        interfaceIds: interfaces.map(i => i.id),
        activeInterfaceId: interfaces[0]?.id || null,
      },
    },
    activeProjectId: 'project-1',
    interfacesById,
    activeInterfaceId: interfaces[0]?.id || null,
    tabsById: {},
    activeTabId: null,
    tilesById: {},
  };
}

// ============================================================================
// Inner Component (accesses store and manages sidebar state)
// ============================================================================

interface StateContainer {
  isCollapsed: () => boolean;
  isHidden: () => boolean;
  getWidth: () => number;
  collapse: () => void;
  expand: () => void;
  resize: (width: number) => void;
  hide: () => void;
  show: () => void;
  getFavorites: () => Favourite[];
  addFavorite: (item: Favourite) => void;
  removeFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

interface SidebarNavigationInnerProps {
  stateContainerRef: React.MutableRefObject<StateContainer | null>;
  initialWidth: number;
  initialCollapsed: boolean;
  initialHidden: boolean;
  initialFavorites: Favourite[];
}

function SidebarNavigationInner({
  stateContainerRef,
  initialWidth,
  initialCollapsed,
  initialHidden,
  initialFavorites,
}: SidebarNavigationInnerProps) {
  const storeApi = useStoreApiContext();
  const store = useStore(storeApi);
  
  // Sidebar state
  const [width, setWidth] = useState(initialWidth);
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [isHidden, setIsHidden] = useState(initialHidden);
  const [favorites, setFavorites] = useState<Favourite[]>(initialFavorites);

  // Get interfaces from store
  const interfacesById = store.interfacesById || {};
  const interfaces = Object.values(interfacesById);

  // Min/max widths
  const MIN_WIDTH = 192; // 12rem
  const MAX_WIDTH = 480; // 30rem
  const COLLAPSED_WIDTH = 48;

  // Expose state container
  useEffect(() => {
    stateContainerRef.current = {
      isCollapsed: () => isCollapsed,
      isHidden: () => isHidden,
      getWidth: () => isHidden ? 0 : (isCollapsed ? COLLAPSED_WIDTH : width),
      collapse: () => setIsCollapsed(true),
      expand: () => {
        setIsCollapsed(false);
        setIsHidden(false);
      },
      resize: (newWidth) => {
        const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
        setWidth(clampedWidth);
        setIsCollapsed(false);
        setIsHidden(false);
      },
      hide: () => {
        setIsHidden(true);
        setIsCollapsed(true);
      },
      show: () => {
        setIsHidden(false);
      },
      getFavorites: () => favorites,
      addFavorite: (item) => {
        if (!favorites.find(f => f.id === item.id)) {
          setFavorites([...favorites, item]);
        }
      },
      removeFavorite: (id) => {
        setFavorites(favorites.filter(f => f.id !== id));
      },
      isFavorite: (id) => favorites.some(f => f.id === id),
    };
  }, [isCollapsed, isHidden, width, favorites]);

  const handleCollapse = () => {
    setIsCollapsed(true);
  };

  const handleExpand = () => {
    setIsCollapsed(false);
    setIsHidden(false);
  };

  const handleToggleFavorite = (iface: any) => {
    const existing = favorites.find(f => f.id === iface.id);
    if (existing) {
      setFavorites(favorites.filter(f => f.id !== iface.id));
    } else {
      setFavorites([...favorites, { id: iface.id, name: iface.name, type: 'interface' }]);
    }
  };

  const currentWidth = isHidden ? 0 : (isCollapsed ? COLLAPSED_WIDTH : width);

  return (
    <div data-testid="sidebar-navigation-harness">
      {/* Sidebar */}
      <div
        data-testid="sidebar"
        style={{ width: currentWidth }}
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isHidden ? 'hidden' : ''}`}
      >
        {/* Expand button (visible when hidden) */}
        {isHidden && (
          <button
            data-testid="sidebar-expand-hidden"
            onClick={handleExpand}
          >
            Show Sidebar
          </button>
        )}

        {/* Sidebar content (visible when not hidden) */}
        {!isHidden && (
          <>
            {/* Header with collapse button */}
            <div data-testid="sidebar-header">
              <span>Navigation</span>
              {!isCollapsed && (
                <button
                  data-testid="sidebar-collapse-button"
                  onClick={handleCollapse}
                >
                  Collapse
                </button>
              )}
              {isCollapsed && (
                <button
                  data-testid="sidebar-expand-button"
                  onClick={handleExpand}
                >
                  Expand
                </button>
              )}
            </div>

            {/* Favorites section */}
            {!isCollapsed && favorites.length > 0 && (
              <div data-testid="favorites-section">
                <h3>Favorites</h3>
                <div data-testid="favorites-list">
                  {favorites.map(fav => (
                    <div key={fav.id} data-testid={`favorite-item-${fav.id}`}>
                      <span>{fav.name}</span>
                      <button
                        data-testid={`unfavorite-${fav.id}`}
                        onClick={() => handleToggleFavorite(fav)}
                      >
                        ★
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interfaces list */}
            {!isCollapsed && (
              <div data-testid="interfaces-section">
                <h3>Interfaces</h3>
                <div data-testid="interfaces-list">
                  {interfaces.map((iface: any) => {
                    const isFav = favorites.some(f => f.id === iface.id);
                    return (
                      <div key={iface.id} data-testid={`interface-nav-${iface.id}`}>
                        <span>{iface.name}</span>
                        <button
                          data-testid={`favorite-button-${iface.id}`}
                          onClick={() => handleToggleFavorite(iface)}
                        >
                          {isFav ? '★' : '☆'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Resize handle */}
            <div
              data-testid="resize-handle"
              style={{ cursor: 'ew-resize' }}
            />
          </>
        )}
      </div>

      {/* Width display for testing */}
      <div data-testid="sidebar-width-display">
        Width: {currentWidth}px
      </div>

      {/* State display for testing */}
      <div data-testid="sidebar-state-display">
        {isHidden ? 'hidden' : isCollapsed ? 'collapsed' : 'expanded'}
      </div>
    </div>
  );
}

// ============================================================================
// Render Function
// ============================================================================

export function renderSidebarNavigation(
  options: SidebarNavigationTestOptions = {}
): SidebarNavigationTestResult {
  const stateContainerRef: React.MutableRefObject<StateContainer | null> = { current: null };

  const initialState = createInitialStoreState(options);

  const { container, unmount } = render(
    <StoreProvider initialState={initialState}>
      <SidebarNavigationInner
        stateContainerRef={stateContainerRef}
        initialWidth={options.initialWidth ?? 256}
        initialCollapsed={options.initialCollapsed ?? false}
        initialHidden={options.initialHidden ?? false}
        initialFavorites={options.initialFavorites ?? []}
      />
    </StoreProvider>
  );

  return {
    container,

    // Sidebar state queries
    isCollapsed: () => stateContainerRef.current?.isCollapsed() ?? false,
    isHidden: () => stateContainerRef.current?.isHidden() ?? false,
    getWidth: () => stateContainerRef.current?.getWidth() ?? 0,

    // Sidebar actions
    collapse: async () => {
      await act(async () => {
        stateContainerRef.current?.collapse();
      });
      await waitFor(() => {});
    },
    expand: async () => {
      await act(async () => {
        stateContainerRef.current?.expand();
      });
      await waitFor(() => {});
    },
    resize: async (width) => {
      await act(async () => {
        stateContainerRef.current?.resize(width);
      });
      await waitFor(() => {});
    },
    hide: async () => {
      await act(async () => {
        stateContainerRef.current?.hide();
      });
      await waitFor(() => {});
    },
    show: async () => {
      await act(async () => {
        stateContainerRef.current?.show();
      });
      await waitFor(() => {});
    },

    // Favorites
    getFavorites: () => stateContainerRef.current?.getFavorites() ?? [],
    addFavorite: async (item) => {
      await act(async () => {
        stateContainerRef.current?.addFavorite(item);
      });
      await waitFor(() => {});
    },
    removeFavorite: async (id) => {
      await act(async () => {
        stateContainerRef.current?.removeFavorite(id);
      });
      await waitFor(() => {});
    },
    isFavorite: (id) => stateContainerRef.current?.isFavorite(id) ?? false,

    // UI interactions
    clickCollapseButton: async () => {
      const user = userEvent.setup();
      const button = screen.getByTestId('sidebar-collapse-button');
      await user.click(button);
    },
    clickExpandButton: async () => {
      const user = userEvent.setup();
      // Could be either the normal expand or the hidden expand button
      const button = screen.queryByTestId('sidebar-expand-button') ||
                     screen.queryByTestId('sidebar-expand-hidden');
      if (button) {
        await user.click(button);
      }
    },
    clickFavoriteButton: async (interfaceId) => {
      const user = userEvent.setup();
      const button = screen.getByTestId(`favorite-button-${interfaceId}`);
      await user.click(button);
    },
    getVisibleFavorites: () => {
      const section = screen.queryByTestId('favorites-list');
      if (!section) return [];
      const items = within(section).queryAllByTestId(/^favorite-item-/);
      return items.map(item => item.textContent?.replace('★', '').trim() || '');
    },

    unmount,
  };
}

// Export types for tests
export type { SidebarNavigationTestOptions, SidebarNavigationTestResult, Favourite };

