"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { Merge, Minus, Plus } from "lucide-react";

const TileButtons = ({ side, full, empty, mergable, onClick }: {
    side: "right" | "left" | "top" | "bottom",
    full?: boolean,
    empty: boolean,
    mergable: (side: "left" | "right" | "top" | "bottom") => boolean,
    onClick: (side: "left" | "right" | "top" | "bottom", type: "add" | "reset" | "merge") => void
}) => {
    const leftOrRight = side === "left" || side === "right";
    return (
        <div className={`mx-auto ${leftOrRight ? "" : "flex"}`}>
            {!full && (side == "right" || side == "bottom") && <div className={`${leftOrRight ? "m-2" : "m-1"}`}>
                <ActionButton
                    tooltip={`Add New (${side})`}
                    variant={"primary"}
                    icon={<Plus />}
                    onClick={() => onClick(side, "add")}
                />
            </div>}
            {!empty && <div className={`${leftOrRight ? "m-2" : "m-1"}`}>
                <ActionButton
                    tooltip="Reset Tile"
                    variant={"destructive"}
                    icon={<Minus />}
                    onClick={() => onClick(side, "reset")}
                />
            </div>}
            {mergable(side) && <div className={`${leftOrRight ? "m-2" : "m-1"}`}>
                <ActionButton
                    tooltip="Merge Tiles"
                    variant={"secondary"}
                    icon={<Merge />}
                    onClick={() => onClick(side, "merge")}
                    className="hover:bg-secondary"
                />
            </div>}
        </div>
    )
};

export default TileButtons;
