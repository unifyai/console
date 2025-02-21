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
                setItems([
                    ...items,
                    {
                        i: "Tile_" + newCounter,
                        x: (items.length * 2) % 12,
                        y: (items.length * 2) / 12,
                        w: 4,
                        h: 4,
                        minW: 4,
                        minH: 4,
                        tab: undefined,
                        visible: true,
                    }
                ]);
                setNewCounter(newCounter + 1);
            }}
        />
    );
};

export default AddTile;
