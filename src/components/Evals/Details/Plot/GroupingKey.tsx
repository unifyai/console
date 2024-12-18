"use client"

import { GroupingColors } from "@/types/evals/plot";

const GroupingKey = ({groupBy, groupByColors}:{groupBy: string, groupByColors: GroupingColors}) => {
    return  <div className="flex flex-col gap-1 overflow-hidden absolute bottom-20 right-2 z-10 w-[100px] h-[150px] rounded-md border-2 border-primary py-2 px-3">
                <p className="font-bold text-sm">Grouping values</p>
                <div className="overflow-auto h-[100px]">
                {groupByColors.map((entry, index) => {
                    return  <div className="flex flex-row gap-2 items-center" key={index}>
                                <div className={`rounded-full h-2 w-2`} style={{
                                    "backgroundColor": entry.color,
                                    "color": entry.color
                                }}/>
                                <p className="text-xs text-foreground">{entry.key}</p>
                            </div>;
                    }
                )}
                </div>
            </div>;
}

export default GroupingKey;
