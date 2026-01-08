'use client';

import { useMutation } from '@tanstack/react-query';
import { GranularTabActions, GranularTileActions } from '@/types/interfaces/grid';

/**
 * Hook to save a tab and all its tiles as checkpoints
 */
export function useSaveTabWithTilesQuery(
  tabActions: GranularTabActions,
  tileActions: GranularTileActions,
  description?: string
) {
  return useMutation({
    mutationFn: async ({
      tabId,
      tabName,
      interfaceId,
      tileIds,
    }: {
      tabId?: string;
      tabName?: string;
      interfaceId?: string;
      tileIds: string[];
    }) => {
      // Validate input
      if ((!tabId && (!interfaceId || !tabName)) || !tileIds.length) {
        throw new Error('Missing required parameters for tab checkpoint creation');
      }

      // First create a checkpoint for the tab
      let tabCheckpointResult: any;
      try {
        if (tabId) {
          tabCheckpointResult = await tabActions.checkpointById(
            tabId,
            description || 'Manual save'
          );
        } else if (interfaceId && tabName) {
          tabCheckpointResult = await tabActions.checkpointByName(
            interfaceId,
            tabName,
            description || 'Manual save'
          );
        }
      } catch (error) {
        console.error('Error creating tab checkpoint:', error);
        throw new Error('Failed to create tab checkpoint');
      }
      // Treat non-OK responses returned as { error } as failures
      if (
        tabCheckpointResult &&
        typeof tabCheckpointResult === 'object' &&
        'error' in tabCheckpointResult
      ) {
        throw new Error('Failed to create tab checkpoint');
      }

      // Then create checkpoints for all the tiles
      const tileResults: any[] = [];
      const tileErrors: { id: string; error: string }[] = [];

      for (const tileId of tileIds) {
        try {
          const tileResult = await tileActions.checkpointById(tileId, description || 'Manual save');
          if (tileResult && typeof tileResult === 'object' && 'error' in tileResult) {
            const errorMsg = tileResult.error || 'Unknown error';
            console.warn(`Tile checkpoint failed for ${tileId}: ${errorMsg}`);
            tileErrors.push({ id: tileId, error: errorMsg });
          } else {
            tileResults.push(tileResult);
          }
        } catch (error) {
          const errorMsg = (error as Error)?.message || 'Unknown error';
          console.error(`Error creating checkpoint for tile ${tileId}:`, errorMsg);
          tileErrors.push({ id: tileId, error: errorMsg });
          // Continue processing other tiles even if one fails
        }
      }

      if (tileErrors.length > 0) {
        // Aggregate error message with details
        const errorDetails = tileErrors.map((e) => `${e.id}: ${e.error}`).join(', ');
        console.error('Save failed for tiles:', errorDetails);
        throw new Error(`Failed to save ${tileErrors.length} tile(s)`);
      }

      return {
        success: true,
        tabCheckpoint: tabCheckpointResult,
        tileCheckpoints: tileResults,
        tileErrors: tileErrors,
      };
    },
  });
}
