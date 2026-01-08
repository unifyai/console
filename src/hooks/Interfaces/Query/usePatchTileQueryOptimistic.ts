'use client';

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
  ProjectsActions,
} from '@/types/interfaces/grid';
import { LogFieldsResponseProps, TableArguments, PlotArguments } from '@/types/interfaces/logs';
import { useQueryClient } from '@tanstack/react-query';
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
      tabId,
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
      fieldsActions,
    }: {
      id: string;
      tabId: string;
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
        autoUpdate?: string;
        freeze?: string;
        filters?: string;
        commonFilter?: string;
        metric?: string;
        columnContext?: string;
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
      } else if (tabId && name) {
        return actions.patchByName(tabId, name, updateData);
      } else {
        throw new Error('Invalid arguments');
      }
    },

    onMutate: async (variables) => {
      const {
        id,
        tabId,
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

      if (!tabId) {
        throw new Error('tabId is required for optimistic updates');
      }

      // Get actual query key
      const tileKey = id ? ['tile-by-id', id] : ['tile', tabId, name];

      // Cancel any outgoing refetches to avoid overwriting optimistic update
      const tCancel = performance.now();
      await queryClient.cancelQueries({ queryKey: tileKey });
      perfLog(
        `[perf] onMutate(${name}) – cancelQueries: ${(performance.now() - tCancel).toFixed(2)} ms`
      );

      // Get the previous tile data
      const tUpdateCache = performance.now();
      const previousTiles = queryClient.getQueryData<TileData[]>(['tiles', tabId]);

      // Get fresh data from Zustand using the pure selectors
      const state = storeApi.getState();
      const projectData = selectProjectById(state, projectId);
      const tilesInTab = selectTilesForTab(state, tabId);
      const tilesInTabData = tilesInTab.map((tile) => convertTileToTileData(tile));
      const tableTilesData = tilesInTabData.filter((tile) => tile.type === 'Table');
      const plotTilesData = tilesInTabData.filter((tile) => tile.type === 'Plot');

      let optimisticTile: Tile | null = null;
      let optimisticTileData: TileData | null = null;

      if (id) {
        optimisticTile = tilesInTab.find((tile) => tile.id === id) as Tile;
        optimisticTileData = tilesInTabData.find((tileData) => tileData.id === id) as TileData;
      } else if (tabId && name) {
        optimisticTile = tilesInTab.find(
          (tile) => tile.tabId === tabId && tile.name === name
        ) as Tile;
        optimisticTileData = tilesInTabData.find(
          (tileData) => tileData.tabId === tabId && tileData.name === name
        ) as TileData;
      }

      const tileType = optimisticTileData?.type;

      // Update the tiles list in the cache
      queryClient.setQueryData(['tiles', tabId], tilesInTabData);
      perfLog(
        `[perf] onMutate(${name}) – set tiles cache: ${(performance.now() - tUpdateCache).toFixed(
          2
        )} ms`
      );

      // Avoid extra network work entirely here; do not prefetch projects/contexts/fields.
      // These are expensive and not required to rebuild the table immediately.

      // Resolve fields for table tiles from cache only to stay non-blocking
      const fieldsArray: LogFieldsResponseProps[] = tableTilesData.map(
        (t) =>
          (queryClient.getQueryData<LogFieldsResponseProps>([
            'fields',
            projectId,
            t.context ?? null,
          ]) || {}) as LogFieldsResponseProps
      );
      // Opportunistically prefetch missing fields in the background when asked
      if (refetchFields) {
        tableTilesData.forEach((t, idx) => {
          const cached = fieldsArray[idx];
          const context = t.context ?? null;
          if (context && (!cached || Object.keys(cached).length === 0)) {
            queryClient
              .prefetchQuery({
                queryKey: ['fields', projectId, context],
                queryFn: async () => {
                  const url = `/api/logs/fields?projectName=${encodeURIComponent(projectId)}&context=${encodeURIComponent(context)}`;
                  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
                  if (!res.ok) throw new Error(`Fields ${res.status}`);
                  return res.json();
                },
              })
              .catch(() => {});
          }
        });
      }

      // Get existing table and plot arguments from cache
      const tBuildArgs = performance.now();
      const existingTableArgs =
        queryClient.getQueryData<TableArguments>(['tableArguments', tabId]) ||
        ({} as TableArguments);
      const existingPlotArgs =
        queryClient.getQueryData<PlotArguments>(['plotArguments', tabId]) || ({} as PlotArguments);

      // Build arguments for all tiles using cache-only fields
      if (tableTilesData.length > 0 || plotTilesData.length > 0) {
        const { tableArguments: newTableArguments, plotArguments: newPlotArguments } =
          buildTabArguments(tilesInTabData, fieldsArray, existingTableArgs, existingPlotArgs);

        // Store the built arguments in the cache
        queryClient.setQueryData(['tableArguments', tabId], newTableArguments);
        queryClient.setQueryData(['plotArguments', tabId], newPlotArguments);
      } else {
        // Initialize empty arguments if no tiles
        queryClient.setQueryData(['tableArguments', tabId], {});
        queryClient.setQueryData(['plotArguments', tabId], {});
      }
      perfLog(
        `[perf] onMutate(${name}) – buildTabArguments: ${(performance.now() - tBuildArgs).toFixed(
          2
        )} ms`
      );

      // Step 1: If it's a Table tile, rebuild its TableDataItem and update the cache
      if (tileType === 'Table' && rebuildTableData) {
        try {
          // Get fields from cache - but check if they exist for the NEW context!
          // The fetchOrBuildFields call above used the OLD tile data, so we may need to fetch again
          let fields = queryClient.getQueryData<LogFieldsResponseProps>([
            'fields',
            projectId,
            optimisticTileData?.context,
          ]);

          // If fields not in cache for new context, fetch them now
          if (!fields && optimisticTileData?.context) {
            fields = await queryClient.fetchQuery({
              queryKey: ['fields', projectId, optimisticTileData.context],
              queryFn: () => fieldsActions.get(projectId, optimisticTileData.context ?? null),
            });
          }

          // Fallback to empty fields if still not available
          fields = fields || ({} as LogFieldsResponseProps);

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
            const tableArguments =
              queryClient.getQueryData<TableArguments>(['tableArguments', tabId]) ||
              ({} as TableArguments);
            if (tableArguments[optimisticTileData.name]) {
              tableArguments[optimisticTileData.name].availableFields = buildAvailableFieldsForTile(
                optimisticTileData.columnContext ?? '',
                fields,
                tableDataItem.entriesProperties,
                tableDataItem.paramsProperties
              );

              // Update the cache with available fields
              queryClient.setQueryData(['tableArguments', tabId], tableArguments);
            }

            // Update the TableDataItem in the cache
            queryClient.setQueryData(['tableDataItem', optimisticTileData.id], tableDataItem);
            // Invalidate internal data query so dependency manager re-checks render readiness
            queryClient.refetchQueries({
              queryKey: ['internalData', optimisticTileData.id],
              type: 'active',
            });
          }
        } catch (error) {
          console.error('Error building optimistic TableDataItem:', error);
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
            plotTilesToUpdate = plotTilesData.filter((plotTile) => {
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
          const plotArguments =
            queryClient.getQueryData<PlotArguments>(['plotArguments', tabId]) ||
            ({} as PlotArguments);
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
        console.error('Error updating plot dependencies:', error);
      }

      const tEnd = performance.now();
      perfLog(`[perf] onMutate(${name}) – total: ${(tEnd - t0).toFixed(2)} ms`);

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
      const { id, tabId, name, projectId } = variables;

      // Only invalidate without refetching since we've already updated the cache optimistically

      // Invalidate tiles list
      if (tabId) {
        queryClient.invalidateQueries({
          queryKey: ['tiles', tabId],
          refetchType: 'none',
        });
      }

      // Invalidate table and plot arguments
      if (tabId) {
        queryClient.invalidateQueries({
          queryKey: ['tableArguments', tabId],
          refetchType: 'none',
        });

        queryClient.invalidateQueries({
          queryKey: ['plotArguments', tabId],
          refetchType: 'none',
        });
      }

      // Invalidate tab with tiles if we know the tab
      if (tabId) {
        queryClient.invalidateQueries({
          queryKey: ['tab-with-tiles-by-id', tabId],
          refetchType: 'none',
        });
      }

      // Invalidate specific tile items that may have been updated
      if (id) {
        // Table data items
        queryClient.invalidateQueries({
          queryKey: ['tableDataItem', id],
          refetchType: 'none',
        });

        // Plot data items
        queryClient.invalidateQueries({
          queryKey: ['plotDataItem', id],
          refetchType: 'none',
        });
      }

      // Invalidate fields if we have a project ID
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ['fields', projectId],
          refetchType: 'none',
        });
      }
    },
  });
}
