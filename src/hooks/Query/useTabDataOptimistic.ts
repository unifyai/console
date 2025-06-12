"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { 
  TabData, 
  TileData, 
  GranularTabActions, 
  GranularTileActions, 
  FieldsActions, 
  LogsActions,
  ProjectsActions,
  ContextActions,
  TableDataItem,
  PlotDataItem
} from "@/types/evals/grid";
import { 
  LogFieldsResponseProps, 
  TableArguments, 
  PlotArguments 
} from "@/types/evals/logs";
import { buildTabStateForStore, buildTileStateForStore } from "@/contexts/utils/stateBuilderUtils";
import { IStoreState } from "@/contexts/store";
import { useStoreApiContext } from "@/contexts/providers/StoreProvider";
import { 
  fetchProjectsContextsFields,
  updateTabArguments,
  buildOptimisticTableDataItem,
  buildOptimisticPlotDataItem,
  updateStoreWithFreshData,
  OptimisticUpdateDependencies,
  OptimisticUpdateOptions
} from '@/utils/data/buildServerDataOptimistic';
import { selectTabById, selectTabByName } from "@/contexts/selectors/tab";
import { convertTabToTabData } from "@/contexts/utils/sliceUtils";

type TabDataActions = {
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  fieldsActions: FieldsActions;
  logsActions: LogsActions;
  projectsActions: ProjectsActions;
  contextActions: ContextActions;
};

export type CompleteTabData = {
  // Tab level data (from TabWrapper.server.tsx)
  tabData: TabData;
  tiles: TileData[];
  tableTiles: TileData[];
  plotTiles: TileData[];
  fields: LogFieldsResponseProps[];
  tableArguments: TableArguments;
  plotArguments: PlotArguments;
  
  // Store state (from TabWrapper.server.tsx)
  tabState: Partial<IStoreState>;
  tileState: Partial<IStoreState>;
  
  // Tile-specific data (from each tile wrapper)
  tileDataItems: Record<string, TableDataItem | PlotDataItem>;
};

/**
 * Hook for building complete tab data optimistically on the client side
 * Replicates the complete RSC tree logic from TabWrapper.server.tsx and all tile wrappers
 * Uses query client for caching and reuses existing utilities
 */
export function useTabDataOptimistic() {
  const queryClient = useQueryClient();
  const storeApi = useStoreApiContext();

  /**
   * Build complete tab data for a specific tab
   */
  const buildCompleteTabData = useCallback(async (
    interfaceId: string,
    tabId: string,
    tabName: string,
    projectId: string,
    actions: TabDataActions,
    options: {
      refetchProjects?: boolean;
      refetchContexts?: boolean;
      refetchFields?: boolean;
      updateCache?: boolean;
    } = {}
  ): Promise<CompleteTabData> => {
    const {
      refetchProjects = false,
      refetchContexts = false,
      refetchFields = true,
      updateCache = true
    } = options;

    console.log(`[buildCompleteTabData] Building complete tab data for: ${tabName} (ID: ${tabId})`);
    
    try {      
      // Find the specific tab by tabId and tabName (not the active tab)
      const state = storeApi.getState();
      let targetTab = convertTabToTabData(selectTabById(state, tabId));
      if (!targetTab) {
        targetTab = convertTabToTabData(selectTabByName(state, interfaceId, tabName));
        if (!targetTab) {
          throw new Error(`Tab not found: ${tabName} (ID: ${tabId}) in interface ${interfaceId}`);
        }
      }

      // Use the target tab's ID
      const finalTabId = targetTab.id!;

      // Get or fetch tiles for the target tab
      let tiles = queryClient.getQueryData(["tiles", finalTabId]) as TileData[] | undefined;
      if (!tiles || typeof tiles === "object") {
        tiles = await actions.tileActions.list(finalTabId, undefined, false);
        if (updateCache) {
          queryClient.setQueryData(["tiles", finalTabId], tiles);
        }
      }

      // Filter tiles by type (matching TabWrapper.server.tsx)
      // TODO: Desperate fallback for when tiles is an object.
      // Need to investigate why this happens sometimes.
      if (typeof tiles === "object") {
        tiles = [];
      }
      const tableTiles = tiles.filter(t => t.type === "Table");
      const plotTiles = tiles.filter(t => t.type === "Plot");

      // Create shared dependencies object
      const dependencies: OptimisticUpdateDependencies = {
        queryClient,
        projectId,
        tabId: finalTabId,
        projectsActions: actions.projectsActions,
        contextActions: actions.contextActions,
        fieldsActions: actions.fieldsActions,
        logsActions: actions.logsActions,
      };

      const optimisticOptions: OptimisticUpdateOptions = {
        refetchProjects,
        refetchContexts,
        refetchFields,
        updateCache,
      };

      // Fetch projects, contexts, and fields using shared utility
      const { projects, contexts, fieldsArray } = await fetchProjectsContextsFields(
        dependencies,
        tableTiles,
        optimisticOptions
      );

      // Update store state using shared utility
      updateStoreWithFreshData(storeApi, projectId, projects, contexts, optimisticOptions);

      // Update tab arguments using shared utility
      const { tableArguments, plotArguments } = await updateTabArguments(
        dependencies,
        tiles,
        fieldsArray,
        optimisticOptions
      );

      // ===== STEP 2: Individual tile wrapper logic =====
      
      const tileDataItems: Record<string, TableDataItem | PlotDataItem> = {};

      // Process each tile based on its type
      for (const tile of tiles) {
        const tileId = tile.id!;
        
        try {
          switch (tile.type) {
            case "Table":
              const tableDataItem = await buildOptimisticTableDataItem(
                dependencies,
                tile,
                fieldsArray,
                tableArguments,
                optimisticOptions
              );
              tileDataItems[tileId] = tableDataItem;
              break;
              
            case "Plot":
              const plotDataItem = await buildOptimisticPlotDataItem(
                dependencies,
                tile,
                tableTiles,
                plotArguments,
                fieldsArray,
                optimisticOptions
              );
              tileDataItems[tileId] = plotDataItem;
              break;
              
            case "View":
            case "Editor":
              // Simple wrappers - no additional processing needed
              break;
          }
        } catch (error) {
          console.error(`[buildCompleteTabData] Error processing tile ${tileId}:`, error);
          // Continue processing other tiles
        }
      }

      return {
        // Tab level data
        tabData: targetTab,
        tiles,
        tableTiles,
        plotTiles,
        fields: fieldsArray,
        tableArguments,
        plotArguments,
        
        // Store state
        tabState: buildTabStateForStore(
          targetTab,
          targetTab.active || false, // Use the tab's actual active state
          interfaceId,
          tiles.map(tile => tile.id || ''),
          tiles.map(tile => tile.name || '')
        ),
        tileState: buildTileStateForStore(tiles, finalTabId),
        
        // Tile-specific data
        tileDataItems,
      };
      
    } catch (error) {
      console.error(`[buildCompleteTabData] Error building complete tab data for ${tabName} (ID: ${tabId}):`, error);
      throw error;
    }
  }, [queryClient, storeApi]);

  return {
    buildCompleteTabData,
  };
} 