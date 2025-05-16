"use client";

import { useMutation } from '@tanstack/react-query';
import { 
  GranularTileActions, 
  TileData, 
  TableDataItem, 
  PlotDataItem,
  LogsActions,
  FieldsActions,
  TilePosition
} from '@/types/evals/grid';
import { 
  LogFieldsResponseProps, 
  TableArguments, 
  PlotArguments 
} from '@/types/evals/logs';
import { getQueryClient } from '@/lib/react-query/getQueryClient';
import { fetchAndBuildTableDataItem } from '@/utils/data/buildTableDataItem';
import { buildPlotDataItem, getUsedTableNames } from '@/utils/data/buildPlotDataItem';
import { buildTabArguments } from '@/utils/arguments/buildTabArguments';
import { useStoreApiContext } from '@/contexts/providers/StoreProvider';
import { selectTilesForTab } from '@/contexts/selectors/tile';
import { convertTileToTileData } from '@/contexts/utils/sliceUtils';
import { processContext } from '@/utils/evals/columnOperations';

/**
 * Hook to patch a tile with optimistic updates that cascade to related data
 * This is an enhanced version of usePatchTileQuery that handles:
 * 1. For Table tiles: rebuilds TableDataItem and updates the cache
 * 2. Updates tab arguments for both table and plot tiles
 * 3. For plot tiles that depend on the updated table: rebuilds PlotDataItem
 */
export function usePatchTileQueryOptimistic() {
  const queryClient = getQueryClient();
  
  // Get the store API reference - can be used to get state outside of React's render cycle
  const storeApi = useStoreApiContext();
  
  return useMutation({
    mutationFn: async ({ 
      id,
      tab_id, 
      name, 
      updateData, 
      actions,
      logsActions,
      fieldsActions,
      projectId
    }: { 
      id: string;
      tab_id: string; 
      name: string;
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
      actions: GranularTileActions;
      logsActions: LogsActions;
      fieldsActions: FieldsActions;
      projectId: string;
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
        updateData, 
        actions,
        logsActions,
        fieldsActions,
        projectId
      } = variables;
      
      if (!tab_id) {
        throw new Error("tab_id is required for optimistic updates");
      }
      
      // Get actual name and tab_id
      const tileKey = id 
        ? ['tile-by-id', id]
        : ['tile', tab_id, name];
      
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: tileKey });
      
      // Get the previous tile data
      const previousTiles = queryClient.getQueryData<TileData[]>(['tiles', tab_id]);
      
      // Get fresh data from Zustand using the pure selectors
      const state = storeApi.getState();
      const tilesInTabData = selectTilesForTab(state, tab_id).map(tile => convertTileToTileData(tile));
      const tableTilesData = tilesInTabData.filter(tile => tile.type === "Table");
      const plotTilesData = tilesInTabData.filter(tile => tile.type === "Plot");
    
      let optimisticTile: TileData | null = null;
      if (id) {
        optimisticTile = tilesInTabData.find(tile => tile.id === id) as TileData;
      } else if (tab_id && name) {
        optimisticTile = tilesInTabData.find(tile => tile.tab_id === tab_id && tile.name === name) as TileData;
      }

      const tileType = optimisticTile?.type;
      
      // Update the tiles list in the cache
      queryClient.setQueryData(['tiles', tab_id], tilesInTabData);

      // Try to get fields from the cache first
      let fieldsArray: LogFieldsResponseProps[] = tableTilesData.map(tile =>
        queryClient.getQueryData(["fields", projectId, tile.context ?? null]) as LogFieldsResponseProps
      );

      // Get existing table and plot arguments from cache
      const existingTableArgs = queryClient.getQueryData<TableArguments>(['tableArguments', tab_id]) || {} as TableArguments;
      const existingPlotArgs = queryClient.getQueryData<PlotArguments>(['plotArguments', tab_id]) || {} as PlotArguments;

      // Build arguments for all tiles
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
        
      // Step 1: If it's a Table tile, rebuild its TableDataItem and update the cache
      if (tileType === "Table") {
        try {

          // Get fields from cache
          const fields = queryClient.getQueryData<LogFieldsResponseProps>(["fields", projectId, optimisticTile?.context]) || {} as LogFieldsResponseProps;
          
          // Build the new TableDataItem
          if (optimisticTile) {
            const tableDataItem = await fetchAndBuildTableDataItem(
              optimisticTile,
              fields,
              projectId,
              logsActions
            );

            // Update available fields in the tableArguments (if we have tableArguments for this tile)
            const tableArguments = queryClient.getQueryData<TableArguments>(["tableArguments", tab_id]) || {} as TableArguments;
            if (tableArguments[optimisticTile.name]) {
              tableArguments[optimisticTile.name].available_fields = Object.fromEntries(
                Object.entries(fields)
                  .filter((([field, attributes]) => 
                    tableDataItem.entriesProperties.map(property => optimisticTile.column_context ? processContext("merge", optimisticTile.column_context, property) : property)
                    .concat(tableDataItem.paramsProperties.map(property => optimisticTile.column_context ? processContext("merge", optimisticTile.column_context, property) : property))
                    .includes(field))
                  )
              );
      
              // Update the cache with available fields
              queryClient.setQueryData(["tableArguments", tab_id], tableArguments);
            }
          
            // Update the TableDataItem in the cache
            queryClient.setQueryData(['tableDataItem', optimisticTile.id], tableDataItem);
          }
        } catch (error) {
          console.error("Error building optimistic TableDataItem:", error);
        }
      }
      
      try {
        // Step 3: For plot tiles that depend on this table, rebuild their PlotDataItem
        if (tileType === 'Table' || plotTilesData.length > 0) {
          // Determine which plot tiles need to be updated
          let plotTilesToUpdate: TileData[] = [];
          
          if (tileType === 'Table') {
            // If we're updating a table, look for plots that use this table
            const tileName = optimisticTile?.name;
            plotTilesToUpdate = plotTilesData.filter(plotTile => {
              const usedTables = getUsedTableNames(plotTile);
              return usedTables.includes(tileName as string);
            });
          } else if (tileType === 'Plot') {
            // If we're updating a plot that affects plot data, just update that plot
            if (updateData.context !== undefined || 
                updateData.filters !== undefined || 
                updateData.common_filter !== undefined) {
              plotTilesToUpdate = [optimisticTile as TileData];
            }
          }
          
          // Update each plot that needs updating
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
        }
      } catch (error) {
        console.error("Error updating plot dependencies:", error);
      }
      
      // Return the previous data for potential rollback
      return { 
        previousTiles,
        previousTableArgs: existingTableArgs,
        previousPlotArgs: existingPlotArgs,
      };
    },
    
    onError: (error, variables, context) => {
      // Roll back to the previous state if there was an error
      const { id, tab_id, name } = variables;
      
      if (!context) return;
      
      // Restore the tile data if available
      if (context.previousTiles) {
        queryClient.setQueryData(['tiles', tab_id], context.previousTiles);
      }
      
      // Restore table arguments
      if (context.previousTableArgs && tab_id) {
        queryClient.setQueryData(['tableArguments', tab_id], context.previousTableArgs);
      }
      
      // Restore plot arguments
      if (context.previousPlotArgs && tab_id) {
        queryClient.setQueryData(['plotArguments', tab_id], context.previousPlotArgs);
      }
      
      // No need to restore the TableDataItem and PlotDataItem,
      // since they'll be refetched if needed based on the restored tiles
      
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