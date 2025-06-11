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
   * Replicates TabWrapper.server.tsx + all tile wrapper logic
   */
  const buildCompleteTabData = useCallback(async (
    interfaceId: string,
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

    console.log(`[buildCompleteTabData] Building complete tab data for: ${tabName}`);
    
    try {
      // ===== STEP 1: TabWrapper.server.tsx logic =====
      
      // Get or fetch tabs
      let allTabs = queryClient.getQueryData(["tabs", interfaceId]) as TabData[] | undefined;
      if (!allTabs) {
        allTabs = await actions.tabActions.list(interfaceId, false);
        if (updateCache) {
          queryClient.setQueryData(["tabs", interfaceId], allTabs);
        }
      }

      // Find the current tab (matching TabWrapper.server.tsx logic)
      let activeTab: TabData | null = null;
      if (tabName) {
        activeTab = allTabs.find(t => t.name === tabName) || null;
      }
      if (!activeTab) {
        activeTab = allTabs.find(t => t.active) || null;
      }
      if (!activeTab && allTabs.length > 0) {
        activeTab = allTabs[0];
      }
      if (!activeTab) {
        throw new Error(`No tabs found for interface ${interfaceId}`);
      }

      const tabId = activeTab.id || "";
      if (!tabId) {
        throw new Error(`Tab ${tabName} has no ID`);
      }

      // Get or fetch tiles for the active tab
      let tiles = queryClient.getQueryData(["tiles", tabId]) as TileData[] | undefined;
      if (!tiles) {
        tiles = await actions.tileActions.list(tabId, undefined, false);
        if (updateCache) {
          queryClient.setQueryData(["tiles", tabId], tiles);
        }
      }

      // Filter tiles by type (matching TabWrapper.server.tsx)
      const tableTiles = tiles.filter(t => t.type === "Table");
      const plotTiles = tiles.filter(t => t.type === "Plot");

      // Create shared dependencies object
      const dependencies: OptimisticUpdateDependencies = {
        queryClient,
        projectId,
        tabId,
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
        tabData: activeTab,
        tiles,
        tableTiles,
        plotTiles,
        fields: fieldsArray,
        tableArguments,
        plotArguments,
        
        // Store state
        tabState: buildTabStateForStore(
          activeTab,
          true, // isActive
          interfaceId,
          tiles.map(tile => tile.id || ''),
          tiles.map(tile => tile.name || '')
        ),
        tileState: buildTileStateForStore(tiles, tabId),
        
        // Tile-specific data
        tileDataItems,
      };
      
    } catch (error) {
      console.error(`[buildCompleteTabData] Error building complete tab data for ${tabName}:`, error);
      throw error;
    }
  }, [queryClient, storeApi]);

  return {
    buildCompleteTabData,
  };
} 