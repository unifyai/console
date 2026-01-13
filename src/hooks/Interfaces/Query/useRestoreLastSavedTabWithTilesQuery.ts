"use client";

import { useMutation } from '@tanstack/react-query';
import { GranularInterfaceActions, GranularTabActions, GranularTileActions, InterfaceData, TabData, TileData } from '@/types/interfaces/grid';
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook to restore a complete interface structure (interface, tab, and tiles) from checkpoints
 */
export function useRestoreLastSavedTabWithTilesQuery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      interface_id,
      project_id,
      interface_name,
      tab_name,
      interface_actions,
      tab_actions,
      tile_actions
    }: { 
      interface_id?: string;
      project_id?: string;
      interface_name?: string;
      tab_name?: string;
      interface_actions: GranularInterfaceActions;
      tab_actions: GranularTabActions;
      tile_actions: GranularTileActions;
    }) => {
      // Validate input
      if ((!interface_id && (!project_id || !interface_name)) || !interface_actions || !tab_actions || !tile_actions) {
        throw new Error('Missing required parameters for restoration');
      }

      // Step 1: Get the current (non-checkpointed) interface data first
      let currentInterfaceData: InterfaceData | null = null;
      try {
        if (interface_id) {
          currentInterfaceData = await interface_actions.getById(interface_id);
        } else if (project_id && interface_name) {
          currentInterfaceData = await interface_actions.getByName(project_id, interface_name);
        }
        
        if (!currentInterfaceData || !currentInterfaceData.id) {
          throw new Error('Could not find the current interface');
        }

      } catch (error) {
        console.error('Error retrieving current interface:', error);
        throw new Error('Failed to retrieve current interface');
      }

      // Step 2: Get the checkpointed interface data using the same ID/name
      let checkpointedInterfaceData: InterfaceData | null = null;
      try {
        if (interface_id) {
          checkpointedInterfaceData = await interface_actions.getCheckpointById(interface_id);
        } else if (project_id && interface_name) {
          checkpointedInterfaceData = await interface_actions.getCheckpointByName(project_id, interface_name);
        }
        
        if (!checkpointedInterfaceData) {
          throw new Error('No checkpoint found for this interface');
        }

      } catch (error) {
        console.error('Error retrieving interface checkpoint:', error);
        throw new Error('Failed to retrieve interface checkpoint');
      }

      // Step 3: Get current tab data using the CURRENT interface ID
      let currentTabData: TabData | null = null;
      try {
        // If tab_name is provided, use it, otherwise use active tab
        if (tab_name) {
          currentTabData = await tab_actions.getByName(currentInterfaceData.id, tab_name);
        } else if (currentInterfaceData.active_tab_id) {
          currentTabData = await tab_actions.getById(currentInterfaceData.active_tab_id);
        } else {
          // Fetch all tabs and get the first one
          const tabs = await tab_actions.list(currentInterfaceData.id);
          if (tabs && tabs.length > 0) {
            currentTabData = tabs[0];
          }
        }
        
        if (!currentTabData || !currentTabData.id) {
          throw new Error('Could not find current tab');
        }

      } catch (error) {
        console.error('Error retrieving current tab:', error);
        throw new Error('Failed to retrieve current tab');
      }

      // Step 4: Get the checkpointed tab data using the CURRENT interface ID and current tab name
      let checkpointedTabData: TabData | null = null;
      try {
        if (currentTabData.name) {
          checkpointedTabData = await tab_actions.getCheckpointByName(currentInterfaceData.id, currentTabData.name);
        } else if (currentTabData.id) {
          checkpointedTabData = await tab_actions.getCheckpointById(currentTabData.id);
        }
        
        if (!checkpointedTabData) {
          throw new Error('No checkpoint found for this tab');
        }

      } catch (error) {
        console.error('Error retrieving tab checkpoint:', error);
        throw new Error('Failed to retrieve tab checkpoint');
      }

      // Step 5: Get the checkpointed tiles using the CURRENT tab ID
      let checkpointedTileList: TileData[] = [];
      try {
        checkpointedTileList = await tile_actions.list(currentTabData.id, undefined, true);
      } catch (error) {
        console.error('Error retrieving tile checkpoints:', error);
        // Continue even if there are no tiles
      }

      // Step 6: Now that we have all the checkpoint data, start restoring
      // First, update the interface
      try {
        if (interface_id) {
          await interface_actions.updateById(interface_id, {
            name: checkpointedInterfaceData.name,
            color: checkpointedInterfaceData.color,
            active_tab_id: currentInterfaceData.active_tab_id // Keep the current active tab ID
          });
        } else if (project_id && interface_name) {
          await interface_actions.updateByName(project_id, interface_name, {
            name: checkpointedInterfaceData.name,
            color: checkpointedInterfaceData.color,
            active_tab_id: currentInterfaceData.active_tab_id // Keep the current active tab ID
          });
        }
      } catch (error) {
        console.error('Error updating interface from checkpoint:', error);
        throw new Error('Failed to update interface from checkpoint');
      }

      // Next, update the tab
      try {
        if (currentTabData.id) {
          await tab_actions.updateById(currentTabData.id, {
            name: checkpointedTabData.name,
            context: checkpointedTabData.context || "",
            color: checkpointedTabData.color,
            active: true,
            visible: checkpointedTabData.visible,
            order: checkpointedTabData.order
          });
        }
      } catch (error) {
        console.error('Error updating tab from checkpoint:', error);
        throw new Error('Failed to update tab from checkpoint');
      }

      // Finally, restore each tile
      let restoredTiles = 0;
      let failedTiles = 0;
      const tileErrors: string[] = [];

      // First get the current tiles to match with checkpointed tiles
      let currentTiles: TileData[] = [];
      try {
        currentTiles = await tile_actions.list(currentTabData.id);
      } catch (error) {
        console.error('Error retrieving current tiles:', error);
      }

      for (const checkpointedTile of checkpointedTileList) {
        try {
          if (checkpointedTile.name) {
            // Try to find matching current tile by name
            const matchingTile = currentTiles.find(t => t.name === checkpointedTile.name);
            
            if (matchingTile && matchingTile.id) {
              // Update the existing tile with checkpoint data
              await tile_actions.updateById(matchingTile.id, {
                name: checkpointedTile.name,
                position: checkpointedTile.position,
                visible: checkpointedTile.visible,
                locked: checkpointedTile.locked,
                color: checkpointedTile.color,
                context: checkpointedTile.context,
                table: checkpointedTile.table,
                auto_update: checkpointedTile.auto_update,
                freeze: checkpointedTile.freeze,
                filters: checkpointedTile.filters,
                common_filter: checkpointedTile.common_filter,
                metric: checkpointedTile.metric,
                column_context: checkpointedTile.column_context,
                grouping: checkpointedTile.grouping,
                table_tile: checkpointedTile.table_tile,
                plot_tile: checkpointedTile.plot_tile,
                view_tile: checkpointedTile.view_tile
              });
              restoredTiles++;
            } else {
              // Tile doesn't exist in current tab, create it
              await tile_actions.create(currentTabData.id, checkpointedTile.name, checkpointedTile.position, {
                minW: checkpointedTile.minW,
                minH: checkpointedTile.minH,
                visible: checkpointedTile.visible,
                locked: checkpointedTile.locked,
                color: checkpointedTile.color,
                context: checkpointedTile.context,
                table: checkpointedTile.table,
                auto_update: checkpointedTile.auto_update,
                freeze: checkpointedTile.freeze,
                filters: checkpointedTile.filters,
                common_filter: checkpointedTile.common_filter,
                metric: checkpointedTile.metric,
                column_context: checkpointedTile.column_context,
                grouping: checkpointedTile.grouping,
                table_tile: checkpointedTile.table_tile,
                plot_tile: checkpointedTile.plot_tile,
                view_tile: checkpointedTile.view_tile
              }, undefined, checkpointedTile.type);
              restoredTiles++;
            }
          }
        } catch (tileError) {
          console.error(`Error restoring tile ${checkpointedTile.name}:`, tileError);
          failedTiles++;
          tileErrors.push(checkpointedTile.name || "unknown");
        }
      }

      return {
        success: true,
        interfaceRestored: true,
        tabRestored: true,
        tilesRestored: restoredTiles,
        tilesFailed: failedTiles,
        tileErrors: tileErrors,
        message: `Interface and tab restored with ${restoredTiles} tiles. ${failedTiles > 0 ? `(${failedTiles} tiles failed)` : ''}`
      };
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries to ensure UI reflects the latest data
      if (variables.interface_id) {
        queryClient.invalidateQueries({ queryKey: ['interface-by-id', variables.interface_id] });
      }
      
      if (variables.project_id && variables.interface_name) {
        queryClient.invalidateQueries({ 
          queryKey: ['interface', variables.project_id, variables.interface_name] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['interfaces', variables.project_id] 
        });
      }
      
      // Invalidate all tab and tile queries since we've potentially changed everything
      queryClient.invalidateQueries({ queryKey: ['tabs'] });
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
      queryClient.invalidateQueries({ queryKey: ['tab-with-tiles'] });
    }
  });
} 