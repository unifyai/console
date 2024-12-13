"use client";

import { useState } from "react";
import Difference from "./Difference";
import { LogItemProps } from "@/types/evals/logs";
import { LogProps } from "@/types/evals/logs";
import BaseNode from "../Nodes/Base";
import { useQueryState } from "nuqs";
import { CaseLower, WholeWord, ChartNoAxesGantt, Diff  } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

const Compare = ({logs, comparables, comparisonLogs, value}: {
  logs: LogProps[] | undefined,
  comparables: (LogItemProps | undefined)[],
  comparisonLogs: LogProps[] | undefined,
  value: any,
}) => {
  
  // Node folding and comparison mode
  const [unfolded, setUnfolded] = useState(false);
  const [comparisonMode, ] = useQueryState("comparisonMode");

  // Old and new values
  let oldValue = value ?? "None"
  let newValue = comparables.at(0) ?? "None"

  // Diff settings selectors
  const [selectedDiffMode, setSelectedDiffMode] = useState<"characters" | "words" | "lines">("characters");
  const diffModes = [
    {name: "characters", tooltip: "Toggle word-based diff", icon: <CaseLower/>, onClick: () => setSelectedDiffMode("words")},
    {name: "words", tooltip: "Toggle line-based diff", icon: <WholeWord/>, onClick: () => setSelectedDiffMode("lines")},
    {name: "lines", tooltip: "Toggle character-based diff", icon: <ChartNoAxesGantt/>, onClick: () => setSelectedDiffMode("characters")},
  ]
  const diffMode = diffModes.find(mode => mode.name === selectedDiffMode)! 
  const diffModeToggle =  
    <ActionButton   
      variant="outline"
      tooltip={diffMode.tooltip}
      onClick={(event) => {
        event.stopPropagation()
        diffMode.onClick()
      }}
      className="h-6 w-6"
      icon={diffMode.icon} 
    />

  const badge = (rowIndex: number) => 
    <ActionButton   
      variant="primary"
      tooltip={`Log #${rowIndex + 1}`}
      className="cursor-default h-6 w-6"
      text={`${ rowIndex + 1 }`} 
    />

  // Template comparison
  const comparison = (index?: number, rowIndex?: number) =>  
    <div key={index} className="flex flex-row gap-2">
      <div className="flex flex-col gap-2 items-center">
        {rowIndex && badge(rowIndex)}
        {newValue && typeof oldValue === "string" && typeof newValue === "string" && diffModeToggle}
      </div>
      <Difference oldValue={oldValue} newValue={newValue} selectedDiffMode={selectedDiffMode}/>
    </div>

  /* Single comparable case */
  if (comparables.length === 1) return  comparison()

  /* Multiple comparison */
  if (comparisonMode === "multiple") {
    return (
      <div className={`grid grid-cols-[repeat(auto-fill,25rem)] gap-2`}>
        {comparables.map((comparable: LogItemProps | undefined, index: number) => {
            const rowIndex = logs?.findIndex(log => log.id === comparisonLogs?.at(index)!.id) as number;
            newValue = comparable ?? "None";
            return comparison(index, rowIndex);
          })
        }
      </div>
      )
  }

  /* Pairwise comparison */
  return comparables.map((comparable, index) => {
    const rowIndex = logs?.findIndex(log => log.id === comparisonLogs?.at(index)!.id) as number;
    const property = oldValue.toString().slice(0, 20)
    newValue = comparable ?? "None";
    return (
      <BaseNode key={index} unfolded={unfolded} setUnfolded={setUnfolded} property={property} className="ml-5 hover:bg-muted p-2 rounded-md relative">
        {unfolded && comparison(index, rowIndex)}
      </BaseNode>
    )
  })
};

export default Compare;