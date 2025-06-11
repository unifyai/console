"use client";

import { useMutation } from '@tanstack/react-query';
import { 
  GranularTileActions, 
  TileData, 
  TableDataItem, 
  PlotDataItem,
  LogsActions,
  FieldsActions,
  ProjectsActions,
  ContextActions
} from '@/types/evals/grid';
import { 
  LogFieldsResponseProps, 
  TableArguments, 
  PlotArguments 
} from '@/types/evals/logs';
import { useQueryClient } from "@tanstack/react-query";
import { fetchAndBuildTableDataItem } from '@/utils/data/buildTableDataItem';
import { buildPlotDataItem, getUsedTableNames } from '@/utils/data/buildPlotDataItem';
import { buildTabArguments } from '@/utils/arguments/buildTabArguments';
import { useStoreApiContext } from '@/contexts/providers/StoreProvider';
import { selectTilesForTab } from '@/contexts/selectors/tile';
import { convertTileToTileData } from '@/contexts/utils/sliceUtils';
import { selectProjectById } from '@/contexts/selectors/project';
import { fetchOrBuildFields, fetchOrBuildProjectsAndContexts } from '@/utils/data/buildServerData';
import { buildAvailableFieldsForTile } from '@/utils/arguments/buildTableArguments';

// Define TileType as a string union if not imported
type TileType = "Table" | "Plot" | "View" | "Editor" | "Terminal";

/**
 * Hook to patch a specialized tile with optimistic updates that cascade to related data
 * This is an enhanced version of usePatchSpecializedTileQuery that handles:
 * 1. For Table tiles: rebuilds TableDataItem and updates the cache
 * 2. Updates tab arguments for both table and plot tiles
 * 3. For plot tiles that depend on the updated table: rebuilds PlotDataItem
 */
export function usePatchSpecializedTileQueryOptimistic<
T extends TileType
>() {
  const queryClient = useQueryClient();
  const storeApi = useStoreApiContext();
  
  return useMutation({
    mutationFn: async ({ 
      tab_id, 
      name, 
      tileType,
      updateData,
      refetchProjects = false,
      refetchContexts = false,
      refetchFields = true,
      actions,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
      projectId
    }: { 
      tab_id: string; 
      name: string;
      tileType: T;
      updateData: Record<string, any>; 
      refetchProjects: boolean;
      refetchContexts: boolean;
      refetchFields: boolean;
      actions: GranularTileActions;
      projectsActions: ProjectsActions;
      contextActions: ContextActions;
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
        refetchProjects,
        refetchContexts,
        refetchFields,
        actions,
        projectsActions,
        contextActions,
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
      const projectData = selectProjectById(state, projectId);
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
      
      // Update the tiles list in the cache
      queryClient.setQueryData(['tiles', tab_id], tilesInTabData);
      queryClient.setQueryData(tileKey, optimisticTile);
      
      // Update specialized data too
      const specializedData = (() => {
        switch(tileType) {
          case 'Table': return optimisticTile.table_tile;
          case 'Plot': return optimisticTile.plot_tile;
          case 'View': return optimisticTile.view_tile;
          case 'Editor': return optimisticTile.editor_tile;
          case 'Terminal': return optimisticTile.terminal_tile;
          default: return null;
        }
      })();
      
      queryClient.setQueryData(specializedTileKey, specializedData);

      // Build or fetch projects and contexts
      const projectsAndContexts = await fetchOrBuildProjectsAndContexts(
        queryClient,
        projectId,
        refetchProjects,
        refetchContexts,
        projectsActions,
        contextActions
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
              contexts: contexts
            }
          }
        });
      }

      // Build or fetch fields for all table tiles
      const fieldsArray: LogFieldsResponseProps[] = await fetchOrBuildFields(
        queryClient,
        tableTilesData,
        projectId,
        refetchFields,
        fieldsActions
      );
      
      // Get existing table and plot arguments from cache
      const existingTableArgs = queryClient.getQueryData<TableArguments>(['tableArguments', tab_id]) || {} as TableArguments;
      const existingPlotArgs = queryClient.getQueryData<PlotArguments>(['plotArguments', tab_id]) || {} as PlotArguments;

      // Build arguments for all tiles
      if (tableTilesData.length > 0 || plotTilesData.length > 0) {
        try {
          const { tableArguments: newTableArguments, plotArguments: newPlotArguments } = 
          buildTabArguments(tilesInTabData as TileData[], fieldsArray, existingTableArgs, existingPlotArgs);

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
          const fields = queryClient.getQueryData<LogFieldsResponseProps>(["fields", projectId, optimisticTile?.context]) || {} as LogFieldsResponseProps;
          
          // Build the new TableDataItem
          const tableDataItem = await fetchAndBuildTableDataItem(
            optimisticTile,
            fields,
            projectId,
            logsActions
          );

          // Update available fields in the tableArguments (if we have tableArguments for this tile)
          const tableArguments = queryClient.getQueryData<TableArguments>(["tableArguments", tab_id]) || {} as TableArguments;
          if (tableArguments[optimisticTile.name]) {
            tableArguments[optimisticTile.name].available_fields = buildAvailableFieldsForTile(
              optimisticTile.column_context ?? "",
              fields,
              tableDataItem.entriesProperties,
              tableDataItem.paramsProperties
            );
    
            // Update the cache with available fields
            queryClient.setQueryData(["tableArguments", tab_id], tableArguments);
          }
        
          // Update the TableDataItem in the cache
          queryClient.setQueryData(['tableDataItem', optimisticTile.id], tableDataItem);
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
            plotTilesToUpdate = [optimisticTile];
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