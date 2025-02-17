"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import { Snowflake } from "lucide-react";
import { ItemType, TileProps } from "@/types/evals/grid";

const FreezeLogs = ({ item, updateItem }: {
    item: TileProps,
    updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void,
}) => {

    const onClick = () => {
        if (item.freeze) {
            updateItem(item, "freeze")("")
        } else {
            const cutoff = new Date().toISOString().replace("T", " ").replace("Z", "")
            updateItem(item, "freeze")(cutoff)
        }
    }
    const variant = item.freeze ? "primary" : "outline"
    const tooltip = item.freeze ? `Get latest logs. (Current freeze: ${item.freeze})` : "Only get logs before freeze"

    return (
        <ActionButton variant={variant} tooltip={tooltip} icon={<Snowflake/>} onClick={onClick}/>
    );
}

export default FreezeLogs;