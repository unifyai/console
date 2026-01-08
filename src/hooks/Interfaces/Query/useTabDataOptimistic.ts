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
  mode: 'light' | 'full';  // Indicates whether this is a lightweight prefetch or full build
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

    debugLog(`[buildCompleteTabData] START building tab data for: ${tabName} (ID: ${tabId})`);
    
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
      debugLog('[buildCompleteTabData] Tiles cache check:', {
        tabName,
        tabId: finalTabId,
        cacheHit: !!tilesData,
        cacheValue: tilesData,
        isError: tilesData && typeof tilesData === "object" && Object.keys(tilesData).includes("error"),
        listTiles
      });
      
      if (!tilesData || (typeof tilesData === "object" && Object.keys(tilesData).includes("error"))) {
        if (listTiles === false) {
          debugLog('[buildCompleteTabData] Skipping tile fetch (listTiles=false), using empty array');
          // Skip listing tiles entirely; use empty placeholders (non‑active prefetch)
          tilesData = [] as TileData[];
        } else {
          debugLog('[buildCompleteTabData] Fetching tiles from API for tab:', tabName);
          try {
            const res = await fetch(`/api/tile?tabId=${encodeURIComponent(finalTabId)}&checkpoint=false`, {
              method: "GET",
              signal: signal as AbortSignal,
              cache: "no-store",
            });
            if (!res.ok) throw new Error(`Tiles ${res.status}`);
            const json = await res.json();
            tilesData = Array.isArray(json) ? json as TileData[] : [] as TileData[];
            debugLog('[buildCompleteTabData] Fetched tiles from API:', {
              tabName,
              tileCount: tilesData.length,
              tiles: tilesData.map(t => ({ id: t.id, name: t.name, type: t.type }))
            });
          } catch (err: any) {
            const msg = String(err?.message || err);
            console.error('[buildCompleteTabData] Tile fetch failed:', { tabName, error: msg });
            if ((signal as AbortSignal | undefined)?.aborted || /Abort|aborted|Connection closed/i.test(msg)) {
              throw new CancelledError();
            }
            throw err;
          }
          if (updateCache) {
            debugLog('[buildCompleteTabData] Caching tiles:', { tabName, tileCount: tilesData.length });
            queryClient.setQueryData(["tiles", finalTabId], tilesData);
          }
        }
      } else {
        debugLog('[buildCompleteTabData] Using cached tiles:', {
          tabName,
          tileCount: Array.isArray(tilesData) ? tilesData.length : 0,
          tilesData
        });
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
          mode: 'light',
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

      // Create shared dependencies object (actions removed - now using API routes)
      const dependencies: OptimisticUpdateDependencies = {
        queryClient,
        projectId,
        tabId: finalTabId,
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
              console.log(`[processTile] ${tileData.name}: tableTileIndex=${tableTileIndex}, fieldsArray.length=${fieldsArray.length}, fields=${JSON.stringify(fields ? Object.keys(fields).slice(0, 3) : null)}...`);
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
          const errorMsg = error?.message || 'Failed to load';
          // Don't show toast for "not found" errors - those are expected when context is deleted
          if (!errorMsg.toLowerCase().includes('not found')) {
            showErrorToast(error, `Error processing tile ${tileData.name}`);
          }
          if (tileData.type === 'Table') {
            const isContextNotFound = errorMsg.toLowerCase().includes('not found');
            const tableDataItem = {
              columnContexts: [],
              fields: {} as any,
              totalCount: 0,
              entriesProperties: [],
              paramsProperties: [],
              logs: [],
              params: {} as any,
              isLoading: false,
              error: errorMsg,
              contextNotFound: isContextNotFound,
              newCells: [],
            } as any;
            tileDataItems[tileId] = tableDataItem;
            // Also update the cache so dependency manager sees it
            queryClient.setQueryData(['tableDataItem', tileId], tableDataItem);
            queryClient.refetchQueries({ queryKey: ['internalData', tileId], type: 'active' });
          } else if (tileData.type === 'Plot') {
            // Handle Plot tile errors - store error state so UI can show retry
            const plotDataItem = {
              plotLogs: [],
              plotFields: {} as any,
              error: errorMsg,
              isLoading: false,
            };
            tileDataItems[tileId] = plotDataItem;
            // Update cache so the plot component can display the error
            queryClient.setQueryData(['plotDataItem', tileId], plotDataItem);
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
        mode: 'full',
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