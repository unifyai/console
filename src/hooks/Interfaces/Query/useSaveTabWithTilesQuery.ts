"use client";

import { useMutation } from '@tanstack/react-query';
import { GranularTabActions, GranularTileActions } from '@/types/interfaces/grid';
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook to save a tab and all its tiles as checkpoints
 */
export function useSaveTabWithTilesQuery(
  tab_actions: GranularTabActions,
  tile_actions: GranularTileActions,
  description?: string
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      tab_id, 
      tab_name, 
      interface_id, 
      tile_ids 
    }: { 
      tab_id?: string; 
      tab_name?: string; 
      interface_id?: string; 
      tile_ids: string[] 
    }) => {
      // Validate input
      if ((!tab_id && (!interface_id || !tab_name)) || !tile_ids.length) {
        throw new Error('Missing required parameters for tab checkpoint creation');
      }

      // First create a checkpoint for the tab
      let tabCheckpointResult;
      try {
        if (tab_id) {
          tabCheckpointResult = await tab_actions.checkpointById(tab_id, description || 'Manual save');
        } else if (interface_id && tab_name) {
          tabCheckpointResult = await tab_actions.checkpointByName(interface_id, tab_name, description || 'Manual save');
        }
      } catch (error) {
        console.error('Error creating tab checkpoint:', error);
        throw new Error('Failed to create tab checkpoint');
      }

      // Then create checkpoints for all the tiles
      const tileResults = [];
      const tileErrors = [];

      for (const tile_id of tile_ids) {
        try {
          const tileResult = await tile_actions.checkpointById(tile_id, description || 'Manual save');
          tileResults.push(tileResult);
        } catch (error) {
          console.error(`Error creating checkpoint for tile ${tile_id}:`, error);
          tileErrors.push(tile_id);
          // Continue processing other tiles even if one fails
        }
      }

      return {
        success: tileErrors.length < tile_ids.length,
        tabCheckpoint: tabCheckpointResult,
        tileCheckpoints: tileResults,
        tileErrors: tileErrors
      };
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries to ensure UI reflects the latest data
      if (variables.tab_id) {
        queryClient.invalidateQueries({ queryKey: ['tab', variables.tab_id] });
        queryClient.invalidateQueries({ queryKey: ['tab', variables.tab_id, true] }); // checkpoint version
      }
      
      if (variables.interface_id && variables.tab_name) {
        queryClient.invalidateQueries({ queryKey: ['tab', variables.interface_id, variables.tab_name] });
        queryClient.invalidateQueries({ queryKey: ['tab', variables.interface_id, variables.tab_name, true] }); // checkpoint version
      }
      
      // Invalidate queries for tiles
      for (const tileId of variables.tile_ids) {
        queryClient.invalidateQueries({ queryKey: ['tile', tileId] });
        queryClient.invalidateQueries({ queryKey: ['tile', tileId, true] }); // checkpoint version
      }
      
      // Also invalidate the list of tabs in case this affects tab metadata
      if (variables.interface_id) {
        queryClient.invalidateQueries({ queryKey: ['tabs', variables.interface_id] });
      }
      
      // If we have a tab_id, invalidate all tiles for that tab
      if (variables.tab_id) {
        queryClient.invalidateQueries({ queryKey: ['tiles', variables.tab_id] });
      }
    }
  });
} 