import { TileProps } from "@/types/evals/grid";
import ActionButton from "../Common/Buttons/Action";
import { Plus } from "lucide-react";
import { useTab } from "@/contexts/hooks/tab";
import { useMemo } from "react";

const AddTile = ({
    project,
    interfaceId,
    tabId,
    anyTileLoading,
}: {
    project: string | null,
    interfaceId: string,
    tabId: string,
    anyTileLoading: boolean,
}) => {
    // Get tab data and actions using useTab hook with granular access
    const { ui: tabUIState, dataActions: tabDataActions, exists } = useTab(tabId, interfaceId);

    // Use the getItems function from the useTab hook to get TileProps array
    const [items, visibleItems] = useMemo(() => {
        const allItems = tabDataActions?.getItems();
        return !exists || !tabDataActions ? [[], []] : [
            allItems as TileProps[],
            allItems?.filter(item => item.visible) as TileProps[]
        ];
    }, [exists, tabDataActions]);

    return (
        <ActionButton
            className="transition-all"
            tooltip={(!tabUIState?.edit || !project) ? "Select a project first" : "Add new tile"}
            icon={<Plus />}
            // text="Add Tile"
            variant="ghost"
            disabled={!tabUIState?.edit || !project || !exists || tabUIState?.pending || tabUIState?.resetting || anyTileLoading}
            onClick={() => {
                let initialIndex = items.length;
                while (items.some(item => item.name == "Tile_" + initialIndex))
                    initialIndex++;
                const newTileName = "Tile_" + initialIndex;

                // Calculate the best position for the new tile
                const position = {
                    x: (() => {
                        // Group items by row
                        const rowGroups = visibleItems.reduce((acc, item) => {
                            const row = Math.floor(item.y);
                            if (!acc[row]) acc[row] = [];
                            acc[row].push(item);
                            return acc;
                        }, {} as Record<number, TileProps[]>);

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
                        const rowGroups = visibleItems.reduce((acc, item) => {
                            const row = Math.floor(item.y);
                            if (!acc[row]) acc[row] = [];
                            acc[row].push(item);
                            return acc;
                        }, {} as Record<number, TileProps[]>);

                        const rows = Object.keys(rowGroups).map(Number).sort();
                        
                        // Try to find space in existing rows first
                        for (const row of rows) {
                            const rowItems = rowGroups[row];
                            const rowSpace = rowItems.reduce((occupied, item) => {
                                occupied.push({start: item.x, end: item.x + item.w});
                                return occupied;
                            }, [] as {start: number, end: number}[]);

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
                tabDataActions?.initTile(newTileName, {
                    name: newTileName,
                    position,
                    minW: undefined,
                    minH: undefined,
                    type: null,
                    visible: true,
                });

            }}
        />
    );
};

export default AddTile;
