"use client";

import { useMemo } from "react";
import ActionButton from "@/components/Common/Buttons/Action";
import { Snowflake } from "lucide-react";
import { useTileItem } from "@/contexts/hooks/tile/useTileItem";
import { useTile } from "@/contexts/hooks/tile/useTile";

const FreezeLogs = ({ tileId, tabId, interfaceId, projectId }: {
    tileId: string,
    tabId: string,
    interfaceId: string,
    projectId: string
}) => {

    // Get the item representation for the current tile
    const { itemActions } = useTileItem(tileId, tabId, interfaceId);
    const item = useMemo(() => itemActions?.asTileItem(), [itemActions]);

    const { dataActions: tileDataActions } = useTile(tileId, tabId, interfaceId, projectId);

    const onClick = () => {
        if (item?.freeze) {
            tileDataActions?.setFreeze("")
        } else {
            const cutoff = new Date().toISOString().replace("T", " ").replace("Z", "")
            tileDataActions?.setFreeze(cutoff)
        }
    }
    const variant = item?.freeze ? "primary" : "outline"
    const tooltip = item?.freeze ? `Get latest logs. (Current freeze: ${item.freeze})` : "Only get logs before freeze"

    return (
        <ActionButton variant={variant} tooltip={tooltip} icon={<Snowflake/>} onClick={onClick}/>
    );
}

export default FreezeLogs;