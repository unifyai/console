"use client";

import { useEffect, useMemo, useState } from "react";
import ActionButton from "@/components/Common/Buttons/Action";
import { Snowflake, LoaderCircle } from "lucide-react";
import { useTileItem } from "@/contexts/hooks/tile/useTileItem";
import { useTile } from "@/contexts/hooks/tile/useTile";
import { useTableDataQuery } from "@/hooks/Interfaces/Query/useTableDataQuery";
import { showSuccessToast, showErrorToast } from "@/components/Common/Toasts/notifications";

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
    const { itemActions } = useTileItem(tileId, tabId);
    const item = useMemo(() => itemActions?.asTileItem(), [itemActions]);

    const { tableTile: tableTileState, dataActions: tileDataActions } = useTile(tileId, tabId);

    // Use React Query to access tableDataItem
    const { 
        data: tableDataItem,
        isLoading: isTableDataLoading,
        isError: isTableDataError,
        error: tableDataError
    } = useTableDataQuery(tileId || null, tabId || null);

    useEffect(() => {
        setLoading(false);
    },[tableDataItem?.logs])

    const onClick = async () => {
        setLoading(true);
        try {
            const isFreezing = !item?.freeze;
            const cutoff = isFreezing ? new Date().toISOString().replace("T", " ").replace("Z", "") : "";
    
            // This is a synchronous state update, so we don't need withLoadingToast
            await tileDataActions?.setFreeze(cutoff);

            showSuccessToast(
                isFreezing ? "Logs Frozen" : "Logs Unfrozen",
                isFreezing ? `Logs are now frozen at ${cutoff}` : "Displaying latest logs."
            );

        } catch (error) {
            showErrorToast(error, "Failed to update freeze state.");
        } 
        finally {
            setLoading(false);
        }
    }
    const variant = item?.freeze ? "primary" : "outline"
    const tooltip = item?.freeze ? `Get latest logs. (Current freeze: ${item.freeze})` : "Only get logs before freeze"

    const icon = loading ? <LoaderCircle className="animate-spin"/> : <Snowflake/>

    return (
        <ActionButton variant={variant} tooltip={tooltip} icon={icon} onClick={onClick}/>
    );
}

export default FreezeLogs;