"use client"

import { LogProps } from "@/types/evals/logs";
import BaseCard from "@/components/Common/Card/Base";
import { stringToColor } from "@/utils/misc/color";

const GroupingKey = ({logs, groupBy}:{
    logs: LogProps[];
    groupBy: string
}) => {
    const keys = Array.from(
        new Set(
            logs.map((log) => log.entries[groupBy])
        )
    )
    return  <BaseCard title="Grouping values" className="absolute bottom-20 right-2 z-10 w-[100px] h-[150px] overflow-y-scroll text- GroupingKey">
                {keys.map((key, index) => {
                    const color = stringToColor(JSON.stringify(key));
                    return  <div className="flex flex-row gap-2 items-center" key={index}>
                                <div className={`rounded-full h-2 w-2`} style={{
                                    "backgroundColor": color,
                                    "color": color
                                }}/>
                                <p className="text-xs text-foreground">{key}</p>
                            </div>;
                    }
                )}
            </BaseCard>;
}

export default GroupingKey;
