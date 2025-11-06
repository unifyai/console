"use client";

import { useMutation } from '@tanstack/react-query';
import { GranularTabActions, GranularTileActions } from '@/types/interfaces/grid';
 

/**
 * Hook to save a tab and all its tiles as checkpoints
 */
export function useSaveTabWithTilesQuery(
  tab_actions: GranularTabActions,
  tile_actions: GranularTileActions,
  description?: string
) {
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
      let tabCheckpointResult: any;
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
      // Treat non-OK responses returned as { error } as failures
      if (tabCheckpointResult && typeof tabCheckpointResult === 'object' && 'error' in tabCheckpointResult) {
        throw new Error('Failed to create tab checkpoint');
      }

      // Then create checkpoints for all the tiles
      const tileResults: any[] = [];
      const tileErrors: string[] = [];

      for (const tile_id of tile_ids) {
        try {
          const tileResult = await tile_actions.checkpointById(tile_id, description || 'Manual save');
          if (tileResult && typeof tileResult === 'object' && 'error' in tileResult) {
            tileErrors.push(tile_id);
          } else {
            tileResults.push(tileResult);
          }
        } catch (error) {
          console.error(`Error creating checkpoint for tile ${tile_id}:`, error);
          tileErrors.push(tile_id);
          // Continue processing other tiles even if one fails
        }
      }

      if (tileErrors.length > 0) {
        throw new Error(`Failed to save ${tileErrors.length} tile(s)`);
      }

      return {
        success: true,
        tabCheckpoint: tabCheckpointResult,
        tileCheckpoints: tileResults,
        tileErrors: tileErrors
      };
    }
  });
} 