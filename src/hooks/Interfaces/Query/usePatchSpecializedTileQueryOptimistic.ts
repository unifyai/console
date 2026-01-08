'use client';

import { useMutation } from '@tanstack/react-query';
import {
  GranularTileActions,
  TileData,
  LogsActions,
  FieldsActions,
  ProjectsActions,
  ContextActions,
} from '@/types/interfaces/grid';
import { LogFieldsResponseProps, TableArguments, PlotArguments } from '@/types/interfaces/logs';
import { useQueryClient } from '@tanstack/react-query';
import { fetchAndBuildTableDataItem } from '@/utils/data/buildTableDataItem';
import { buildPlotDataItem, getUsedTableNames } from '@/utils/data/buildPlotDataItem';
import { buildTabArguments } from '@/utils/arguments/buildTabArguments';
import { useStoreApiContext } from '@/contexts/providers/StoreProvider';
import { selectTilesForTab } from '@/contexts/selectors/tile';
import { convertTileToTileData } from '@/contexts/utils/sliceUtils';
import { selectProjectById } from '@/contexts/selectors/project';
import { fetchOrBuildFields, fetchOrBuildProjectsAndContexts } from '@/utils/data/buildServerData';
import { buildAvailableFieldsForTile } from '@/utils/arguments/buildTableArguments';
import { Tile, TileType } from '@/contexts/slices/selectors/tile';
import { showErrorToast } from '@/components/Common/Toasts/notifications';

/**
 * Hook to patch a specialized tile with optimistic updates that cascade to related data
 * This is an enhanced version of usePatchSpecializedTileQuery that handles:
 * 1. For Table tiles: rebuilds TableDataItem and updates the cache
 * 2. Updates tab arguments for both table and plot tiles
 * 3. For plot tiles that depend on the updated table: rebuilds PlotDataItem
 */
export function usePatchSpecializedTileQueryOptimistic<T extends TileType>() {
  const queryClient = useQueryClient();
  const storeApi = useStoreApiContext();

  return useMutation({
    mutationFn: async ({
      tabId,
      name,
      tileType,
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
      projectId,
    }: {
      tabId: string;
      name: string;
      tileType: T;
      updateData: Record<string, any>;
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
      projectId: string;
    }) => {
      return actions.patchSpecializedByName(tabId, name, tileType, updateData);
    },

    onMutate: async (variables) => {
      const {
        tabId,
        name,
        tileType,
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
        projectId,
      } = variables;

      if (!tabId) {
        throw new Error('tabId is required for optimistic updates');
      }

      // Get actual query keys
      const tileKey = ['tile', tabId, name];
      const specializedTileKey = ['specialized-tile-data', tabId, name, tileType];

      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: tileKey });
      await queryClient.cancelQueries({ queryKey: specializedTileKey });

      // Get the previous tiles for potential rollback
      const previousTiles = queryClient.getQueryData<TileData[]>(['tiles', tabId]);

      // Get fresh data from Zustand using the pure selectors
      const state = storeApi.getState();
      const projectData = selectProjectById(state, projectId);
      const tilesInTab = selectTilesForTab(state, tabId);
      const tilesInTabData = tilesInTab.map((tile) => convertTileToTileData(tile));
      const tableTilesData = tilesInTabData.filter((tile) => tile.type === 'Table');
      const plotTilesData = tilesInTabData.filter((tile) => tile.type === 'Plot');

      // Find the tile we're updating
      let optimisticTile: Tile | null = null;
      let optimisticTileData: TileData | null = null;

      optimisticTile = tilesInTab.find(
        (tile) => tile.tabId === tabId && tile.name === name
      ) as Tile;
      optimisticTileData = tilesInTabData.find(
        (tileData) => tileData.tabId === tabId && tileData.name === name
      ) as TileData;

      if (!optimisticTileData) {
        throw new Error(`Tile ${name} not found in tab ${tabId}`);
      }

      // Update the tiles list in the cache
      queryClient.setQueryData(['tiles', tabId], tilesInTabData);
      queryClient.setQueryData(tileKey, optimisticTileData);

      // Update specialized data too
      const specializedData = (() => {
        switch (tileType) {
          case 'Table':
            return optimisticTileData.tableTile;
          case 'Plot':
            return optimisticTileData.plotTile;
          case 'View':
            return optimisticTileData.viewTile;
          case 'Editor':
            return optimisticTileData.editorTile;
          case 'Terminal':
            return optimisticTileData.terminalTile;
          default:
            return null;
        }
      })();

      queryClient.setQueryData(specializedTileKey, specializedData);

      // Build or fetch projects and contexts
      const projectsAndContexts = await fetchOrBuildProjectsAndContexts(
        queryClient,
        projectId,
        refetchProjects,
        refetchContexts
      );
      const projects = projectsAndContexts.projects;
      const contexts = projectsAndContexts.contexts;

      // Update the contexts in the store
      if (refetchProjects) {
        storeApi.setState({
          ...state,
          projects: projects,
        });
      }

      if (refetchContexts) {
        storeApi.setState({
          ...state,
          projectsById: {
            ...state.projectsById,
            [projectId]: {
              ...projectData,
              contexts: contexts,
            },
          },
        });
      }

      // Build or fetch fields for all table tiles
      const fieldsArray: LogFieldsResponseProps[] = await fetchOrBuildFields(
        queryClient,
        tableTilesData,
        projectId,
        refetchFields
      );

      // Get existing table and plot arguments from cache
      const existingTableArgs =
        queryClient.getQueryData<TableArguments>(['tableArguments', tabId]) ||
        ({} as TableArguments);
      const existingPlotArgs =
        queryClient.getQueryData<PlotArguments>(['plotArguments', tabId]) || ({} as PlotArguments);

      // Build arguments for all tiles
      if (tableTilesData.length > 0 || plotTilesData.length > 0) {
        try {
          const { tableArguments: newTableArguments, plotArguments: newPlotArguments } =
            buildTabArguments(
              tilesInTabData as TileData[],
              fieldsArray,
              existingTableArgs,
              existingPlotArgs
            );

          // Store the built arguments in the cache
          queryClient.setQueryData(['tableArguments', tabId], newTableArguments);
          queryClient.setQueryData(['plotArguments', tabId], newPlotArguments);
        } catch (error) {
          showErrorToast(error, 'Error building tab arguments');
          throw error;
        }
      } else {
        // Initialize empty arguments if no tiles
        queryClient.setQueryData(['tableArguments', tabId], {});
        queryClient.setQueryData(['plotArguments', tabId], {});
      }

      // Step 1: If it's a Table tile, rebuild its TableDataItem and update the cache
      if (tileType === 'Table' && rebuildTableData) {
        try {
          // Get fields from cache
          const fields =
            queryClient.getQueryData<LogFieldsResponseProps>([
              'fields',
              projectId,
              optimisticTileData?.context,
            ]) || ({} as LogFieldsResponseProps);

          // Get infinite query keys from the store tile
          const infiniteQueryKeys = optimisticTile?.tableTile?.infiniteQueryKeys || [];

          // Build the new TableDataItem
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
        } catch (error) {
          showErrorToast(
            error,
            `Error building optimistic TableDataItem for ${optimisticTileData.name}`
          );
          throw error;
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
            plotTilesToUpdate = [optimisticTileData];
          }

          // Update each plot that needs updating
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
              showErrorToast(error, `Error building optimistic PlotDataItem for ${plotTile.name}`);
              throw error;
            }
          }
        }
      } catch (error) {
        showErrorToast(error, 'Error updating plot dependencies');
        throw error;
      }

      // Return the previous data for potential rollback
      return {
        previousTiles,
        previousTableArgs: existingTableArgs,
        previousPlotArgs: existingPlotArgs,
      };
    },

    onError: (error, variables, context) => {
      // Do NOT rollback local state; keep the user's changes visible.
      const { tileType } = variables;
      showErrorToast(
        error,
        'Could not save changes. Your local edits are still visible. Use Save to persist.'
      );
      console.error(`Error patching specialized tile ${tileType}:`, error);
    },

    onSuccess: (result, variables) => {
      const { tabId, name, tileType, projectId } = variables;

      // Invalidate tiles list
      if (tabId) {
        queryClient.invalidateQueries({
          queryKey: ['tiles', tabId],
          refetchType: 'none',
        });
      }

      // Invalidate specialized tile data
      queryClient.invalidateQueries({
        queryKey: ['tile', tabId, name],
        refetchType: 'none',
      });

      queryClient.invalidateQueries({
        queryKey: ['specialized-tile-data', tabId, name, tileType],
        refetchType: 'none',
      });

      // Invalidate tab with tiles
      if (tabId) {
        queryClient.invalidateQueries({
          queryKey: ['tab-with-tiles-by-id', tabId],
          refetchType: 'none',
        });
      }

      // Invalidate arguments
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

      // Invalidate specific tile items that may have been updated
      const tileId = result?.id;
      if (tileId) {
        if (tileType === 'Table') {
          queryClient.invalidateQueries({
            queryKey: ['tableDataItem', tileId],
            refetchType: 'none',
          });
        } else if (tileType === 'Plot') {
          queryClient.invalidateQueries({
            queryKey: ['plotDataItem', tileId],
            refetchType: 'none',
          });
        }
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
