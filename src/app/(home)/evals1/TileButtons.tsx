import ActionButton from "@/components/Common/Buttons/Action";
import { Merge, Minus, Plus } from "lucide-react";

const TileButtons = ({ side, full, empty, merge, onClick }: {
    side: "right" | "left" | "top" | "bottom",
    full: boolean,
    empty: boolean,
    merge: boolean
    onClick: (type: "add" | "remove" | "merge") => void
}) => {
    const leftOrRight = side === "left" || side === "right";
    return (
        <div className={`mx-auto ${leftOrRight ? "" : "flex"}`}>
            {!full &&<div className={`${leftOrRight ? "m-2" : "m-1"}`}>
                <ActionButton
                    tooltip={`Add New (${side})`}
                    variant={"primary"}
                    icon={<Plus />}
                    onClick={() => onClick("add")}
                />
            </div>}
            {!empty && <div className={`${leftOrRight ? "m-2" : "m-1"}`}>
                <ActionButton
                    tooltip="Remove Tile"
                    variant={"destructive"}
                    icon={<Minus />}
                    onClick={() => onClick("remove")}
                />
            </div>}
            {merge && <div className={`${leftOrRight ? "m-2" : "m-1"}`}>
                <ActionButton
                    tooltip="Merge Tiles"
                    variant={"secondary"}
                    icon={<Merge />}
                    onClick={() => onClick("merge")}
                    className="hover:bg-secondary"
                />
            </div>}
        </div>
    )
};

export default TileButtons;
