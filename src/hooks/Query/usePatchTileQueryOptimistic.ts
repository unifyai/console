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
import { fetchOrBuildFields, fetchOrBuildProjectsAndContexts } from '@/utils/data/buildServerData';
import { selectProjectById } from '@/contexts/selectors/project';
import { buildAvailableFieldsForTile } from '@/utils/arguments/buildTableArguments';

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
      console.log(
        `[perf] onMutate(${name}) – cancelQueries: ${(
          performance.now() - tCancel
        ).toFixed(2)} ms`
      );
      
      // Get the previous tile data
      const tUpdateCache = performance.now();
      const previousTiles = queryClient.getQueryData<TileData[]>(['tiles', tab_id]);

      console.log("[usePatchTileQueryOptimistic] previousTiles:", previousTiles);
      
      // Get fresh data from Zustand using the pure selectors
      const state = storeApi.getState();
      const projectData = selectProjectById(state, projectId);
      const tilesInTabData = selectTilesForTab(state, tab_id).map(tile => convertTileToTileData(tile));
      const tableTilesData = tilesInTabData.filter(tile => tile.type === "Table");
      const plotTilesData = tilesInTabData.filter(tile => tile.type === "Plot");

      console.log("[usePatchTileQueryOptimistic] tilesInTabData:", tilesInTabData);
    
      let optimisticTile: TileData | null = null;
      if (id) {
        optimisticTile = tilesInTabData.find(tile => tile.id === id) as TileData;
      } else if (tab_id && name) {
        optimisticTile = tilesInTabData.find(tile => tile.tab_id === tab_id && tile.name === name) as TileData;
      }

      console.log("[usePatchTileQueryOptimistic] optimisticTile:", optimisticTile);

      const tileType = optimisticTile?.type;
      
      // Update the tiles list in the cache
      queryClient.setQueryData(['tiles', tab_id], tilesInTabData);
      console.log(
        `[perf] onMutate(${name}) – set tiles cache: ${(
          performance.now() - tUpdateCache
        ).toFixed(2)} ms`
      );

      // Build or fetch projects and contexts
      const tProjectsAndContexts = performance.now();
      const projectsAndContexts = await fetchOrBuildProjectsAndContexts(
        queryClient,
        projectId,
        refetchProjects,
        refetchContexts,
        projectsActions,
        contextActions
      );
      console.log(
        `[perf] onMutate(${name}) – fetchOrBuildProjectsAndContexts: ${(
          performance.now() - tProjectsAndContexts
        ).toFixed(2)} ms`
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
      const tFields = performance.now();
      const fieldsArray: LogFieldsResponseProps[] = await fetchOrBuildFields(
        queryClient,
        tableTilesData,
        projectId,
        refetchFields,
        fieldsActions
      );
      console.log(
        `[perf] onMutate(${name}) – fetchOrBuildFields: ${(
          performance.now() - tFields
        ).toFixed(2)} ms`
      );

      // Get existing table and plot arguments from cache
      const tBuildArgs = performance.now();
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
      console.log(
        `[perf] onMutate(${name}) – buildTabArguments: ${(
          performance.now() - tBuildArgs
        ).toFixed(2)} ms`
      );
        
      // Step 1: If it's a Table tile, rebuild its TableDataItem and update the cache
      if (tileType === "Table") {
        try {

          // Get fields from cache
          const fields = queryClient.getQueryData<LogFieldsResponseProps>(["fields", projectId, optimisticTile?.context]) || {} as LogFieldsResponseProps;
          
          // Build the new TableDataItem
          if (optimisticTile) {
            const tTableDataItem = performance.now();
            const tableDataItem = await fetchAndBuildTableDataItem(
              optimisticTile,
              fields,
              projectId,
              logsActions
            );
            console.log(
              `[perf] onMutate(${name}) – fetchAndBuildTableDataItem: ${(
                performance.now() - tTableDataItem
              ).toFixed(2)} ms`
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
            if (optimisticTile) {
              plotTilesToUpdate = [optimisticTile as TileData];
            }
          }
          
          console.log("[usePatchTileQueryOptimistic] plotTilesToUpdate:", plotTilesToUpdate);
          
          // Update each plot that needs updating
          const tPlotDataItem = performance.now();
          const plotArguments = queryClient.getQueryData<PlotArguments>(['plotArguments', tab_id]) || {} as PlotArguments;
          for (const plotTile of plotTilesToUpdate) {
            try {
              console.log("[usePatchTileQueryOptimistic] building plotDataItem for:", plotTile.name);
              // Build the updated PlotDataItem
              const plotDataItem = await buildPlotDataItem(
                plotTile,
                tableTilesData,
                plotArguments,
                fieldsArray,
                projectId,
                logsActions
              );
              console.log("[usePatchTileQueryOptimistic] plotDataItem:", plotDataItem);
              
              // Update the cache with the new PlotDataItem
              queryClient.setQueryData(['plotDataItem', plotTile.id], plotDataItem);
            } catch (error) {
              console.error(`Error building optimistic PlotDataItem for ${plotTile.name}:`, error);
            }
          }
          console.log(
            `[perf] onMutate(${name}) – buildPlotDataItem: ${(
              performance.now() - tPlotDataItem
            ).toFixed(2)} ms`
          );
        }
      } catch (error) {
        console.error("Error updating plot dependencies:", error);
      }

      const tEnd = performance.now();
      console.log(
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