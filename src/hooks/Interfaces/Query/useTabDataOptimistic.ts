"use client";

import { useQueryClient, CancelledError } from "@tanstack/react-query";
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
} from "@/types/interfaces/grid";
import { 
  LogFieldsResponseProps, 
  TableArguments, 
  PlotArguments 
} from "@/types/interfaces/logs";
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
import { showErrorToast } from "@/components/Common/Toasts/notifications";

/**
 * Debug flag for tab prefetching logging
 * Set NEXT_PUBLIC_DEBUG_TAB_PREFETCHING=true to enable detailed prefetching logs
 */
const DEBUG_TAB_PREFETCHING = process.env.NEXT_PUBLIC_DEBUG_TAB_PREFETCHING === 'true';

/**
 * Conditional debug logger for tab prefetching
 */
const debugLog = (...args: any[]) => {
  if (DEBUG_TAB_PREFETCHING) {
    console.log(...args);
  }
};

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
      /**
       * When true, the function will perform a lightweight initialisation that only
       * fetches tab-level metadata (tiles, basic store state etc.).
       * Heavy per-tile processing (logs, fields, arguments, metrics …) is skipped so that
       * the UI can start rendering much sooner.  Individual tiles are expected to build
       * their own data progressively further down the component tree.
       */
      skipTileData?: boolean;
      signal?: AbortSignal;
      /**
       * When false, do not issue a tiles list request. Useful for non‑active tab
       * prefetch where we only want metadata placeholders and want to avoid
       * generating server‑action POSTs that show as 500 on abort.
       */
      listTiles?: boolean;
    } = {}
  ): Promise<CompleteTabData> => {
    const {
      refetchProjects = false,
      refetchContexts = false,
      refetchFields = true,
      updateCache = true,
      skipTileData = false,
      signal,
      listTiles = true,
    } = options;

    debugLog(`[buildCompleteTabData] Building complete tab data for: ${tabName} (ID: ${tabId})`);
    
    try {      
      // Find the specific tab by tabId and tabName (not the active tab)
      const state = storeApi.getState();
      const tabState = selectTabById(state, tabId);
      let targetTab = convertTabToTabData(tabState);
      if (!targetTab) {
        const tabState = selectTabByName(state, interfaceId, tabName);
        targetTab = convertTabToTabData(tabState);
        if (!targetTab) {
          throw new Error(`Tab not found: ${tabName} (ID: ${tabId}) in interface ${interfaceId}`);
        }
      }

      // Use the target tab's ID
      const finalTabId = targetTab.id!;

      // Get or fetch tiles for the target tab
      let tilesData = queryClient.getQueryData(["tiles", finalTabId]) as TileData[] | undefined;
      if (!tilesData || (typeof tilesData === "object" && Object.keys(tilesData).includes("error"))) {
        if (listTiles === false) {
          // Skip listing tiles entirely; use empty placeholders (non‑active prefetch)
          tilesData = [] as TileData[];
        } else {
          try {
            const res = await fetch(`/api/tile?tab_id=${encodeURIComponent(finalTabId)}&checkpoint=false`, {
              method: "GET",
              signal: signal as AbortSignal,
              cache: "no-store",
            });
            if (!res.ok) throw new Error(`Tiles ${res.status}`);
            const json = await res.json();
            tilesData = Array.isArray(json) ? json as TileData[] : [] as TileData[];
          } catch (err: any) {
            const msg = String(err?.message || err);
            if ((signal as AbortSignal | undefined)?.aborted || /Abort|aborted|Connection closed/i.test(msg)) {
              throw new CancelledError();
            }
            throw err;
          }
          if (updateCache) {
            queryClient.setQueryData(["tiles", finalTabId], tilesData);
          }
        }
      }

      // Filter tiles by type (matching TabWrapper.server.tsx)
      const safeTilesData: TileData[] = Array.isArray(tilesData) ? tilesData : [];
      const tableTilesData = safeTilesData.filter(t => t.type === "Table");
      const plotTilesData = safeTilesData.filter(t => t.type === "Plot");

      /* ------------------------------------------------------------------
       * FAST-PATH: lightweight mode – just populate store & cache basics
       * ------------------------------------------------------------------ */
      if (skipTileData) {

        return {
          // Tab level data
          tabData: targetTab,
          tiles: safeTilesData,
          tableTiles: tableTilesData,
          plotTiles: plotTilesData,
          // Light-weight placeholders – will be filled progressively by individual tiles
          fields: [],
          tableArguments: {} as TableArguments,
          plotArguments: {} as PlotArguments,

          // No tile-specific data yet
          tileDataItems: {},
        } as CompleteTabData;
      }

      // Create shared dependencies object
      const dependencies: OptimisticUpdateDependencies = {
        queryClient,
        projectId,
        tabId: finalTabId,
        projectsActions: actions.projectsActions,
        contextActions: actions.contextActions,
        fieldsActions: actions.fieldsActions,
        logsActions: actions.logsActions,
        signal,
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
        tableTilesData,
        optimisticOptions
      );

      // Update store state using shared utility
      updateStoreWithFreshData(storeApi, projectId, projects, contexts, optimisticOptions);

      // Update tab arguments using shared utility
      const { tableArguments, plotArguments } = await updateTabArguments(
        dependencies,
        safeTilesData,
        fieldsArray,
        optimisticOptions
      );

      // ===== STEP 2: Individual tile wrapper logic =====
      
      const tileDataItems: Record<string, TableDataItem | PlotDataItem> = {};

      // Process tiles with small concurrency cap to avoid flooding
      const concurrencyCap = 3;
      let index = 0;
      const processTile = async (tileData: TileData) => {
        const tileId = tileData.id!;
        try {
          switch (tileData.type) {
            case "Table": {
              const tableTileIndex = tableTilesData.findIndex(t => t.id === tileId);
              if (tableTileIndex === -1) throw new Error(`Table tile not found: ${tileId}`);
              const fields = fieldsArray[tableTileIndex];
              const tableDataItem = await buildOptimisticTableDataItem(
                dependencies,
                tileData,
                fields,
                tableArguments,
                optimisticOptions
              );
              tileDataItems[tileId] = tableDataItem;
              break;
            }
            case "Plot": {
              const plotDataItem = await buildOptimisticPlotDataItem(
                dependencies,
                tileData,
                tableTilesData,
                plotArguments,
                fieldsArray,
                optimisticOptions
              );
              tileDataItems[tileId] = plotDataItem;
              break;
            }
            case "View":
            case "Editor":
              // No additional processing
              break;
          }
        } catch (error: any) {
          showErrorToast(error, `Error processing tile ${tileData.name}`);
          if (tileData.type === 'Table') {
            tileDataItems[tileId] = {
              columnContexts: [],
              fields: {} as any,
              totalCount: 0,
              entriesProperties: [],
              paramsProperties: [],
              logs: [],
              params: {} as any,
              isLoading: false,
              error: error?.message || 'Failed to load',
              newCells: [],
            } as any;
          }
        }
      };

      const workers: Promise<void>[] = [];
      const runNext = async () => {
        if (index >= safeTilesData.length) return;
        const current = index++;
        await processTile(safeTilesData[current]);
        return runNext();
      };
      for (let i = 0; i < Math.min(concurrencyCap, safeTilesData.length); i++) {
        workers.push(runNext());
      }
      await Promise.all(workers);

      return {
        // Tab level data
        tabData: targetTab,
        tiles: safeTilesData,
        tableTiles: tableTilesData,
        plotTiles: plotTilesData,
        fields: fieldsArray,
        tableArguments,
        plotArguments,
        
        // Tile-specific data
        tileDataItems,
      };
      
    } catch (error: any) {
      // Propagate cancellations explicitly so React Query marks them as canceled, not errors
      const msg = String(error?.message || error);
      if (error instanceof CancelledError || /Abort|aborted|Connection closed/i.test(msg)) {
        throw new CancelledError();
      }
      console.error(`[buildCompleteTabData] Error building complete tab data for ${tabName} (ID: ${tabId}):`, error);
      throw error;
    }
  }, [queryClient, storeApi]);

  return {
    buildCompleteTabData,
  };
} 