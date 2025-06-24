"use client";

import { Dispatch, SetStateAction, useState } from "react";
import ActionButton from "@/components/Common/Buttons/Action";
import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { clearCanvas } from "@/utils/evals/plots/canvas";
import { clearFixedTooltip } from "@/utils/evals/plots/tooltip";
import { GrClearOption } from "react-icons/gr";
import * as d3 from "d3";

const PlotReset = ({settingsRef, svgRef, containerRef, setXAxis, setYAxis, setGroupBy, setAggregateProperty, setIsTooltipMinimized, setZoomEnabled}: {
    settingsRef: any,
    svgRef: any,
    containerRef: any,
    setXAxis: ((x: string | undefined) => void) | undefined,
    setYAxis: ((x: string | undefined) => void) | undefined,
    setGroupBy: ((x: string | undefined) => void) | undefined,
    setAggregateProperty: ((x: string | undefined) => void) | undefined
    setIsTooltipMinimized: Dispatch<SetStateAction<boolean>>,
    setZoomEnabled?: ((enabled: boolean) => void) | undefined;
}) => {
    const settings = d3.select(settingsRef.current);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const handleClearPlot = async () => {
        if (setXAxis) setXAxis(undefined);
        if (setYAxis) setYAxis(undefined);
        if (setGroupBy) setGroupBy(undefined);
        if (setAggregateProperty) setAggregateProperty(undefined);
        if (setZoomEnabled) setZoomEnabled(false);
        clearCanvas(svgRef, containerRef);
        clearFixedTooltip(settings, setIsTooltipMinimized);
        return { info: "Plot cleared successfully" };
    };

    return (
        <>
            <ActionButton
                icon={<GrClearOption/>}
                text="Clear Plot"
                tooltip="Clear all plot settings and data"
                onClick={() => setShowDeleteDialog(true)}
                variant="destructive"
                className="w-full justify-start"
            />
            
            {/* Clear confirmation dialog */}
            <DeleteDialog
                args={[]}
                type="plot configuration"
                deletingFunction={handleClearPlot}
                showDialog={showDeleteDialog}
                setShowDialog={setShowDeleteDialog}
                onDelete={() => {
                    // Dialog will auto-close after successful clearing
                }}
            />
        </>
    );
}

export default PlotReset;
