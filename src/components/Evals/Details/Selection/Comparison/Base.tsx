"use client";

import { useState } from "react";
import { Badge } from "@/components/UI/badge";
import Difference from "./Difference";
import { LogItemProps } from "@/types/evals/logs";
import { LogProps } from "@/types/evals/logs";
import BaseNode from "../Nodes/Base";
import { useQueryState } from "nuqs";

const Compare = ({logs, comparables, comparisonLogs, value}: {
  logs: LogProps[] | undefined,
  comparables: (LogItemProps | undefined)[],
  comparisonLogs: LogProps[] | undefined,
  value: any,
}) => {
  
  const [unfolded, setUnfolded] = useState(false);
  const [comparisonMode, ] = useQueryState("comparisonMode");

  let oldValue = value ?? "None"
  let newValue = comparables.at(0) ?? "None"

  // Single comparable case
  if (comparables.length === 1) return <Difference oldValue={oldValue} newValue={newValue} />

  // Multiple comparison
  const badge = (rowIndex: number) => <Badge className="absolute mr-1 top-1 right-1 z-1 cursor-default" variant="primary">{rowIndex + 1}</Badge>  
  if (comparisonMode === "multiple") {
    return (
      <div className={`grid grid-cols-[repeat(auto-fill,25rem)] gap-2`}>
        {comparables.map((comparable: LogItemProps | undefined, index: number) => {
            const rowIndex = logs?.findIndex(log => log.id === comparisonLogs?.at(index)!.id) as number;
            newValue = comparable ?? "None";
            return  <div key={index} className="relative">
                      {rowIndex && badge(rowIndex)}
                      <Difference oldValue={oldValue} newValue={newValue}/>
                    </div>
          })
        }
      </div>
      )
  }

  // Pairwise comparison
  return comparables.map((comparable, index) => {
    const rowIndex = logs?.findIndex(log => log.id === comparisonLogs?.at(index)!.id) as number;
    const property = oldValue.toString().slice(0, 20)
    newValue = comparable ?? "None";
    return (
      <BaseNode key={index} unfolded={unfolded} setUnfolded={setUnfolded} property={property} className="ml-5 hover:bg-muted p-2 rounded-md relative">
        <>
          {rowIndex && badge(rowIndex)}
          {unfolded && <Difference oldValue={oldValue} newValue={newValue} />}
        </>
      </BaseNode>
    )
  })
};


export default Compare;