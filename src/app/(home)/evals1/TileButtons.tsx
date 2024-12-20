import ActionButton from "@/components/Common/Buttons/Action";
import { Minus, Plus } from "lucide-react";

const TileButtons = ({ side, full, empty, onClick }: {
    side: "right" | "left" | "top" | "bottom",
    full: boolean,
    empty: boolean,
    onClick: (type: "add" | "remove") => void
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
        </div>
    )
};

export default TileButtons;
