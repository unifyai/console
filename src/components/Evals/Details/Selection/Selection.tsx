"use client";

import { LogProps, LogItemProps } from "@/types/evals/logs";
import { extractParamsValues } from "@/utils/evals/table";
import SelectionHints from "./Hints";
import SelectionEntry from "./Entry";
import { useQueryState } from "nuqs";
import SettingButton from "@/components/Common/Buttons/Setting";
import {Columns2, Columns4} from "lucide-react";
const Selection = ({ params, logs }: { params: LogItemProps, logs: LogProps[] | undefined }) => {
    
    // Toggling between inline and pairwise comparison
    const [comparisonMode, setComparisonMode] = useQueryState("comparisonMode");
    const icon = comparisonMode === "pairwise" ? <Columns4/> : <Columns2/>
    const tooltip = comparisonMode ? "Inline compare" : "Pairwise compare" 
    const comparisonToggle =    <div className={"absolute top-0 right-0"}>
                                    <SettingButton 
                                        tooltip={tooltip} 
                                        icon={icon} 
                                        onClick={() => setComparisonMode(pairwise => pairwise != "multiple" ? "multiple" : "pairwise")}
                                    />
                                </div>

    // Get base and comparison logs
    const [comparisonLogsParam,] = useQueryState("comparison");
    const comparisonLogs = comparisonLogsParam && logs ? comparisonLogsParam.split(",").map(
		(value: string) => logs.find(log => log.id == value)!
	) : [];
    const [baseLogParam,] = useQueryState("base");
    const baseLog = baseLogParam && logs ? logs.find(log => log.id == baseLogParam) : undefined;

    const paramsNodes =     (baseLog: LogProps) =>
                            <div className="flex flex-col gap-2">
                                <p className="font-bold text-lg">Parameters</p>
                                <div className={`flex flex-col gap-1 rounded-md border-2 border-gray-200 min-h-10 ${comparisonMode === "multiple" ? "overflow-y-auto" : ""}`}>
                                    {Object.entries(extractParamsValues(baseLog.params, params)).map(([property, value], index) => {
                                        const rowColor = index % 2 === 1 ? "bg-gray-100" : "bg-background";
                                        return <SelectionEntry 
                                            key={index} 
                                            property={property} 
                                            value={value} 
                                            rowColor={rowColor} 
                                            comparisonLogs={comparisonLogs?.map(log => ({...log, params: extractParamsValues(log.params, params)}))} 
                                            oldParentNode={extractParamsValues(baseLog.params, params)} 
                                            newParentNodes={comparisonLogs?.map(log => extractParamsValues(log.params, params))}
                                            type="Params"
                                            logs={logs}
                                        />;
                                    })}
                                </div>
                            </div>

    const entriesNodes =    (baseLog: LogProps) => 
                            <div className="flex flex-col gap-2">
                                <p className="font-bold text-lg">Entries</p>
                                <div className={`flex flex-col gap-1 rounded-md border-2 border-gray-200 min-h-10 ${comparisonMode === "multiple" ? "overflow-y-auto" : ""}`}>
                                    {Object.entries(baseLog.entries).map(([property, value], index) => {
                                        const rowColor = index % 2 === 1 ? "bg-gray-100" : "bg-background";
                                        return <SelectionEntry
                                            key={index} 
                                            property={property} 
                                            value={value} 
                                            rowColor={rowColor} 
                                            comparisonLogs={comparisonLogs} 
                                            oldParentNode={baseLog.entries} 
                                            newParentNodes={comparisonLogs?.map(comparisonLog => comparisonLog.entries)}
                                            type="Entries"
                                            logs={logs}
                                        />;
                                    })}
                                </div>                
                            </div>

    return (
        <div className="bg-background rounded-md w-full h-full overflow-y-scroll p-5 flex flex-col">
            {baseLog
            ? <div className="relative gap-4 flex flex-col">
                {comparisonLogs.length > 1 && comparisonToggle}
                {Object.keys(baseLog.params).length > 0 && paramsNodes(baseLog)}
                {entriesNodes(baseLog)}
              </div>
            :
            <div className="flex items-center justify-center h-full w-full">
                <SelectionHints/>
            </div>
            }
        </div>
    );
};

export default Selection;