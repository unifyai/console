import { useMemo } from "react";
import { useTabRouterRefresh } from "./useTabRouterRefresh";
import { GranularTabActions, GranularTileActions, TableTileData, TileData, TilePosition, TileLayout } from "@/types/interfaces/grid";
import { useUpdateTabUnifiedQuery } from "@/hooks/Interfaces/Query/useTabsQuery";
import { usePatchTileQuery, useDeleteTileQuery, useUpdateTileQuery, useCreateTileQuery } from "@/hooks/Interfaces/Query/useTilesQuery";
import { useTab } from "../useTab";
import { TabDataActions } from "../useTabData";
import { TabUIActions } from "../useTabUI";
import { v4 as uuidv4 } from 'uuid';
import { convertTileToTileData } from "@/contexts/utils/sliceUtils";
import { Tile } from "@/contexts/slices/selectors/tile";
import { useQueryClient } from "@tanstack/react-query";

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
  tileActions?: GranularTileActions | undefined,
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
        name: tileName
      });

      // Create the default position if not provided
      const { position, type, ...safeInitialState } = initialState;

      // Create the tile on the server with the generated UUID
      const result = await createTileMutation.mutateAsync({
        tab_id: tabId,
        name: tileName,
        position: position || {
          x: 0,
          y: 0,
          width: 4,
          height: 4
        },
        data: safeInitialState,
        tile_id: tileId,
        actions: tileActions
      });

      debugLog(`Tile ${tileName} created with ID ${tileId}`);
      
      return result;
    } catch (error) {
      console.error(`Failed to create tile ${tileName}:`, error);
      
      // Rollback local state if server creation failed
      tabDataActions.removeTile(tileName);
      
      // Inform the user of the error
      if (tabUIActions) {
        console.error(`Failed to create tile ${tileName}: ${error}`);
      }
      
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
        name: newTileName
      },
      actions: tileActions
    });

    // 3) Then update any references to this tile in other tiles
    // Start with updating the `tile.table` property for all tiles that reference this tile by name via the `table` property
    // Optimistically update the referenced tiles on the server
    referencedTileIds.forEach(id => {
      patchTileMutation.mutate({
        id: id,
        updateData: {
          table: newTileName
        },
        actions: tileActions
      });
    });

    // 4) Update x_axis, y_axis, and plot_group_by references for Plot tiles
    // Update x_axis references
    referencedPlotTileIds.xAxis.forEach(id => {
      // Get the tile
      const tile = tabDataActions.getPartialTile(id);
      if (tile?.plotTile) {
        patchTileMutation.mutate({
          id: id,
        updateData: {
          plot_tile: {
            x_axis: tile.plotTile.x_axis // This has already been updated in the zustand renameTile action above
          }
        },
          actions: tileActions
        });
      }
    });

    // Update y_axis references
    referencedPlotTileIds.yAxis.forEach(id => {
      // Get the tile
      const tile = tabDataActions.getPartialTile(id);
      if (tile?.plotTile) {
        patchTileMutation.mutate({
          id: id,
        updateData: {
          plot_tile: {
            y_axis: tile.plotTile.y_axis // This has already been updated in the zustand renameTile action above
          }
        },
          actions: tileActions
        });
      }
    });

    // Update plot_group_by references
    referencedPlotTileIds.plotGroupBy.forEach(id => {
      // Get the tile
      const tile = tabDataActions.getPartialTile(id);
      if (tile?.plotTile) {
        patchTileMutation.mutate({
          id: id,
        updateData: {
          plot_tile: {
            plot_group_by: tile.plotTile.plot_group_by // This has already been updated in the zustand renameTile action above
          }
          },
          actions: tileActions
        });
      }
    });
  };

  /**
   * Remove a tile from a tab
   */
  const wrapRemoveTile = (tileId: string) => {
    if (!tileId || !tabDataActions || !tileActions) return;

    // Get the old tile name
    const oldTileName = tabDataActions.getTileName(tileId);

    if (!oldTileName) return;

    const referencedTileIds = tabDataActions.getReferencedTileIdsByName(oldTileName);
    const referencedPlotTileIds = tabDataActions.getReferencedPlotTileIdsByName(oldTileName);

    // 1) Update local state immediately
    tabDataActions.removeTile(tileId);

    // 2) Optimistic server update
    deleteTileMutation.mutate({
      id: tileId,
      actions: tileActions
    });

    // 3) Then update any references to this tile in other tiles
    // Start with updating the `tile.table` property for all tiles that reference this tile by name via the `table` property
    // Optimistically update the referenced tiles on the server
    referencedTileIds.forEach(id => {
      patchTileMutation.mutate({
        id: id,
        updateData: {
          table: null
        },
        actions: tileActions
      });
    });

    // 4) Update x_axis, y_axis, and plot_group_by references for Plot tiles
    // Update x_axis references
    referencedPlotTileIds.xAxis.forEach(id => {
      // Get the tile
      const tile = tabDataActions.getPartialTile(id);
      if (tile?.plotTile) {
        patchTileMutation.mutate({
          id: id,
        updateData: {
          plot_tile: {
            x_axis: null
          }
        },
          actions: tileActions
        });
      }
    });

    // Update y_axis references
    referencedPlotTileIds.yAxis.forEach(id => {
      // Get the tile
      const tile = tabDataActions.getPartialTile(id);
      if (tile?.plotTile) {
        patchTileMutation.mutate({
          id: id,
        updateData: {
          plot_tile: {
            y_axis: null
          }
        },
          actions: tileActions
        });
      }
    });

    // Update plot_group_by references
    referencedPlotTileIds.plotGroupBy.forEach(id => {
      // Get the tile
      const tile = tabDataActions.getPartialTile(id);
      if (tile?.plotTile) {
        patchTileMutation.mutate({
          id: id,
        updateData: {
          plot_tile: {
            plot_group_by: null
          }
          },
          actions: tileActions
        });
      }
    });
  };

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
        name: newTileName
      });
      
      // Convert source tile data to a clean object without excluded properties
      const { id, tab_id, name, position, type, ...cleanSourceData } = sourceTileData;
      
      // Create the tile on the server with the generated UUID
      const result = await createTileMutation.mutateAsync({
        tab_id: tabId,
        name: newTileName,
        position: position || {
          x: 0,
          y: 0,
          width: 4,
          height: 4
        },
        data: cleanSourceData,
        tile_id: newTileId,
        type: type,
        actions: tileActions
      });
      
      // Copy associated data from React Query cache
      
      // Copy tableDataItem if this is a table type
      if (type === 'Table' || sourceTile.tableTile) {
        // Get the source tile's tableDataItem from the cache
        const sourceTableDataItem = queryClient.getQueryData(["tableDataItem", sourceTileId]);
        if (sourceTableDataItem) {
          // Set the new tile's tableDataItem in the cache
          queryClient.setQueryData(["tableDataItem", newTileId], sourceTableDataItem);
          debugLog(`Copied tableDataItem from ${sourceTileId} to ${newTileId}`);
        }
      }
      
      // Copy plotDataItem if this is a plot type
      if (type === 'Plot' || sourceTile.plotTile) {
        // Get the source tile's plotDataItem from the cache
        const sourcePlotDataItem = queryClient.getQueryData(["plotDataItem", sourceTileId]);
        if (sourcePlotDataItem) {
          // Set the new tile's plotDataItem in the cache
          queryClient.setQueryData(["plotDataItem", newTileId], sourcePlotDataItem);
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
  const wrapRemoveContextFromTab = async (context: string, setPending?: (pending: boolean) => void) => {
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
            global_context: ""
          }
        },
        actions: tabActions
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

    // Update all tiles in the tab that use this context
    const promises = tileIds.map(async (tileId: string) => {
      // Get the tile name from our mapping
      const tileName = tileIdToNameMap.get(tileId);
      
      if (tileName) {
        // Get tile using the provided tile name
        const tile = tabDataActions.getPartialTile(tileName);
        
        if (tile) {
          const updates: { context?: string; column_context?: string } = {};
          let needsUpdate = false;
          
          if (tile.context === context) {
            updates.context = "";
            needsUpdate = true;
          }
          
          if (tile.column_context === context) {
            updates.column_context = "";
            needsUpdate = true;
          }
          
          if (needsUpdate && tileActions) {
            return patchTileMutation.mutateAsync({
              tab_id: tabId,
              name: tileName,
              updateData: updates,
              actions: tileActions
            });
          }
        }
      }
      
      return Promise.resolve();
    });
    
    // Wait for all updates to complete
    await Promise.all(promises);
      
    // Refresh the router to update UI with new data
    debugLog("[wrapRemoveContextFromTab] onSettled:", context);
    refreshRouter({
      externalPendingSetters: setPending ? [setPending] : []
    });
  };

  /**
   * Set global context for a tab
   */
  const wrapGlobalContext = async (context: string | undefined, setPending?: (pending: boolean) => void) => {
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
    await updateTabMutation.mutateAsync({
      params: {
        id: tabId,
        data: {
          global_context: context || ""
        }
      },
      actions: tabActions
    }, {
      onSettled: () => {
        // Refresh the router to update UI with new data
        debugLog("[wrapGlobalContext] onSettled:", context);
        refreshRouter({
          externalPendingSetters: setPending ? [setPending] : []
        });
      }
    });
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

    if ("type" in updateData && (updateData.type === "Table" || updateData.type === "Plot")) {
      reload = true;
      setPending = true;
      setLoading = true;
    }
    else if (("table_type" in updateData) || ("context" in updateData) || ("column_context" in updateData)) {
      // Check if the tile is a table tile or a plot tile
      if (tile?.type === "Table" || tile?.type === "Plot") {
        reload = true;
        setLoading = true;
      }
    }
    else if ("auto_update" in updateData) {
      // Check if the tile is a table tile or a plot tile
      const tile = tabDataActions.getPartialTile(tileId);
      if (tile?.type === "Table" || tile?.type === "Plot") {
        reload = true;
      }
    }

    // Add pending and loading to the zustand state
    let zustandUpdateData: Partial<Tile> = updateData;

    if (setPending) {
      zustandUpdateData = {
        ...zustandUpdateData,
        pending: true,
      }
    }

    if (setLoading) {
      zustandUpdateData = {
        ...zustandUpdateData,
        loading: true,
      }
    }
    // 1) Update local state immediately
    tabDataActions.updateTile(tileId, zustandUpdateData);

    // 2) Optimistic server update
    updateTileMutation.mutate({
      id: tileId,
      data: updateData,
      actions: tileActions
    }, {
      onSettled: () => {
        if (reload) {
          refreshRouter();
        }
      }
    }); 
  };

  /**
   * Update a tile layout
   */
  const wrapUpdateTileLayout = (tileId: string, layout: TileLayout) => {
    if (!tileId || !tabDataActions || !tileActions) return;

    // 1) Update local state immediately
    tabDataActions.updateTileLayout(tileId, layout);

    // 2) Optimistic server update
    // Unpack the layout into Parital<TileData>
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

    // Update the tile layout on the server
    updateTileMutation.mutate({
      id: tileId,
      data: updateData,
      actions: tileActions
    });
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
        table_tile: updateData
      },
      actions: tileActions
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
      setGlobalContext: wrapGlobalContext
    } as SyncedTabDataActions;
  }, [
    tabDataActions,
    tabId,
    tabActions,
    tileActions
  ]);

  // Create the enhanced actions object with the wrapped setters
  const syncedUIActions = useMemo<TabUIActions | null>(() => {
    if (!tabUIActions) return null;

    return {
      ...tabUIActions,
      // Use the specialized wrapper functions for each property
    } as TabUIActions;
  }, [
    tabUIActions,
    tabId,
    tabActions,
    tileActions
  ]);

  // Create the full actions object that incorporates the synced data actions
  const syncedActions = useMemo<SyncedTabActions | null>(() => {
    if (!tabOriginalActions || !syncedDataActions) return null;

    return {
      ...tabOriginalActions,
      data: syncedDataActions,
      ui: syncedUIActions
    } as SyncedTabActions;
  }, [tabOriginalActions, syncedDataActions, syncedUIActions]);

  // Export setExternalPending to be used by the component
  return {
    actions: syncedActions,
  };
}