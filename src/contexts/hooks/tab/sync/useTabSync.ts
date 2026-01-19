import { useMemo, useRef, useEffect } from 'react';
import { perfStart, perfEnd } from '@/lib/perf';
import { useTabRouterRefresh } from './useTabRouterRefresh';
import {
  GranularTabActions,
  GranularTileActions,
  TableTileData,
  TileData,
  TilePosition,
  TileLayout,
} from '@/types/interfaces/grid';
import { useUpdateTabUnifiedQuery } from '@/hooks/Interfaces/Query/useTabsQuery';
import {
  usePatchTileQuery,
  useDeleteTileQuery,
  useUpdateTileQuery,
  useCreateTileQuery,
} from '@/hooks/Interfaces/Query/useTilesQuery';
import { useTab } from '../useTab';
import { TabDataActions } from '../useTabData';
import { TabUIActions } from '../useTabUI';
import { v4 as uuidv4 } from 'uuid';
import { convertTileToTileData } from '@/contexts/utils/sliceUtils';
import { Tile } from '@/contexts/slices/selectors/tile';
import { useQueryClient } from '@tanstack/react-query';
import { showErrorToast } from '@/components/Common/Toasts/notifications';

/**
 * Debug flag for state syncing logging
 * Set NEXT_PUBLIC_DEBUG_STATE_SYNCING=true to enable detailed state synchronization logs
 */
const DEBUG_STATE_SYNCING = process.env.NEXT_PUBLIC_DEBUG_STATE_SYNCING === 'true';

/**
 * Conditional debug logger for state syncing
 */
const debugLog = (...args: any[]) => {
  if (DEBUG_STATE_SYNCING) {
    console.log(...args);
  }
};

/**
 * Extended interface for TabDataActions with additional parameters
 * for the synchronized versions
 */
export interface SyncedTabDataActions extends TabDataActions {
  removeContextFromTab: (context: string, setPending?: (pending: boolean) => void) => void;
  setGlobalContext: (context: string | undefined, setPending?: (pending: boolean) => void) => void;
  // Add any other extended methods here that have additional parameters
}

/**
 * Extended interface for TabActions with synchronized data actions
 */
export interface SyncedTabActions {
  data: SyncedTabDataActions | null;
  ui: TabUIActions | null;
}

/**
 * A hook that provides tab actions that are synchronized with server state
 * through React Query and router refreshes.
 *
 * @param tabId - The ID of the tab
 * @param interfaceId - The ID of the interface
 * @param tabActions - The granular tab actions for server-side operations
 * @param tileActions - The granular tile actions for server-side operations
 * @param setExternalPending - Optional function to set external pending state during operations
 * @returns Object containing synchronized actions
 */
export function useTabSync(
  tabId: string | null,
  interfaceId: string | null,
  tabActions: GranularTabActions | undefined,
  tileActions?: GranularTileActions | undefined
): { actions: SyncedTabActions | null } {
  // Get tab UI actions for router refresh coordination
  const { data: tabData, actions: tabOriginalActions } = useTab(tabId, interfaceId);
  const { data: tabDataActions, ui: tabUIActions } = tabOriginalActions ?? { data: null, ui: null };

  // Mutation hooks for server state updates
  const updateTabMutation = useUpdateTabUnifiedQuery();
  const createTileMutation = useCreateTileQuery();
  const updateTileMutation = useUpdateTileQuery();
  const patchTileMutation = usePatchTileQuery();
  const deleteTileMutation = useDeleteTileQuery();

  // Get router refresh function with pending state handling
  const refreshRouter = useTabRouterRefresh(tabUIActions ?? null);

  // Get the query client
  const queryClient = useQueryClient();

  // Debounce state for layout updates to avoid spamming server actions
  const layoutDebounceTimersRef = useRef<Record<string, any>>({});
  const pendingLayoutUpdateRef = useRef<Record<string, Partial<TileData>>>({});
  const lastSentLayoutHashRef = useRef<Record<string, string>>({});
  const createRetryTimersRef = useRef<Record<string, any>>({});
  const createRetryAttemptsRef = useRef<Record<string, number>>({});
  const updateRetryTimersRef = useRef<Record<string, any>>({});
  const updateRetryAttemptsRef = useRef<Record<string, number>>({});

  // Feature flag for bulk operations (client-side)
  const ENABLE_BULK = process.env.NEXT_PUBLIC_ENABLE_BULK_TILE_PATCH !== 'false';

  // Helper to perform bulk tile patches with graceful fallback
  const bulkPatchTiles = async (
    updates: Array<{ id?: string; tabId?: string; name?: string; updateData: Record<string, any> }>
  ): Promise<{
    results: any[];
    errors: Array<{ id?: string; tabId?: string; name?: string; error: string }>;
  }> => {
    if (!updates.length) return { results: [], errors: [] };

    // Fallback to per-item path if bulk disabled or tileActions missing
    if (!ENABLE_BULK || !tileActions) {
      for (const u of updates) {
        try {
          if (u.id) {
            await patchTileMutation.mutateAsync({
              id: u.id,
              updateData: u.updateData,
              actions: tileActions!,
            });
          } else if (u.tabId && u.name) {
            await patchTileMutation.mutateAsync({
              tabId: u.tabId,
              name: u.name,
              updateData: u.updateData,
              actions: tileActions!,
            });
          }
        } catch {}
      }
      return { results: [], errors: [] };
    }

    try {
      const p = perfStart(`bulkPatchTiles:${updates.length}`);
      const res = await fetch('/api/tile/bulk/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const data = await res
        .json()
        .catch(() => ({ results: [], errors: [{ error: 'Invalid response' }] }));
      if (!res.ok) throw new Error(data?.detail || `Bulk ${res.status}`);
      perfEnd(p, { results: data?.results?.length ?? 0, errors: data?.errors?.length ?? 0 });
      return data as {
        results: any[];
        errors: Array<{ id?: string; tabId?: string; name?: string; error: string }>;
      };
    } catch (e: any) {
      perfEnd(perfStart('bulkPatchTiles:error'), { error: true });
      // On bulk failure, fallback per-item
      for (const u of updates) {
        try {
          if (u.id) {
            await patchTileMutation.mutateAsync({
              id: u.id,
              updateData: u.updateData,
              actions: tileActions!,
            });
          } else if (u.tabId && u.name) {
            await patchTileMutation.mutateAsync({
              tabId: u.tabId,
              name: u.name,
              updateData: u.updateData,
              actions: tileActions!,
            });
          }
        } catch {}
      }
      return { results: [], errors: [{ error: e?.message || 'Bulk failed' }] };
    }
  };

  // Targeted invalidation helper for tile updates
  const invalidateAfterTileUpdate = async ({
    id,
    tabId,
    priorType,
    updateData,
  }: {
    id: string;
    tabId?: string | null;
    priorType?: string | null;
    updateData: Partial<TileData>;
  }) => {
    if (!id) return;
    try {
      queryClient.invalidateQueries({ queryKey: ['tile-by-id', id] });
    } catch {}
    if (tabId) {
      try {
        queryClient.invalidateQueries({ queryKey: ['tiles', tabId] });
      } catch {}
      try {
        queryClient.invalidateQueries({ queryKey: ['tab-with-tiles-by-id', tabId] });
      } catch {}
    }

    const touchesTableData =
      'context' in updateData ||
      'columnContext' in updateData ||
      'filters' in updateData ||
      'commonFilter' in updateData ||
      'grouping' in updateData ||
      'metric' in updateData ||
      'tableTile' in updateData ||
      'autoUpdate' in updateData;

    const touchesPlotData =
      'context' in updateData ||
      'columnContext' in updateData ||
      'metric' in updateData ||
      'grouping' in updateData ||
      'plotTile' in updateData;

    const nextType = (updateData as any)?.type as string | undefined;
    const effectiveType = nextType || priorType || undefined;

    if (touchesTableData && effectiveType === 'Table') {
      try {
        queryClient.invalidateQueries({ queryKey: ['tableDataItem', id] });
      } catch {}
      try {
        queryClient.invalidateQueries({ queryKey: ['tableDataItem', 'autoUpdate', id] });
      } catch {}
    }
    if (touchesPlotData && effectiveType === 'Plot') {
      try {
        queryClient.invalidateQueries({ queryKey: ['plotDataItem', id] });
      } catch {}
    }
  };

  // Decide if a structural refresh is warranted (rare)
  const needsStructuralRefresh = (priorType?: string | null, nextData?: Partial<TileData>) => {
    const nextType = nextData?.type as string | undefined;
    if (nextType && priorType && nextType !== priorType) {
      return true;
    }
    return false;
  };

  // Helper to clear all timers/attempts for a given tile
  const clearTileTimers = (tileId: string) => {
    if (layoutDebounceTimersRef.current[tileId]) {
      clearTimeout(layoutDebounceTimersRef.current[tileId]);
      delete layoutDebounceTimersRef.current[tileId];
    }
    if (createRetryTimersRef.current[tileId]) {
      clearTimeout(createRetryTimersRef.current[tileId]);
      delete createRetryTimersRef.current[tileId];
    }
    if (updateRetryTimersRef.current[tileId]) {
      clearTimeout(updateRetryTimersRef.current[tileId]);
      delete updateRetryTimersRef.current[tileId];
    }
    delete createRetryAttemptsRef.current[tileId];
    delete updateRetryAttemptsRef.current[tileId];
  };

  /**
   * Initialize a tile with a generated UUID
   */
  const wrapInitTile = async (tileName: string, initialState: Partial<TileData> = {}) => {
    if (!tabId || !tabDataActions || !tileActions) return;

    try {
      // Generate a UUID for the new tile
      const tileId = uuidv4();

      // First update the local state with the generated tileId
      tabDataActions.initTile(tileName, {
        ...initialState,
        id: tileId,
        name: tileName,
        pending: true,
      });

      // Create the default position if not provided
      const { position, type, ...safeInitialState } = initialState;

      // Create the tile on the server with the generated UUID
      const scheduleCreateRetry = () => {
        const attempts = createRetryAttemptsRef.current[tileId] || 0;
        if (attempts >= 5) {
          debugLog(`[Tile Create] Max retries reached for ${tileName} (${tileId})`);
          return;
        }
        const delay = Math.min(2000 * Math.pow(2, attempts), 30000);
        createRetryAttemptsRef.current[tileId] = attempts + 1;
        createRetryTimersRef.current[tileId] = setTimeout(() => {
          createTileMutation.mutate(
            {
              tabId: tabId,
              name: tileName,
              position: position || { x: 0, y: 0, width: 4, height: 4 },
              data: safeInitialState,
              tileId: tileId,
              actions: tileActions,
            },
            {
              onSuccess: () => {
                clearTimeout(createRetryTimersRef.current[tileId]);
                delete createRetryTimersRef.current[tileId];
                delete createRetryAttemptsRef.current[tileId];
                tabDataActions.updateTile(tileId, { pending: false, error: null } as any);
                debugLog(`Tile ${tileName} created with ID ${tileId}`);
              },
              onError: () => {
                tabDataActions.updateTile(tileId, {
                  pending: true,
                  error: 'Save failed. Retrying…',
                } as any);
                scheduleCreateRetry();
              },
            }
          );
        }, delay);
      };

      // Kick off create with retry handlers
      createTileMutation.mutate(
        {
          tabId: tabId,
          name: tileName,
          position: position || { x: 0, y: 0, width: 4, height: 4 },
          data: safeInitialState,
          tileId: tileId,
          actions: tileActions,
        },
        {
          onSuccess: () => {
            tabDataActions.updateTile(tileId, { pending: false, error: null } as any);
            debugLog(`Tile ${tileName} created with ID ${tileId}`);
          },
          onError: () => {
            tabDataActions.updateTile(tileId, {
              pending: true,
              error: 'Save failed. Retrying…',
            } as any);
            scheduleCreateRetry();
          },
        }
      );
      return null;
    } catch (error) {
      console.error(`Failed to create tile ${tileName}:`, error);
      // Keep local tile and mark as pending; background retry is scheduled via mutate onError
      return null;
    }
  };

  /**
   * Rename a tile
   */
  const wrapRenameTile = (tileId: string, newTileName: string) => {
    if (!tileId || !tabDataActions || !tileActions) return;

    // Get the old tile name
    const oldTileName = tabDataActions.getTileName(tileId);

    if (!oldTileName) return;

    const referencedTileIds = tabDataActions.getReferencedTileIdsByName(oldTileName);
    const referencedPlotTileIds = tabDataActions.getReferencedPlotTileIdsByName(oldTileName);

    // 1) Update local state immediately
    tabDataActions.renameTile(tileId, newTileName);

    // 2) Update the tile name on the server
    patchTileMutation.mutate({
      id: tileId,
      updateData: {
        name: newTileName,
      },
      actions: tileActions,
    });

    // 3) Batch references updates into a single bulk payload
    const updatesMap = new Map<string, Record<string, any>>();

    // Update `table` references
    referencedTileIds.forEach((id) => {
      const prev = updatesMap.get(id) || {};
      updatesMap.set(id, { ...prev, table: newTileName });
    });

    // Plot axes and groupBy
    const mergePlotUpdate = (id: string, key: 'xAxis' | 'yAxis' | 'plotGroupBy') => {
      const tile = tabDataActions.getPartialTile(id);
      if (!tile?.plotTile) return;
      const prev = updatesMap.get(id) || {};
      const prevPlot = (prev as any).plotTile || {};
      updatesMap.set(id, {
        ...prev,
        plotTile: { ...prevPlot, [key]: (tile.plotTile as any)[key] },
      });
    };
    referencedPlotTileIds.xAxis.forEach((id) => mergePlotUpdate(id, 'xAxis'));
    referencedPlotTileIds.yAxis.forEach((id) => mergePlotUpdate(id, 'yAxis'));
    referencedPlotTileIds.plotGroupBy.forEach((id) => mergePlotUpdate(id, 'plotGroupBy'));

    const updates = Array.from(updatesMap.entries()).map(([id, updateData]) => ({
      id,
      updateData,
    }));

    bulkPatchTiles(updates).then(({ errors }) => {
      if (errors?.length) {
        console.warn('[bulkRenameTile] Partial failures:', errors.length);
      }
      try {
        if (tabId) queryClient.invalidateQueries({ queryKey: ['tiles', tabId] });
      } catch {}
    });
  };

  /**
   * Remove a tile from a tab
   */
  const wrapRemoveTile = async (tileId: string) => {
    if (!tileId || !tabDataActions || !tileActions) return;

    // Clear any pending timers for this tile to avoid post-delete actions
    clearTileTimers(tileId);

    // Get the old tile name
    const oldTileName = tabDataActions.getTileName(tileId);

    if (!oldTileName) return;

    const referencedTileIds = tabDataActions.getReferencedTileIdsByName(oldTileName);
    const referencedPlotTileIds = tabDataActions.getReferencedPlotTileIdsByName(oldTileName);

    // 1) Attempt server delete first; only update local state on success
    try {
      await deleteTileMutation.mutateAsync({
        id: tileId,
        actions: tileActions,
      });
    } catch (e) {
      showErrorToast(e, `Failed to delete tile ${oldTileName}`);
      return;
    }

    // 2) Update local state after confirmed delete
    tabDataActions.removeTile(tileId);

    // 3) Then update any references to this tile in other tiles
    // Start with updating the `tile.table` property for all tiles that reference this tile by name via the `table` property
    // Update the referenced tiles on the server
    referencedTileIds.forEach((id) => {
      patchTileMutation.mutate({
        id: id,
        updateData: {
          table: null,
        },
        actions: tileActions,
      });
    });

    // 4) Update xAxis, yAxis, and plotGroupBy references for Plot tiles
    // Update xAxis references
    referencedPlotTileIds.xAxis.forEach((id) => {
      // Get the tile
      const tile = tabDataActions.getPartialTile(id);
      if (tile?.plotTile) {
        patchTileMutation.mutate({
          id: id,
          updateData: {
            plotTile: {
              xAxis: null,
            },
          },
          actions: tileActions,
        });
      }
    });

    // Update yAxis references
    referencedPlotTileIds.yAxis.forEach((id) => {
      // Get the tile
      const tile = tabDataActions.getPartialTile(id);
      if (tile?.plotTile) {
        patchTileMutation.mutate({
          id: id,
          updateData: {
            plotTile: {
              yAxis: null,
            },
          },
          actions: tileActions,
        });
      }
    });

    // Update plotGroupBy references
    referencedPlotTileIds.plotGroupBy.forEach((id) => {
      // Get the tile
      const tile = tabDataActions.getPartialTile(id);
      if (tile?.plotTile) {
        patchTileMutation.mutate({
          id: id,
          updateData: {
            plotTile: {
              plotGroupBy: null,
            },
          },
          actions: tileActions,
        });
      }
    });
  };

  // Global cleanup on unmount to prevent leaks and post-unmount updates
  useEffect(() => {
    return () => {
      // Clear all layout debounce timers
      Object.values(layoutDebounceTimersRef.current).forEach((t) => clearTimeout(t));
      // Clear all create retry timers
      Object.values(createRetryTimersRef.current).forEach((t) => clearTimeout(t));
      // Clear all update retry timers
      Object.values(updateRetryTimersRef.current).forEach((t) => clearTimeout(t));

      // Reset attempts
      createRetryAttemptsRef.current = {};
      updateRetryAttemptsRef.current = {};

      // Reset timer refs
      layoutDebounceTimersRef.current = {};
      createRetryTimersRef.current = {};
      updateRetryTimersRef.current = {};
    };
  }, []);

  /**
   * Paste a copied tile with a generated UUID
   */
  const wrapPasteCopiedTile = async (newTileName: string, sourceTileName: string) => {
    if (!tabId || !tabDataActions || !tileActions) return;

    try {
      // Get the ID of the source tile
      const sourceTileId = tabDataActions.getTileId(sourceTileName);
      if (!sourceTileId) {
        throw new Error(`Source tile ${sourceTileName} not found`);
      }

      // Get the source tile data
      const sourceTile = tabDataActions.getPartialTile(sourceTileId);
      if (!sourceTile) {
        throw new Error(`Source tile data for ${sourceTileName} not found`);
      }

      // Generate a UUID for the new tile
      const newTileId = uuidv4();

      // Convert source tile to TileData format
      const sourceTileData = convertTileToTileData(sourceTile as Tile);

      // Update the local state first
      tabDataActions.pasteCopiedTile(newTileName, sourceTileName, {
        ...sourceTile,
        id: newTileId,
        name: newTileName,
      });

      // Convert source tile data to a clean object without excluded properties
      const { id, tabId: _sourceTabId, name, position, type, ...cleanSourceData } = sourceTileData;

      // Create the tile on the server with the generated UUID (use outer tabId which is guaranteed non-null)
      const result = await createTileMutation.mutateAsync({
        tabId: tabId!,
        name: newTileName,
        position: position || {
          x: 0,
          y: 0,
          width: 4,
          height: 4,
        },
        data: cleanSourceData,
        tileId: newTileId,
        type: type,
        actions: tileActions,
      });

      // Copy associated data from React Query cache

      // Copy tableDataItem if this is a table type
      if (type === 'Table' || sourceTile.tableTile) {
        // Get the source tile's tableDataItem from the cache
        const sourceTableDataItem = queryClient.getQueryData(['tableDataItem', sourceTileId]);
        if (sourceTableDataItem) {
          // Set the new tile's tableDataItem in the cache
          queryClient.setQueryData(['tableDataItem', newTileId], sourceTableDataItem);
          debugLog(`Copied tableDataItem from ${sourceTileId} to ${newTileId}`);
        }
      }

      // Copy plotDataItem if this is a plot type
      if (type === 'Plot' || sourceTile.plotTile) {
        // Get the source tile's plotDataItem from the cache
        const sourcePlotDataItem = queryClient.getQueryData(['plotDataItem', sourceTileId]);
        if (sourcePlotDataItem) {
          // Set the new tile's plotDataItem in the cache
          queryClient.setQueryData(['plotDataItem', newTileId], sourcePlotDataItem);
          debugLog(`Copied plotDataItem from ${sourceTileId} to ${newTileId}`);
        }
      }

      debugLog(`Tile ${sourceTileName} copied to ${newTileName} with ID ${newTileId}`);

      return result;
    } catch (error) {
      console.error(`Failed to paste tile ${sourceTileName} to ${newTileName}:`, error);

      // Rollback local state if server creation failed
      tabDataActions.removeTile(newTileName);

      // Inform the user of the error
      if (tabUIActions) {
        console.error(`Failed to paste tile: ${error}`);
      }

      return null;
    }
  };

  /**
   * Remove a context from a tab and all its tiles that use this context
   */
  const wrapRemoveContextFromTab = async (
    context: string,
    setPending?: (pending: boolean) => void
  ) => {
    if (!tabId || !tabActions || !tileActions) return;

    // Check if we have access to the tab data
    if (!tabData || !tabDataActions) {
      return;
    }

    // Set UI states immediately before any operations

    // Call external pending setter if provided
    if (setPending) {
      setPending(true);
    }

    // 1) Update local state immediately
    tabDataActions.removeContextFromTab(context);

    // Update the tab's global context if it matches
    if (tabData.globalContext === context) {
      await updateTabMutation.mutateAsync({
        params: {
          id: tabId,
          data: {
            context: '',
          },
        },
        actions: tabActions,
      });
    }

    // Create a mapping of tileIds to tileNames before the operation
    const tileIds = tabDataActions.getTileIds();
    const tileNames = tabDataActions.getTileNames();

    // Create a tile id to name mapping using the corresponding arrays
    const tileIdToNameMap = new Map<string, string>();
    tileIds.forEach((tileId, index) => {
      if (tileNames[index]) {
        tileIdToNameMap.set(tileId, tileNames[index]);
      }
    });

    // Build bulk updates for tiles that use this context
    const updates: Array<{
      id?: string;
      tabId?: string;
      name?: string;
      updateData: Record<string, any>;
    }> = [];
    tileIds.forEach((id: string, idx: number) => {
      const name = tileNames[idx];
      if (!name) return;
      const tile = tabDataActions.getPartialTile(name);
      if (!tile) return;

      const updateData: { context?: string; columnContext?: string } = {};
      let needsUpdate = false;
      if (tile.context === context) {
        updateData.context = '';
        needsUpdate = true;
      }
      if (tile.columnContext === context) {
        updateData.columnContext = '';
        needsUpdate = true;
      }
      if (needsUpdate) {
        updates.push({ id, updateData });
      }
    });

    if (updates.length) {
      const { errors } = await bulkPatchTiles(updates);
      if (errors?.length) {
        console.warn('[bulkRemoveContext] Partial failures:', errors.length);
      }
    }

    // Refresh the router to update UI with new data
    debugLog('[wrapRemoveContextFromTab] onSettled:', context);
    refreshRouter({
      externalPendingSetters: setPending ? [setPending] : [],
    });
  };

  /**
   * Set global context for a tab
   */
  const wrapGlobalContext = async (
    context: string | undefined,
    setPending?: (pending: boolean) => void
  ) => {
    if (!tabId || !tabActions || !tabDataActions) return;

    // Check if we have access to the tab data
    if (!tabData) {
      return;
    }

    // Set UI states immediately before any operations

    // Call external pending setter if provided
    if (setPending) {
      setPending(true);
    }

    // 1) Update local state immediately
    tabDataActions.setGlobalContext(context);

    // 2) Optimistic server update
    await updateTabMutation.mutateAsync(
      {
        params: {
          id: tabId,
          data: {
            context: context || '',
          },
        },
        actions: tabActions,
      },
      {
        onSettled: async () => {
          // After updating the tab, propagate context to tiles without explicit context
          try {
            const tileIds = tabDataActions.getTileIds();
            const tileNames = tabDataActions.getTileNames();
            const idToName = new Map<string, string>();
            tileIds.forEach((id, idx) => {
              if (tileNames[idx]) idToName.set(id, tileNames[idx]);
            });

            const patchPromises: Promise<any>[] = [];
            if (tileActions) {
              // Use patch so we don't override other fields
              Array.from(idToName.entries()).forEach(([id, name]) => {
                const tile = tabDataActions.getPartialTile(name);
                if (tile && (!tile.context || tile.context === '')) {
                  patchPromises.push(
                    patchTileMutation.mutateAsync({
                      id,
                      updateData: { context: context || '' },
                      actions: tileActions,
                    })
                  );
                }
              });
            }
            await Promise.all(patchPromises);
          } catch (e) {
            console.warn('Failed to propagate tab context to tiles:', e);
          }

          // Refresh the router to update UI with new data
          debugLog('[wrapGlobalContext] onSettled:', context);
          refreshRouter({
            externalPendingSetters: setPending ? [setPending] : [],
          });
        },
      }
    );
  };

  /**
   * Update a tile
   */
  const wrapUpdateTile = (tileId: string, updateData: Partial<TileData>) => {
    if (!tileId || !tabDataActions || !tileActions) return;

    // Determine if we need to reload the page
    let reload = false;
    let setPending = false;
    let setLoading = false;

    const tile = tabDataActions.getPartialTile(tileId);
    const priorType = tile?.type || null;

    if ('type' in updateData && (updateData.type === 'Table' || updateData.type === 'Plot')) {
      reload = true;
      setPending = true;
      setLoading = true;
    } else if (
      'tableType' in updateData ||
      'context' in updateData ||
      'columnContext' in updateData
    ) {
      // Check if the tile is a table tile or a plot tile
      if (tile?.type === 'Table' || tile?.type === 'Plot') {
        reload = true;
        setLoading = true;
      }
    } else if ('autoUpdate' in updateData) {
      // Check if the tile is a table tile or a plot tile
      const tile = tabDataActions.getPartialTile(tileId);
      if (tile?.type === 'Table' || tile?.type === 'Plot') {
        reload = true;
      }
    }

    // Add pending and loading to the zustand state
    let zustandUpdateData: Partial<Tile> = updateData;

    if (setPending) {
      zustandUpdateData = {
        ...zustandUpdateData,
        pending: true,
      };
    }

    if (setLoading) {
      zustandUpdateData = {
        ...zustandUpdateData,
        loading: true,
      };
    }
    // 1) Update local state immediately
    tabDataActions.updateTile(tileId, zustandUpdateData);

    // 2) Optimistic server update
    const scheduleUpdateRetry = () => {
      const attempts = updateRetryAttemptsRef.current[tileId] || 0;
      if (attempts >= 5) return;
      const delay = Math.min(2000 * Math.pow(2, attempts), 30000);
      updateRetryAttemptsRef.current[tileId] = attempts + 1;
      updateRetryTimersRef.current[tileId] = setTimeout(() => {
        updateTileMutation.mutate(
          { id: tileId, data: updateData, actions: tileActions },
          {
            onSuccess: async () => {
              delete updateRetryAttemptsRef.current[tileId];
              clearTimeout(updateRetryTimersRef.current[tileId]);
              delete updateRetryTimersRef.current[tileId];
              tabDataActions.updateTile(tileId, { pending: false, error: null } as any);
              await invalidateAfterTileUpdate({ id: tileId, tabId, priorType, updateData });
            },
            onError: () => {
              tabDataActions.updateTile(tileId, { error: 'Save failed. Retrying…' } as any);
              scheduleUpdateRetry();
            },
            onSettled: async () => {
              if (needsStructuralRefresh(priorType, updateData)) {
                refreshRouter();
              }
            },
          }
        );
      }, delay);
    };

    updateTileMutation.mutate(
      { id: tileId, data: updateData, actions: tileActions },
      {
        onSuccess: async () => {
          tabDataActions.updateTile(tileId, { pending: false, error: null } as any);
          await invalidateAfterTileUpdate({ id: tileId, tabId, priorType, updateData });
        },
        onError: () => {
          tabDataActions.updateTile(tileId, { error: 'Save failed. Retrying…' } as any);
          scheduleUpdateRetry();
        },
        onSettled: async () => {
          if (needsStructuralRefresh(priorType, updateData)) {
            refreshRouter();
          }
        },
      }
    );
  };

  /**
   * Update a tile layout
   */
  const wrapUpdateTileLayout = (tileId: string, layout: TileLayout) => {
    if (!tileId || !tabDataActions || !tileActions) return;

    // 1) Update local state immediately
    tabDataActions.updateTileLayout(tileId, layout);

    // 2) Debounced server update to reduce network chatter during drag/resize/layout recalcs
    const updateData: Partial<TileData> = {
      position: {
        x: layout.x,
        y: layout.y,
        width: layout.w,
        height: layout.h,
      } as TilePosition,
      minW: layout.minW,
      minH: layout.minH,
    };

    pendingLayoutUpdateRef.current[tileId] = updateData;

    const hash = JSON.stringify(updateData.position) + `|${updateData.minW}|${updateData.minH}`;
    if (lastSentLayoutHashRef.current[tileId] === hash) {
      return; // no-op if identical to last sent
    }

    if (layoutDebounceTimersRef.current[tileId]) {
      clearTimeout(layoutDebounceTimersRef.current[tileId]);
    }

    layoutDebounceTimersRef.current[tileId] = setTimeout(() => {
      const payload = pendingLayoutUpdateRef.current[tileId];
      if (!payload) return;
      lastSentLayoutHashRef.current[tileId] =
        JSON.stringify(payload.position) + `|${payload.minW}|${payload.minH}`;
      updateTileMutation.mutate(
        { id: tileId, data: payload, actions: tileActions },
        {
          onError: () => {
            // schedule one retry for layout update; subsequent layout changes will supersede
            setTimeout(() => {
              updateTileMutation.mutate({ id: tileId, data: payload, actions: tileActions });
            }, 1500);
          },
        }
      );
      delete pendingLayoutUpdateRef.current[tileId];
      delete layoutDebounceTimersRef.current[tileId];
    }, 400);
  };

  /**
   * Update a table tile
   */
  const wrapUpdateTableTile = (tileId: string, updateData: Partial<TableTileData>) => {
    if (!tileId || !tabDataActions || !tileActions) return;

    // 1) Update local state immediately
    tabDataActions.updateTableTile(tileId, updateData);

    // Don't attempt server update if we don't have required info
    if (!tileId || !tileActions) return;

    // 2) Optimistic server update
    updateTileMutation.mutate({
      id: tileId,
      data: {
        tableTile: updateData,
      },
      actions: tileActions,
    });
  };

  // Create the enhanced actions object with the wrapped setters
  const syncedDataActions = useMemo<SyncedTabDataActions | null>(() => {
    if (!tabDataActions) return null;

    return {
      ...tabDataActions,
      // Use the specialized wrapper functions for each property
      initTile: wrapInitTile,
      pasteCopiedTile: wrapPasteCopiedTile,
      removeContextFromTab: wrapRemoveContextFromTab,
      renameTile: wrapRenameTile,
      removeTile: wrapRemoveTile,
      updateTile: wrapUpdateTile,
      updateTileLayout: wrapUpdateTileLayout,
      updateTableTile: wrapUpdateTableTile,
      setGlobalContext: wrapGlobalContext,
    } as SyncedTabDataActions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabDataActions]);

  // Create the enhanced actions object with the wrapped setters
  const syncedUIActions = useMemo<TabUIActions | null>(() => {
    if (!tabUIActions) return null;

    return {
      ...tabUIActions,
      // Use the specialized wrapper functions for each property
    } as TabUIActions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabUIActions]);

  // Create the full actions object that incorporates the synced data actions
  const syncedActions = useMemo<SyncedTabActions | null>(() => {
    if (!tabOriginalActions || !syncedDataActions) return null;

    return {
      ...tabOriginalActions,
      data: syncedDataActions,
      ui: syncedUIActions,
    } as SyncedTabActions;
  }, [tabOriginalActions, syncedDataActions, syncedUIActions]);

  // Export setExternalPending to be used by the component
  return {
    actions: syncedActions,
  };
}
