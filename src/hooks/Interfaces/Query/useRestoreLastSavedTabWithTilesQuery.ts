'use client';

import { useMutation } from '@tanstack/react-query';
import {
  GranularInterfaceActions,
  GranularTabActions,
  GranularTileActions,
  InterfaceData,
  TabData,
  TileData,
} from '@/types/interfaces/grid';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook to restore a complete interface structure (interface, tab, and tiles) from checkpoints
 */
export function useRestoreLastSavedTabWithTilesQuery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      interfaceId,
      projectId,
      interfaceName,
      tabName,
      interfaceActions,
      tabActions,
      tileActions,
    }: {
      interfaceId?: string;
      projectId?: string;
      interfaceName?: string;
      tabName?: string;
      interfaceActions: GranularInterfaceActions;
      tabActions: GranularTabActions;
      tileActions: GranularTileActions;
    }) => {
      // Validate input
      if (
        (!interfaceId && (!projectId || !interfaceName)) ||
        !interfaceActions ||
        !tabActions ||
        !tileActions
      ) {
        throw new Error('Missing required parameters for restoration');
      }

      // Step 1: Get the current (non-checkpointed) interface data first
      let currentInterfaceData: InterfaceData | null = null;
      try {
        if (interfaceId) {
          currentInterfaceData = await interfaceActions.getById(interfaceId);
        } else if (projectId && interfaceName) {
          currentInterfaceData = await interfaceActions.getByName(projectId, interfaceName);
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
        if (interfaceId) {
          checkpointedInterfaceData = await interfaceActions.getCheckpointById(interfaceId);
        } else if (projectId && interfaceName) {
          checkpointedInterfaceData = await interfaceActions.getCheckpointByName(
            projectId,
            interfaceName
          );
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
        // If tabName is provided, use it, otherwise use active tab
        if (tabName) {
          currentTabData = await tabActions.getByName(currentInterfaceData.id, tabName);
        } else if (currentInterfaceData.activeTabId) {
          currentTabData = await tabActions.getById(currentInterfaceData.activeTabId);
        } else {
          // Fetch all tabs and get the first one
          const tabs = await tabActions.list(currentInterfaceData.id);
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
          checkpointedTabData = await tabActions.getCheckpointByName(
            currentInterfaceData.id,
            currentTabData.name
          );
        } else if (currentTabData.id) {
          checkpointedTabData = await tabActions.getCheckpointById(currentTabData.id);
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
        checkpointedTileList = await tileActions.list(currentTabData.id, undefined, true);
      } catch (error) {
        console.error('Error retrieving tile checkpoints:', error);
        // Continue even if there are no tiles
      }

      // Step 6: Now that we have all the checkpoint data, start restoring
      // First, update the interface
      try {
        if (interfaceId) {
          await interfaceActions.updateById(interfaceId, {
            name: checkpointedInterfaceData.name,
            color: checkpointedInterfaceData.color,
            activeTabId: currentInterfaceData.activeTabId, // Keep the current active tab ID
          });
        } else if (projectId && interfaceName) {
          await interfaceActions.updateByName(projectId, interfaceName, {
            name: checkpointedInterfaceData.name,
            color: checkpointedInterfaceData.color,
            activeTabId: currentInterfaceData.activeTabId, // Keep the current active tab ID
          });
        }
      } catch (error) {
        console.error('Error updating interface from checkpoint:', error);
        throw new Error('Failed to update interface from checkpoint');
      }

      // Next, update the tab
      try {
        if (currentTabData.id) {
          await tabActions.updateById(currentTabData.id, {
            name: checkpointedTabData.name,
            context: checkpointedTabData.context || '',
            color: checkpointedTabData.color,
            active: true,
            visible: checkpointedTabData.visible,
            order: checkpointedTabData.order,
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
        currentTiles = await tileActions.list(currentTabData.id);
      } catch (error) {
        console.error('Error retrieving current tiles:', error);
      }

      for (const checkpointedTile of checkpointedTileList) {
        try {
          if (checkpointedTile.name) {
            // Try to find matching current tile by name
            const matchingTile = currentTiles.find((t) => t.name === checkpointedTile.name);

            if (matchingTile && matchingTile.id) {
              // Update the existing tile with checkpoint data
              await tileActions.updateById(matchingTile.id, {
                name: checkpointedTile.name,
                position: checkpointedTile.position,
                visible: checkpointedTile.visible,
                locked: checkpointedTile.locked,
                color: checkpointedTile.color,
                context: checkpointedTile.context,
                table: checkpointedTile.table,
                autoUpdate: checkpointedTile.autoUpdate,
                freeze: checkpointedTile.freeze,
                filters: checkpointedTile.filters,
                commonFilter: checkpointedTile.commonFilter,
                metric: checkpointedTile.metric,
                columnContext: checkpointedTile.columnContext,
                grouping: checkpointedTile.grouping,
                tableTile: checkpointedTile.tableTile,
                plotTile: checkpointedTile.plotTile,
                viewTile: checkpointedTile.viewTile,
                editorTile: checkpointedTile.editorTile,
                terminalTile: checkpointedTile.terminalTile,
              });
              restoredTiles++;
            } else {
              // Tile doesn't exist in current tab, create it
              await tileActions.create(
                currentTabData.id,
                checkpointedTile.name,
                checkpointedTile.position,
                {
                  minW: checkpointedTile.minW,
                  minH: checkpointedTile.minH,
                  visible: checkpointedTile.visible,
                  locked: checkpointedTile.locked,
                  color: checkpointedTile.color,
                  context: checkpointedTile.context,
                  table: checkpointedTile.table,
                  autoUpdate: checkpointedTile.autoUpdate,
                  freeze: checkpointedTile.freeze,
                  filters: checkpointedTile.filters,
                  commonFilter: checkpointedTile.commonFilter,
                  metric: checkpointedTile.metric,
                  columnContext: checkpointedTile.columnContext,
                  grouping: checkpointedTile.grouping,
                  tableTile: checkpointedTile.tableTile,
                  plotTile: checkpointedTile.plotTile,
                  viewTile: checkpointedTile.viewTile,
                  editorTile: checkpointedTile.editorTile,
                  terminalTile: checkpointedTile.terminalTile,
                },
                undefined,
                checkpointedTile.type
              );
              restoredTiles++;
            }
          }
        } catch (tileError) {
          console.error(`Error restoring tile ${checkpointedTile.name}:`, tileError);
          failedTiles++;
          tileErrors.push(checkpointedTile.name || 'unknown');
        }
      }

      return {
        success: true,
        interfaceRestored: true,
        tabRestored: true,
        tilesRestored: restoredTiles,
        tilesFailed: failedTiles,
        tileErrors: tileErrors,
        message: `Interface and tab restored with ${restoredTiles} tiles. ${failedTiles > 0 ? `(${failedTiles} tiles failed)` : ''}`,
      };
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries to ensure UI reflects the latest data
      if (variables.interfaceId) {
        queryClient.invalidateQueries({ queryKey: ['interface-by-id', variables.interfaceId] });
      }

      if (variables.projectId && variables.interfaceName) {
        queryClient.invalidateQueries({
          queryKey: ['interface', variables.projectId, variables.interfaceName],
        });
        queryClient.invalidateQueries({
          queryKey: ['interfaces', variables.projectId],
        });
      }

      // Invalidate all tab and tile queries since we've potentially changed everything
      queryClient.invalidateQueries({ queryKey: ['tabs'] });
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
      queryClient.invalidateQueries({ queryKey: ['tab-with-tiles'] });
    },
  });
}
