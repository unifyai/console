"use client";

import { useEffect, useState, useRef } from "react";
import { TableCell } from "@/components/UI/table";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import { CSSProperties } from "react";
import { DropdownMenuCheckboxItem } from "@/components/UI/dropdown-menu";
import { metrics } from "@/constants/logs";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { GroupedLogProps, LogProps } from "@/types/interfaces/logs";
import { withDelayedLoadingToast } from "@/components/Common/Toasts/notifications";
import { useTableMetricsQuery, useInvalidateTableMetrics } from "@/hooks/Interfaces/Query/useTableDataQuery";
import { useTileData } from "@/contexts/hooks";
import { LogsActions } from "@/types/interfaces/grid";

const style: CSSProperties = {
    cursor: "default",
    position: "sticky",
    transition: "width transform 0.2s ease-in-out",
    whiteSpace: "nowrap",
    zIndex: 1,
};

const ColumnMetrics = ({
    tileId,
    tabId,
    projectId,
    interactive, 
    metric, 
    setMetric, 
    colSpan = 1, 
    logs,
    entriesProperties,
	paramsProperties,
	filterExpression,
	logsActions
}: {
    tileId?: string,
    tabId?: string,
    projectId: string | undefined;
    interactive: boolean, 
    metric: string, 
    setMetric: (x: string) => void, 
    colSpan?: number, 
    logs: LogProps[] | GroupedLogProps[],
    entriesProperties: string[],
	paramsProperties: string[],
	filterExpression: string | null,
	logsActions: LogsActions
}) => {
    
    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    const showSuccessRef = useRef<(() => void) | null>(null);
    
    const { data: tileDataState } = useTileData(tileId || null, tabId || null);

    // Monitor the same query that SummaryCell triggers (reactive state tracking)
    const columns = logs.length > 0 ? [...entriesProperties, ...paramsProperties] : [];
    const { isLoading: isMetricsLoading, isFetching, dataUpdatedAt } = useTableMetricsQuery(
        tileId || null,
        tabId || null,
        false, // disabled - only monitor reactively, don't trigger
        logsActions,
        projectId,
        tileDataState?.context,
        tileDataState?.column_context,
        columns,
        filterExpression,
        tileDataState?.metric || "mean",
        "ColumnMetrics" // caller identifier
    );
    
    const { resetMetrics } = useInvalidateTableMetrics(
        tileId || null, 
        tabId || null,
        projectId,
        tileDataState?.context,
        tileDataState?.column_context,
        columns,
        filterExpression,
        tileDataState?.metric || "mean"
    );
    
    // Track when metrics finish loading to show success toast
    const prevDataUpdatedAtRef = useRef(dataUpdatedAt);
    const prevIsFetchingRef = useRef(isFetching);
    
    useEffect(() => {
        // If metrics were fetching and now they're not, and the data updated
        if (
            prevIsFetchingRef.current && 
            !isFetching && 
            !isMetricsLoading &&
            dataUpdatedAt !== prevDataUpdatedAtRef.current &&
            showSuccessRef.current
        ) {
            // New metrics have been loaded, show success toast
            showSuccessRef.current();
            showSuccessRef.current = null;
            setLoading(false);
        }
        
        prevIsFetchingRef.current = isFetching;
        prevDataUpdatedAtRef.current = dataUpdatedAt;
    }, [isFetching, isMetricsLoading, dataUpdatedAt]);

    useEffect(() => {
        // Reset loading when logs change (fallback)
        setLoading(false);
    }, [logs])
    
    const onClick = async (metric_: string) => {
        try {
            const { showSuccess } = await withDelayedLoadingToast(
                async () => {
                    // Reset current metrics to trigger loading state
                    resetMetrics();
                    setLoading(true);
                    
                    // Set the new metric (this will trigger background refetch)
                    setMetric(metric_);
                },
                {
                    loading: "Updating metric...",
                    success: `Metric changed to ${metric_}.`,
                    error: "Failed to change metric."
                }
            );
            
            // Store the success function to call later when metrics are loaded
            showSuccessRef.current = showSuccess;
            
        } catch (error) {
            setLoading(false);
            showSuccessRef.current = null;
        }
    }

    return (
        <TableCell style={style} colSpan={colSpan} className="text-left">
            <BaseDropdown context="tile" button={<ActionButton tooltip="Select metric" text={metric} icon={(loading || isMetricsLoading || isFetching) ? <LoaderCircle className="animate-spin text-primary"/> : <ChevronDown />} disabled={!interactive || loading || isMetricsLoading || isFetching} />} open={interactive ? undefined : false}>
                {metrics.map((metric_, index) =>
                    <DropdownMenuCheckboxItem checked={metric === metric_} key={index} onClick={() => onClick(metric_)}>
                        {metric_}
                    </DropdownMenuCheckboxItem>
                )}
            </BaseDropdown>
        </TableCell>
    )
}

export default ColumnMetrics;
