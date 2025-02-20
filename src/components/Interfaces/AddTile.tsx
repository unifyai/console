import { TileProps } from "@/types/evals/grid";
import ActionButton from "../Common/Buttons/Action";
import { Plus } from "lucide-react";

const AddTile = ({
    edit,
    tileDropdown,
    project,
    pending,
    items,
    newCounter,
    setItems,
    setNewCounter,
    setTileDropdown,
}: {
    edit: boolean,
    tileDropdown?: { x: number, y: number },
    project: string | null,
    pending: boolean,
    items: TileProps[],
    newCounter: number,
    setItems: (items: TileProps[]) => void,
    setNewCounter: (newCounter: number) => void,
    setTileDropdown?: (tileDropdown: TileProps | undefined) => void,
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
                setItems([
                    ...items,
                    {
                        i: "Tile_" + newCounter,
                        x: tileDropdown?.x || (items.length * 2) % 12,
                        y: tileDropdown?.y || (items.length * 2) / 12,
                        w: 4,
                        h: 4,
                        minW: 4,
                        minH: 4,
                        tab: undefined,
                        visible: true,
                    }
                ]);
                setNewCounter(newCounter + 1);
                if (setTileDropdown)
                    setTileDropdown(undefined);
            }}
        />
    );
};

export default AddTile;
