import { GranularTabActions, GranularTileActions, TileProps } from '@/types/interfaces/grid';
import ActionButton from '@/components/Common/Buttons/Action';
import { Plus } from 'lucide-react';
import { useTab } from '@/contexts/hooks/tab';
import { useMemo } from 'react';
import { useTabSync } from '@/contexts/hooks/tab/sync';
import { useGlobalUIMode } from '@/contexts/hooks/useGlobalUIMode';

const AddTile = ({
  tabId,
  interfaceId,
  project,
  anyTileLoading,
  tabActions,
  tileActions,
}: {
  tabId: string;
  interfaceId: string;
  project: string | null;
  anyTileLoading: boolean;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
}) => {
  // Get tab data and actions using useTab hook with granular access
  const { ui: tabUIState, exists } = useTab(tabId, interfaceId);

  // Get global UI mode settings
  const { isEditMode } = useGlobalUIMode();

  // SYNCHRONISED TAB-SPECIFIC ACTIONS (optimistic + router refresh)
  const { actions: syncedTabActions } = useTabSync(tabId, interfaceId, tabActions, tileActions);
  const syncedTabDataActions = syncedTabActions?.data ?? null;

  // Use the getItems function from the useTab hook to get TileProps array
  const [items, visibleItems] = useMemo(() => {
    const allItems = syncedTabDataActions?.getItems();
    return !exists || !syncedTabDataActions
      ? [[], []]
      : [allItems as TileProps[], allItems?.filter((item) => item.visible) as TileProps[]];
  }, [exists, syncedTabDataActions]);

  return (
    <ActionButton
      className="bg-background/90 border-border/50 border shadow-md backdrop-blur-sm transition-all"
      tooltip={!isEditMode || !project ? 'Select a project first' : 'Add new tile'}
      icon={<Plus />}
      variant="outline"
      disabled={
        !isEditMode ||
        !project ||
        !exists ||
        tabUIState?.pending ||
        tabUIState?.resetting ||
        anyTileLoading
      }
      onClick={() => {
        let initialIndex = items.length;
        while (items.some((item) => item.name == 'Tile_' + initialIndex)) initialIndex++;
        const newTileName = 'Tile_' + initialIndex;

        // Calculate the best position for the new tile
        const position = {
          x: (() => {
            // Group items by row
            const rowGroups = visibleItems.reduce(
              (acc, item) => {
                const row = Math.floor(item.y);
                if (!acc[row]) acc[row] = [];
                acc[row].push(item);
                return acc;
              },
              {} as Record<number, TileProps[]>
            );

            // Try to find space in existing rows first
            const rows = Object.keys(rowGroups).map(Number).sort();
            for (const row of rows) {
              const rowItems = rowGroups[row];
              // Sort items by x position
              rowItems.sort((a, b) => a.x - b.x);

              // Check for gaps between items
              let x = 0;
              for (const item of rowItems) {
                if (item.x - x >= 4) {
                  return x; // Found space
                }
                x = item.x + item.w;
              }

              // Check if there's space at the end of row
              if (x <= 8) {
                return x;
              }
            }

            // If no space in existing rows, start a new row
            return 0;
          })(),
          y: (() => {
            // Group items by row
            const rowGroups = visibleItems.reduce(
              (acc, item) => {
                const row = Math.floor(item.y);
                if (!acc[row]) acc[row] = [];
                acc[row].push(item);
                return acc;
              },
              {} as Record<number, TileProps[]>
            );

            const rows = Object.keys(rowGroups).map(Number).sort();

            // Try to find space in existing rows first
            for (const row of rows) {
              const rowItems = rowGroups[row];
              const rowSpace = rowItems.reduce(
                (occupied, item) => {
                  occupied.push({ start: item.x, end: item.x + item.w });
                  return occupied;
                },
                [] as { start: number; end: number }[]
              );

              // Check if there's a gap of width 4 in this row
              let x = 0;
              for (const space of rowSpace) {
                if (space.start - x >= 4) {
                  return row;
                }
                x = space.end;
              }
              if (x <= 8) {
                return row;
              }
            }

            // If no space found, create new row
            return rows.length ? Math.max(...rows) + 4 : 0;
          })(),
          width: 4,
          height: 4,
        };

        // Initialize the new tile with the calculated position
        syncedTabDataActions?.initTile(newTileName, {
          position,
          minW: null,
          minH: null,
          type: null,
          visible: true,
        });
      }}
    />
  );
};

export default AddTile;
