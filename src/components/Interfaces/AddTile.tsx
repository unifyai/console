import { TileProps } from "@/types/evals/grid";
import ActionButton from "../Common/Buttons/Action";
import { Plus } from "lucide-react";
import { useTab } from "@/contexts/hooks/useTab";
import { useMemo } from "react";

const AddTile = ({
    project,
    tabId,
    newCounter,
    setNewCounter,
}: {
    project: string | null,
    tabId: string,
    newCounter: number,
    setNewCounter: (newCounter: number) => void,
}) => {
    // Get tab data and actions using useTab hook
    const { tab, actions, exists } = useTab(tabId);
    
    // Use the getItems function from the useTab hook to get TileProps array
    const items = useMemo(() => {
        return !exists || !actions ? [] : actions.getItems().filter(item => item.visible !== false);
    }, [exists, actions]);

    return (
        <ActionButton
            className="transition-all"
            tooltip={(!tab?.edit || !project) ? "Select a project first" : "Add new tile"}
            icon={<Plus />}
            text="Add Tile"
            variant="outline"
            disabled={!tab?.edit || !project || tab?.pending || !exists}
            onClick={() => {
                const newTileId = "Tile_" + newCounter;
                
                // Calculate the best position for the new tile
                const position = {
                    x: (() => {
                        // Group items by row
                        const rowGroups = items.reduce((acc, item) => {
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
                        const rowGroups = items.reduce((acc, item) => {
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
                actions?.initTile(newTileId, {
                    name: newTileId,
                    position,
                    visible: true,
                });

                setNewCounter(newCounter + 1);
            }}
        />
    );
};

export default AddTile;
