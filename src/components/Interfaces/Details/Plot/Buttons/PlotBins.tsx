"use client";

import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/UI/accordion";
import { ChartColumnBig } from "lucide-react";
import SliderWithValue from "@/components/Common/Sliders/WithValue";
import Tooltip from "@/components/Common/Misc/Tooltip";

const PlotBins = ({
  interactive = true,
  plotType,
  binCount,
  setBinCount,
  binCounts,
}: {
  interactive?: boolean;
  plotType: string;
  binCount: number;
  binCounts: number[];
  setBinCount: ((newValue: string | undefined) => void) | undefined;
}) => {
    // Only render bin selector for Histograms
    if (plotType !== "Histogram") {
        return null;
    }

    // Determine available ticks
    const ticks = [binCounts[0], Math.min(binCounts[1], 200)]
    const setValue = (value: any) => {
        if (!interactive || !setBinCount) return;
        let update;
        if (typeof value === "number") {
            if (value < ticks[0]) update = ticks[0]
            else if (value > ticks[1]) update = ticks[1]
            else update = value
        } 
        else update = ticks[0]
        setBinCount(update.toString())
    }

    return (
        <AccordionItem value="plot-bins">
          <AccordionTrigger disabled={!interactive}>
            <Tooltip content="Set the number of bins." side="left">
              <div className="flex flex-row gap-2 items-center">
                <ChartColumnBig size={20}/>
                {`Bins: ${binCount}`}
              </div>            
            </Tooltip>
          </AccordionTrigger>
          <AccordionContent>
            <div className="p-2 pr-3">
                <SliderWithValue label="Bin count" value={binCount} setValue={setValue} ticks={ticks} disabled={!interactive}/>
            </div>
          </AccordionContent>
        </AccordionItem>
      );
}

export default PlotBins;
