"use client";

import { LogFieldsResponseProps } from "@/types/evals/logs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/UI/accordion";
import { Button } from "@/components/UI/button";
import { Scale3d } from "lucide-react";
import Tooltip from "@/components/Common/Misc/Tooltip";

const PlotScale = ({interactive = true, plotType, scaleX, scaleY, setScaleX, setScaleY, logScaleXEnabled, logScaleYEnabled, selectedXAxisProperty, fields}: {
    interactive: boolean,
    plotType: string,
    scaleX: string, 
    scaleY: string,
    selectedXAxisProperty: string | undefined,
    fields: LogFieldsResponseProps,
    logScaleXEnabled: boolean,
    logScaleYEnabled: boolean
    setScaleX: ((x: string | undefined) => void) | undefined,
    setScaleY: ((y: string | undefined) => void) | undefined,
}) => {

    // Don't render scale selector for certain plot types
    if (["Histogram", "Bar Chart"].includes(plotType)) return null;

    // Check available options depending on data type and values
    let [optionsY, optionsX] = [["linear"], ["linear"]]
    if (logScaleYEnabled) optionsY.push("log")
    if (selectedXAxisProperty && fields[selectedXAxisProperty] && !["float", "int"].includes(fields[selectedXAxisProperty].data_type))
        console.log("X axis non numeric. Cannot set logarithmic scale.")
    else
        if (logScaleXEnabled) optionsX.push("log")

    // Selection handler
    const onSelect = (option: string, setScale: ((x: string | undefined) => void) | undefined) => {
        if (!setScale || !interactive) return;
        setScale(option)
    }

    // Helper to get scale options and setter for a given axis
    const getAxisConfig = (axis: "X" | "Y") => {
        const scale = axis === "X" ? scaleX : scaleY;
        const setScale = axis === "X" ? setScaleX : setScaleY;
        const options = axis === "X" ? optionsX : optionsY;
        const disabled = options.length === 1 || !setScale || !interactive; // Disable if only one option, no setter, or not interactive
        return { scale, setScale, options, disabled };
    };

    // Determine text for the trigger
    const triggerText = () => {
        if (!scaleX && !scaleY) return "Scale";
        if (scaleX && !scaleY) return `Scale: X (${scaleX})`
        if (!scaleX && scaleY) return `Scale: Y (${scaleY})`
        return `Scale: X (${scaleX}) Y (${scaleY})`;
    };

    return (
        <AccordionItem value="plot-scale">
        <AccordionTrigger disabled={!interactive}>
            <Tooltip content="Log scale can only be applied when all the axes' values are all positive or all negative." side="left">
                <div className="flex flex-row items-center gap-2">
                    <Scale3d size={20}/>
                    {triggerText()}
                </div>
            </Tooltip>
        </AccordionTrigger>
        <AccordionContent>
            <div className="space-y-1 pr-2">
                <Accordion 
                    type="multiple" // Using type="multiple" allows both X and Y scales to be open
                    className="w-full space-y-1"
                >
                    {(["X", "Y"] as const).map((axis) => {
                    const { scale, setScale, options, disabled } = getAxisConfig(axis);
                    const triggerText = `${axis}-axis: ${scale}`;
                    const isSelectionDisabled = !setScale || !interactive; // Disable buttons if no setter or not interactive

                    return (
                        <AccordionItem key={axis} value={`scale-${axis.toLowerCase()}`} className="border-b-0">
                        <AccordionTrigger
                            className="text-md font-semibold text-muted-foreground hover:no-underline justify-start py-1 px-1 data-[state=closed]:opacity-100" // Keep opacity when closed
                            disabled={disabled}
                        >
                            {triggerText}
                            {disabled && options.length > 1 && <span className="text-xs font-normal ml-1">(Setter Unavailable)</span>}
                            {disabled && options.length === 1 && <span className="text-xs font-normal ml-1">(Log Unavailable)</span>}
                        </AccordionTrigger>
                        <AccordionContent className="pl-4 pb-1 space-y-1">
                            {/* Render buttons only if not disabled (multiple options exist) */}
                            {!disabled && options.map((option) => (
                                <Button
                                    key={option}
                                    variant={scale === option ? "primary" : "list_item"}
                                    size="lg"
                                    className="w-full justify-start h-auto py-1 text-md"
                                    onClick={() => onSelect(option, setScale)}
                                    disabled={isSelectionDisabled}
                                >
                                    {option}
                                </Button>
                            ))}
                            {/* Show static text if disabled but multiple options were technically possible */}
                            {disabled && options.length > 1 && (
                                    <p className="text-sm text-muted-foreground px-2 py-1">Scale selection unavailable.</p>
                            )}
                            {/* Show static text if only one option available */}
                            {disabled && options.length === 1 && (
                                <p className="text-sm text-muted-foreground px-2 py-1">{options[0]} (Log scale not available)</p>
                            )}
                        </AccordionContent>
                        </AccordionItem>
                    );
                    })}
                </Accordion>
            </div>
        </AccordionContent>
        </AccordionItem>
    );
}

export default PlotScale