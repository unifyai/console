"use client";

import { useMutation } from '@tanstack/react-query';
import { 
  GranularTileActions, 
  TileData, 
  TableDataItem, 
  PlotDataItem,
  LogsActions,
  FieldsActions
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
 * Hook to patch a specialized tile with optimistic updates that cascade to related data
 * This is an enhanced version of usePatchSpecializedTileQuery that handles:
 * 1. For Table tiles: rebuilds TableDataItem and updates the cache
 * 2. Updates tab arguments for both table and plot tiles
 * 3. For plot tiles that depend on the updated table: rebuilds PlotDataItem
 */
export function usePatchSpecializedTileQueryOptimistic() {
  const queryClient = getQueryClient();
  const storeApi = useStoreApiContext();
  
  return useMutation({
    mutationFn: async ({ 
      tab_id, 
      name, 
      tileType,
      updateData, 
      actions,
      logsActions,
      fieldsActions,
      projectId
    }: { 
      tab_id: string; 
      name: string;
      tileType: "Table" | "Plot" | "View" | "Editor";
      updateData: Record<string, any>; 
      actions: GranularTileActions;
      logsActions: LogsActions;
      fieldsActions: FieldsActions;
      projectId: string;
    }) => {
      return actions.patchSpecializedByName(tab_id, name, tileType, updateData);
    },
    
    onMutate: async (variables) => {
      const { 
        tab_id, 
        name, 
        tileType,
        updateData, 
        actions,
        logsActions,
        fieldsActions,
        projectId
      } = variables;
      
      if (!tab_id) {
        throw new Error("tab_id is required for optimistic updates");
      }
      
      // Get actual query keys
      const tileKey = ['tile', tab_id, name];
      const specializedTileKey = ['specialized-tile-data', tab_id, name, tileType];
      
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: tileKey });
      await queryClient.cancelQueries({ queryKey: specializedTileKey });
      
      // Get the previous tiles for potential rollback
      const previousTiles = queryClient.getQueryData<TileData[]>(['tiles', tab_id]);
      
      // Get fresh data from Zustand using the pure selectors
      const state = storeApi.getState();
      const tilesInTabData = selectTilesForTab(state, tab_id).map(tile => convertTileToTileData(tile));
      const tableTilesData = tilesInTabData.filter(tile => tile.type === "Table");
      const plotTilesData = tilesInTabData.filter(tile => tile.type === "Plot");
    
      // Find the tile we're updating
      let optimisticTile: TileData | null = null;
      optimisticTile = tilesInTabData.find(tile => 
        tile.tab_id === tab_id && tile.name === name
      ) as TileData;

      if (!optimisticTile) {
        throw new Error(`Tile ${name} not found in tab ${tab_id}`);
      }
      
      // Create specialized updates based on tile type
      const specializedUpdates = (() => {
        switch(tileType) {
          case 'Table':
            return {
              table_tile: {
                ...optimisticTile.table_tile,
                ...updateData
              }
            };
          case 'Plot':
            return {
              plot_tile: {
                ...optimisticTile.plot_tile,
                ...updateData
              }
            };
          case 'View':
            return {
              view_tile: {
                ...optimisticTile.view_tile,
                ...updateData
              }
            };
          case 'Editor':
            return {
              editor_tile: {
                ...optimisticTile.editor_tile,
                ...updateData
              }
            };
          default:
            return {};
        }
      })();
      
      // Create an optimistic tile with the updates applied
      const updatedOptimisticTile: TileData = {
        ...optimisticTile,
        ...specializedUpdates
      };
      
      // Update the tiles list in the cache with our optimistic tile
      const updatedTilesInTab = tilesInTabData.map(tile => 
        (tile.tab_id === tab_id && tile.name === name) ? updatedOptimisticTile : tile
      );
      
      queryClient.setQueryData(['tiles', tab_id], updatedTilesInTab);
      queryClient.setQueryData(tileKey, updatedOptimisticTile);
      
      // Update specialized data too
      const specializedData = (() => {
        switch(tileType) {
          case 'Table': return updatedOptimisticTile.table_tile;
          case 'Plot': return updatedOptimisticTile.plot_tile;
          case 'View': return updatedOptimisticTile.view_tile;
          case 'Editor': return updatedOptimisticTile.editor_tile;
          default: return null;
        }
      })();
      
      queryClient.setQueryData(specializedTileKey, specializedData);
      
      // Get existing table and plot arguments from cache
      const existingTableArgs = queryClient.getQueryData<TableArguments>(['tableArguments', tab_id]) || {} as TableArguments;
      const existingPlotArgs = queryClient.getQueryData<PlotArguments>(['plotArguments', tab_id]) || {} as PlotArguments;

      // Try to get fields from the cache first
      let fieldsArray: LogFieldsResponseProps[] = tableTilesData.map(tile =>
        queryClient.getQueryData(["fields", projectId, tile.context ?? null]) as LogFieldsResponseProps
      );

      // Build arguments for all tiles
      if (tableTilesData.length > 0 || plotTilesData.length > 0) {
        try {
          const { tableArguments: newTableArguments, plotArguments: newPlotArguments } = 
          buildTabArguments(updatedTilesInTab as TileData[], fieldsArray, existingTableArgs, existingPlotArgs);

          // Store the built arguments in the cache
          queryClient.setQueryData(["tableArguments", tab_id], newTableArguments);
          queryClient.setQueryData(["plotArguments", tab_id], newPlotArguments);
        } catch (error) {
          console.error("Error building tab arguments:", error);
        }
      } else {
        // Initialize empty arguments if no tiles
        queryClient.setQueryData(["tableArguments", tab_id], {});
        queryClient.setQueryData(["plotArguments", tab_id], {});
      }
        
      // Step 1: If it's a Table tile, rebuild its TableDataItem and update the cache
      if (tileType === "Table") {
        try {
          // Get fields from cache
          const fields = queryClient.getQueryData<LogFieldsResponseProps>(["fields", projectId, updatedOptimisticTile?.context]) || {} as LogFieldsResponseProps;
          
          // Build the new TableDataItem
          const tableDataItem = await fetchAndBuildTableDataItem(
            updatedOptimisticTile,
            fields,
            projectId,
            logsActions
          );

          // Update available fields in the tableArguments (if we have tableArguments for this tile)
          const tableArguments = queryClient.getQueryData<TableArguments>(["tableArguments", tab_id]) || {} as TableArguments;
          if (tableArguments[updatedOptimisticTile.name]) {
            tableArguments[updatedOptimisticTile.name].available_fields = Object.fromEntries(
              Object.entries(fields)
                .filter((([field, attributes]) => 
                  tableDataItem.entriesProperties.map(property => updatedOptimisticTile.column_context ? processContext("merge", updatedOptimisticTile.column_context, property) : property)
                  .concat(tableDataItem.paramsProperties.map(property => updatedOptimisticTile.column_context ? processContext("merge", updatedOptimisticTile.column_context, property) : property))
                  .includes(field))
                )
            );
    
            // Update the cache with available fields
            queryClient.setQueryData(["tableArguments", tab_id], tableArguments);
          }
        
          // Update the TableDataItem in the cache
          queryClient.setQueryData(['tableDataItem', updatedOptimisticTile.id], tableDataItem);
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
            const tileName = updatedOptimisticTile?.name;
            plotTilesToUpdate = plotTilesData.filter(plotTile => {
              const usedTables = getUsedTableNames(plotTile);
              return usedTables.includes(tileName as string);
            });
          } else if (tileType === 'Plot') {
            // If we're updating a plot that affects plot data, just update that plot
            plotTilesToUpdate = [updatedOptimisticTile];
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
      const { tab_id, name, tileType } = variables;
      
      if (!context) return;
      
      // Restore the tiles data if available
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
      
      console.error(`Error patching specialized tile ${tileType}:`, error);
    },
    
    onSuccess: (result, variables) => {
      const { tab_id, name, tileType, projectId } = variables;
      
      // Invalidate tiles list
      if (tab_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tiles', tab_id],
          refetchType: 'none'
        });
      }
      
      // Invalidate specialized tile data
      queryClient.invalidateQueries({ 
        queryKey: ['tile', tab_id, name],
        refetchType: 'none'
      });
      
      queryClient.invalidateQueries({ 
        queryKey: ['specialized-tile-data', tab_id, name, tileType],
        refetchType: 'none'
      });
      
      // Invalidate tab with tiles
      if (tab_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tab-with-tiles-by-id', tab_id],
          refetchType: 'none'
        });
      }
      
      // Invalidate arguments
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
      
      // Invalidate specific tile items that may have been updated
      const tileId = result?.id;
      if (tileId) {
        if (tileType === 'Table') {
          queryClient.invalidateQueries({
            queryKey: ['tableDataItem', tileId],
            refetchType: 'none'
          });
        } else if (tileType === 'Plot') {
          queryClient.invalidateQueries({
            queryKey: ['plotDataItem', tileId],
            refetchType: 'none'
          });
        }
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