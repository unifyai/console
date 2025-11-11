"use client";

import { useMutation } from '@tanstack/react-query';
import { 
  GranularTileActions, 
  TileData, 
  TableDataItem, 
  PlotDataItem,
  LogsActions,
  FieldsActions,
  TilePosition,
  ContextActions,
  ProjectsActions
} from '@/types/interfaces/grid';
import { 
  LogFieldsResponseProps, 
  TableArguments, 
  PlotArguments 
} from '@/types/interfaces/logs';
import { useQueryClient } from "@tanstack/react-query";
import { fetchAndBuildTableDataItem } from '@/utils/data/buildTableDataItem';
import { buildPlotDataItem, getUsedTableNames } from '@/utils/data/buildPlotDataItem';
import { buildTabArguments } from '@/utils/arguments/buildTabArguments';
import { useStoreApiContext } from '@/contexts/providers/StoreProvider';
import { selectTilesForTab } from '@/contexts/selectors/tile';
import { convertTileToTileData } from '@/contexts/utils/sliceUtils';
// Note: Avoid heavy blocking fetches inside onMutate. We rely on cache and do
// opportunistic background prefetches where helpful.
import { selectProjectById } from '@/contexts/selectors/project';
import { buildAvailableFieldsForTile } from '@/utils/arguments/buildTableArguments';
import { Tile } from '@/contexts/slices/selectors/tile';
import { showErrorToast } from '@/components/Common/Toasts/notifications';

/**
 * Debug flag for performance logging
 * Set NEXT_PUBLIC_DEBUG_PERFORMANCE=true to enable detailed performance timing logs
 */
const DEBUG_PERFORMANCE = process.env.NEXT_PUBLIC_DEBUG_PERFORMANCE === 'true';

/**
 * Conditional debug logger for performance metrics
 */
const perfLog = (...args: any[]) => {
  if (DEBUG_PERFORMANCE) {
    console.log(...args);
  }
};

/**
 * Hook to patch a tile with optimistic updates that cascade to related data
 * This is an enhanced version of usePatchTileQuery that handles:
 * 1. For Table tiles: rebuilds TableDataItem and updates the cache
 * 2. Updates tab arguments for both table and plot tiles
 * 3. For plot tiles that depend on the updated table: rebuilds PlotDataItem
 */
export function usePatchTileQueryOptimistic() {
  const queryClient = useQueryClient();
  
  // Get the store API reference - can be used to get state outside of React's render cycle
  const storeApi = useStoreApiContext();
  
  return useMutation({
    mutationFn: async ({ 
      id,
      tab_id, 
      name, 
      projectId,
      updateData,
      refetchProjects = false,
      refetchContexts = false,
      refetchFields = true,
      rebuildTableData = true,
      rebuildPlotData = true,
      actions,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions
    }: { 
      id: string;
      tab_id: string; 
      name: string;
      projectId: string;
      updateData: {
        name?: string;
        position?: TilePosition;
        minW?: number;
        minH?: number;
        visible?: boolean;
        locked?: boolean;
        moved?: boolean;
        static?: boolean;
        color?: string;
        context?: string;
        table?: string;
        auto_update?: string;
        freeze?: string;
        filters?: string;
        common_filter?: string;
        metric?: string;
        column_context?: string;
        grouping?: string;
      };
      refetchProjects: boolean;
      refetchContexts: boolean;
      refetchFields: boolean;
      rebuildTableData: boolean;
      rebuildPlotData: boolean;
      actions: GranularTileActions;
      projectsActions: ProjectsActions;
      contextActions: ContextActions;
      logsActions: LogsActions;
      fieldsActions: FieldsActions;
    }) => {
      if (id) {
        return actions.patchById(id, updateData);
      } else if (tab_id && name) {
        return actions.patchByName(tab_id, name, updateData);
      } else {
        throw new Error("Invalid arguments");
      }
    },
    
    onMutate: async (variables) => {
      const { 
        id,
        tab_id, 
        name, 
        projectId,
        updateData, 
        refetchProjects,
        refetchContexts,
        refetchFields,
        rebuildTableData,
        rebuildPlotData,
        actions,
        projectsActions,
        contextActions,
        logsActions,
        fieldsActions,
      } = variables;

      // High-level timer for the whole onMutate path
      const t0 = performance.now();
      
      if (!tab_id) {
        throw new Error("tab_id is required for optimistic updates");
      }
      
      // Get actual query key
      const tileKey = id ? ['tile-by-id', id] : ['tile', tab_id, name];
      
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      const tCancel = performance.now();
      await queryClient.cancelQueries({ queryKey: tileKey });
      perfLog(
        `[perf] onMutate(${name}) – cancelQueries: ${(
          performance.now() - tCancel
        ).toFixed(2)} ms`
      );
      
      // Get the previous tile data
      const tUpdateCache = performance.now();
      const previousTiles = queryClient.getQueryData<TileData[]>(['tiles', tab_id]);

      // Get fresh data from Zustand using the pure selectors
      const state = storeApi.getState();
      const projectData = selectProjectById(state, projectId);
      const tilesInTab = selectTilesForTab(state, tab_id);
      const tilesInTabData = tilesInTab.map(tile => convertTileToTileData(tile));
      const tableTilesData = tilesInTabData.filter(tile => tile.type === "Table");
      const plotTilesData = tilesInTabData.filter(tile => tile.type === "Plot");

      let optimisticTile: Tile | null = null;
      let optimisticTileData: TileData | null = null;

      if (id) {
        optimisticTile = tilesInTab.find(tile => tile.id === id) as Tile;
        optimisticTileData = tilesInTabData.find(tileData => tileData.id === id) as TileData;
      } else if (tab_id && name) {
        optimisticTile = tilesInTab.find(tile => tile.tabId === tab_id && tile.name === name) as Tile;
        optimisticTileData = tilesInTabData.find(tileData => tileData.tab_id === tab_id && tileData.name === name) as TileData;
      }

      const tileType = optimisticTileData?.type;
      
      // Update the tiles list in the cache
      queryClient.setQueryData(['tiles', tab_id], tilesInTabData);
      perfLog(
        `[perf] onMutate(${name}) – set tiles cache: ${(
          performance.now() - tUpdateCache
        ).toFixed(2)} ms`
      );

      // Avoid blocking network calls here; use cache only.
      // If callers requested refetches, trigger them in the background without awaiting.
      try {
        if (refetchProjects) {
          queryClient.prefetchQuery({
            queryKey: ["projects"],
            queryFn: async () => {
              const res = await fetch('/api/projects', { method: 'GET', cache: 'no-store' });
              if (!res.ok) throw new Error(`Projects ${res.status}`);
              return res.json();
            },
          });
        }
        if (refetchContexts && projectId) {
          queryClient.prefetchQuery({
            queryKey: ["contexts", projectId],
            queryFn: async () => {
              const res = await fetch(`/api/context/${encodeURIComponent(projectId)}`, { method: 'GET', cache: 'no-store' });
              if (!res.ok) throw new Error(`Contexts ${res.status}`);
              return res.json();
            },
          });
        }
      } catch {}

      // Resolve fields for table tiles from cache only to stay non-blocking
      const fieldsArray: LogFieldsResponseProps[] = tableTilesData.map((t) =>
        (queryClient.getQueryData<LogFieldsResponseProps>(["fields", projectId, t.context ?? null]) || {}) as LogFieldsResponseProps
      );
      // Opportunistically prefetch missing fields in the background when asked
      if (refetchFields) {
        tableTilesData.forEach((t, idx) => {
          const cached = fieldsArray[idx];
          const context = t.context ?? null;
          if (context && (!cached || Object.keys(cached).length === 0)) {
            queryClient.prefetchQuery({
              queryKey: ["fields", projectId, context],
              queryFn: async () => {
                const url = `/api/logs/fields?project=${encodeURIComponent(projectId)}&context=${encodeURIComponent(context)}`;
                const res = await fetch(url, { method: 'GET', cache: 'no-store' });
                if (!res.ok) throw new Error(`Fields ${res.status}`);
                return res.json();
              },
            }).catch(() => {});
          }
        });
      }

      // Get existing table and plot arguments from cache
      const tBuildArgs = performance.now();
      const existingTableArgs = queryClient.getQueryData<TableArguments>(['tableArguments', tab_id]) || {} as TableArguments;
      const existingPlotArgs = queryClient.getQueryData<PlotArguments>(['plotArguments', tab_id]) || {} as PlotArguments;

      // Build arguments for all tiles using cache-only fields
      if (tableTilesData.length > 0 || plotTilesData.length > 0) {
        const { tableArguments: newTableArguments, plotArguments: newPlotArguments } = 
        buildTabArguments(tilesInTabData, fieldsArray, existingTableArgs, existingPlotArgs);

        // Store the built arguments in the cache
        queryClient.setQueryData(["tableArguments", tab_id], newTableArguments);
        queryClient.setQueryData(["plotArguments", tab_id], newPlotArguments);
        
      } else {
  
        // Initialize empty arguments if no tiles
        queryClient.setQueryData(["tableArguments", tab_id], {});
        queryClient.setQueryData(["plotArguments", tab_id], {});
      }
      perfLog(
        `[perf] onMutate(${name}) – buildTabArguments: ${(
          performance.now() - tBuildArgs
        ).toFixed(2)} ms`
      );
        
      // Step 1: If it's a Table tile, rebuild its TableDataItem and update the cache
      if (tileType === "Table" && rebuildTableData) {
        try {

          // Get fields from cache
          const fields = queryClient.getQueryData<LogFieldsResponseProps>(["fields", projectId, optimisticTileData?.context]) || {} as LogFieldsResponseProps;
          
          // Build the new TableDataItem
          if (optimisticTileData && optimisticTile) {
            // Get infinite query keys from the store
            const infiniteQueryKeys = optimisticTile?.tableTile?.infiniteQueryKeys || [];

            const tTableDataItem = performance.now();
            const tableDataItem = await fetchAndBuildTableDataItem(
              optimisticTileData,
              fields,
              projectId,
              logsActions,
              queryClient,
              infiniteQueryKeys,
              undefined, // previousLogs
              undefined // signal
            );
            perfLog(
              `[perf] onMutate(${name}) – fetchAndBuildTableDataItem: ${(
                performance.now() - tTableDataItem
              ).toFixed(2)} ms`
            );

            // Update available fields in the tableArguments (if we have tableArguments for this tile)
            const tableArguments = queryClient.getQueryData<TableArguments>(["tableArguments", tab_id]) || {} as TableArguments;
            if (tableArguments[optimisticTileData.name]) {
              tableArguments[optimisticTileData.name].available_fields = buildAvailableFieldsForTile(
                optimisticTileData.column_context ?? "",
                fields,
                tableDataItem.entriesProperties,
                tableDataItem.paramsProperties
              );
      
              // Update the cache with available fields
              queryClient.setQueryData(["tableArguments", tab_id], tableArguments);
            }
          
            // Update the TableDataItem in the cache
            queryClient.setQueryData(['tableDataItem', optimisticTileData.id], tableDataItem);
          }
        } catch (error) {
          console.error("Error building optimistic TableDataItem:", error);
        }
      }
      
      try {
        // Step 3: For plot tiles that depend on this table, rebuild their PlotDataItem
        if ((tileType === 'Table' || plotTilesData.length > 0) && rebuildPlotData) {
          // Determine which plot tiles need to be updated
          let plotTilesToUpdate: TileData[] = [];
          
          if (tileType === 'Table') {
            // If we're updating a table, look for plots that use this table
            const tileName = optimisticTileData?.name;
            plotTilesToUpdate = plotTilesData.filter(plotTile => {
              const usedTables = getUsedTableNames(plotTile);
              return usedTables.includes(tileName as string);
            });
          } else if (tileType === 'Plot') {
            // If we're updating a plot that affects plot data, just update that plot
            if (optimisticTileData) {
              plotTilesToUpdate = [optimisticTileData as TileData];
            }
          }
          
          // Update each plot that needs updating
          const tPlotDataItem = performance.now();
          const plotArguments = queryClient.getQueryData<PlotArguments>(['plotArguments', tab_id]) || {} as PlotArguments;
          for (const plotTile of plotTilesToUpdate) {
            try {
              // Build the updated PlotDataItem
              const plotDataItem = await buildPlotDataItem(
                plotTile,
                tableTilesData,
                plotArguments,
                fieldsArray,
                projectId,
                logsActions
              );
              
              // Update the cache with the new PlotDataItem
              queryClient.setQueryData(['plotDataItem', plotTile.id], plotDataItem);
            } catch (error) {
              console.error(`Error building optimistic PlotDataItem for ${plotTile.name}:`, error);
            }
          }
          perfLog(
            `[perf] onMutate(${name}) – buildPlotDataItem: ${(
              performance.now() - tPlotDataItem
            ).toFixed(2)} ms`
          );
        }
      } catch (error) {
        console.error("Error updating plot dependencies:", error);
      }

      const tEnd = performance.now();
      perfLog(
        `[perf] onMutate(${name}) – total: ${(
          tEnd - t0
        ).toFixed(2)} ms`
      );
      
      // Return the previous data for potential rollback
      return { 
        previousTiles,
        previousTableArgs: existingTableArgs,
        previousPlotArgs: existingPlotArgs,
      };
    },
    
    onError: (error, variables, context) => {
      // Do NOT rollback local state; keep the user's changes visible.
      showErrorToast(
        error,
        'Could not save changes. Your local edits are still visible. Use Save to persist.'
      );
      console.error(`Error patching tile:`, error);
    },
    
    onSuccess: (result, variables) => {
      const { id, tab_id, name, projectId } = variables;
      
      // Only invalidate without refetching since we've already updated the cache optimistically
      
      // Invalidate tiles list
      if (tab_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tiles', tab_id],
          refetchType: 'none'
        });
      }
      
      // Invalidate table and plot arguments
      if (tab_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tableArguments', tab_id],
          refetchType: 'none'
        });
        
        queryClient.invalidateQueries({ 
          queryKey: ['plotArguments', tab_id],
          refetchType: 'none'
        });
      }
      
      // Invalidate tab with tiles if we know the tab
      if (tab_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tab-with-tiles-by-id', tab_id],
          refetchType: 'none'
        });
      }
      
      // Invalidate specific tile items that may have been updated
      if (id) {
        // Table data items
        queryClient.invalidateQueries({
          queryKey: ['tableDataItem', id],
          refetchType: 'none'
        });
        
        // Plot data items
        queryClient.invalidateQueries({
          queryKey: ['plotDataItem', id],
          refetchType: 'none'
        });
      }
      
      // Invalidate fields if we have a project ID
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ['fields', projectId],
          refetchType: 'none'
        });
      }
    },
  });
} 