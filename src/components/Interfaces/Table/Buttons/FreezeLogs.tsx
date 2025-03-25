"use client";

import { useEffect, useMemo, useState } from "react";
import ActionButton from "@/components/Common/Buttons/Action";
import { Snowflake, LoaderCircle } from "lucide-react";
import { useTileItem } from "@/contexts/hooks/tile/useTileItem";
import { useTile } from "@/contexts/hooks/tile/useTile";

const FreezeLogs = ({ tileId, tabId, interfaceId, projectId }: {
    tileId: string,
    tabId: string,
    interfaceId: string,
    projectId: string
}) => {
    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    const [spinnerColor, setSpinnerColor] = useState("white");

    // Get the item representation for the current tile
    const { itemActions } = useTileItem(tileId, tabId, interfaceId);
    const item = useMemo(() => itemActions?.asTileItem(), [itemActions]);

    const { tableTile: tableTileState, dataActions: tileDataActions } = useTile(tileId, tabId, interfaceId, projectId);

    useEffect(() => {
        setLoading(false);
    },[tableTileState?.tableDataItem?.logs])

    const onClick = () => {
        setLoading(true)
        if (item?.freeze) {
            setSpinnerColor("primary")
            tileDataActions?.setFreeze("")
        } else {
            setSpinnerColor("white")
            const cutoff = new Date().toISOString().replace("T", " ").replace("Z", "")
            tileDataActions?.setFreeze(cutoff)
        }
    }
    const variant = item?.freeze ? "primary" : "outline"
    const tooltip = item?.freeze ? `Get latest logs. (Current freeze: ${item.freeze})` : "Only get logs before freeze"

    const icon = loading ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> : <Snowflake/>

    return (
        <ActionButton variant={variant} tooltip={tooltip} icon={icon} onClick={onClick}/>
    );
}

export default FreezeLogs;