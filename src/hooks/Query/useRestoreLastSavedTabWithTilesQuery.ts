"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GranularTabActions, GranularTileActions, TabData, TileData } from '@/types/evals/grid';

/**
 * Hook to restore a tab and all its tiles from checkpoints
 */
export function useRestoreLastSavedTabWithTilesQuery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      tab_name, 
      interface_id,
      tab_actions,
      tile_actions
    }: { 
      tab_name: string; 
      interface_id: string;
      tab_actions: GranularTabActions;
      tile_actions: GranularTileActions;
    }) => {
      // Validate input
      if (!interface_id || !tab_name || !tab_actions || !tile_actions) {
        throw new Error('Missing required parameters for tab restoration');
      }

      // First, get the checkpointed tab data
      let tabData: TabData | null = null;
      try {
        tabData = await tab_actions.getByName(interface_id, tab_name, true);
        
        if (!tabData) {
          throw new Error('No checkpoint found for this tab');
        }
      } catch (error) {
        console.error('Error retrieving tab checkpoint:', error);
        throw new Error('Failed to retrieve tab checkpoint');
      }

      // Update the current tab with checkpoint data
      try {
        await tab_actions.updateByName(interface_id, tab_name, {
          name: tabData.name,
          global_context: tabData.global_context || "",
          color: tabData.color
        });
      } catch (error) {
        console.error('Error updating tab from checkpoint:', error);
        throw new Error('Failed to update tab from checkpoint');
      }

      // Get all the tiles associated with this tab
      let tileList: TileData[] = [];
      try {
        tileList = await tile_actions.list(tabData.id || "", undefined, true);
      } catch (error) {
        console.error('Error retrieving checkpoint tiles:', error);
      }

      let restoredTiles = 0;
      let failedTiles = 0;
      const tileErrors: string[] = [];

      // Restore each tile from checkpoint
      for (const tile of tileList) {
        try {
          if (tile.name && tabData.id) {
            // Update the tile with checkpoint data
            await tile_actions.updateByName(tabData.id, tile.name, {
              position: tile.position,
              context: tile.context,
              table: tile.table,
              table_tile: tile.table_tile,
              plot_tile: tile.plot_tile,
              view_tile: tile.view_tile,
              editor_tile: tile.editor_tile
            });
            restoredTiles++;
          }
        } catch (tileError) {
          console.error(`Error restoring tile ${tile.name}:`, tileError);
          failedTiles++;
          tileErrors.push(tile.name || "unknown");
        }
      }

      return {
        success: restoredTiles > 0,
        tabRestored: true,
        tilesRestored: restoredTiles,
        tilesFailed: failedTiles,
        tileErrors: tileErrors,
        message: `Tab restored with ${restoredTiles} tiles. ${failedTiles > 0 ? `(${failedTiles} tiles failed)` : ''}`
      };
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries to ensure UI reflects the latest data
      queryClient.invalidateQueries({ queryKey: ['tab', variables.interface_id, variables.tab_name] });
      
      // Invalidate tile queries
      if (variables.interface_id && variables.tab_name) {
        queryClient.invalidateQueries({ queryKey: ['tiles', variables.interface_id, variables.tab_name] });
      }
      
      // Invalidate the list of tabs
      queryClient.invalidateQueries({ queryKey: ['tabs', variables.interface_id] });
    }
  });
} 