import { TileProps } from "@/types/evals/grid";
import ActionButton from "../Common/Buttons/Action";
import { Plus } from "lucide-react";

const AddTile = ({
    edit,
    project,
    pending,
    items,
    newCounter,
    setItems,
    setNewCounter,
}: {
    edit: boolean,
    project: string | null,
    pending: boolean,
    items: TileProps[],
    newCounter: number,
    setItems: (items: TileProps[]) => void,
    setNewCounter: (newCounter: number) => void,
}) => {
    return (
        <ActionButton
            className="transition-all"
            tooltip={(!edit || !project) ? "Select a project first" : "Add new tile"}
            icon={<Plus />}
            text="Add Tile"
            variant="outline"
            disabled={!edit || !project || pending}
            onClick={() => {
                let initialIndex = items.length;
                while (items.some(item => item.i == "Tile_" + initialIndex))
                    initialIndex++;
                const newTileName = "Tile_" + initialIndex;
                setItems([
                    ...items,
                    {
                        i: newTileName,
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
                        w: 4,
                        h: 4,
                        minW: undefined,
                        minH: undefined,
                        tab: undefined,
                        visible: true,
                    }
                ]);
                setNewCounter(items.length + 1);
            }}
        />
    );
};

export default AddTile;
