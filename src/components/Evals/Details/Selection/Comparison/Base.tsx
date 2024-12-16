"use client";

import { useState } from "react";
import Difference from "./Difference";
import { LogItemProps } from "@/types/evals/logs";
import { LogProps } from "@/types/evals/logs";
import BaseNode from "../Nodes/Base";
import { useQueryState } from "nuqs";
import { CaseLower, WholeWord, ChartNoAxesGantt, Dot } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import { isImage, ImageDisplay } from "@/utils/evals/selection";

const Compare = ({logs, comparables, comparisonLogs, value}: {
  logs: LogProps[] | undefined,
  comparables: (LogItemProps | undefined)[],
  comparisonLogs: LogProps[] | undefined,
  value: any,
}) => {
  
  // Node folding and comparison modes
  const [unfolded, setUnfolded] = useState(false);
  const [comparisonMode, ] = useQueryState("comparisonMode");
  const [groupedComparison, ] = useQueryState("groupedComparison");

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

  const badge = (rowIndex: number | number[]) => { 
    if (Array.isArray(rowIndex) && rowIndex.length === 0) return null;
    const tooltip = Array.isArray(rowIndex)
      ? `Identical entries: ${rowIndex.map(i => i + 1).join(",")}` 
      : `Log #${rowIndex + 1}`
    const text = !Array.isArray(rowIndex) ? `${ rowIndex + 1 }` : undefined;
    const icon = Array.isArray(rowIndex) ? <Dot/> : undefined;
    const variant = Array.isArray(rowIndex) ? "primary" : "outline";
    return <ActionButton   
      variant={variant}
      tooltip={tooltip}
      className="cursor-default h-6 w-6"
      text={text}
      icon={icon}
    />
  }
  // Template comparison
  const comparison = (index?: number, rowIndex?: number | number[], sides?: "left" | "right") =>  
    <div key={index} className="flex flex-row gap-2">
      <div className="flex flex-col gap-2 items-center">
        {rowIndex && badge(rowIndex)}
        {newValue && typeof oldValue === "string" && typeof newValue === "string" && !isImage(oldValue) && diffModeToggle}
      </div>
      {sides === "left" 
        ? <div className={`rounded-md border bg-background/50 p-4 font-mono text-sm w-full ${isImage(oldValue) ? "" : "whitespace-pre-wrap max-h-[200px]"} overflow-y-auto`}>
            {isImage(oldValue) ? <ImageDisplay value={oldValue as string}/> : oldValue}
          </div>
        : <Difference 
            oldValue={sides === "right" ? "" : oldValue} 
            newValue={newValue}
            splitView={comparisonMode === "inline" || sides === "right" ? false : true}
            selectedDiffMode={selectedDiffMode}
          />
      }
    </div>

  // Grouping nodes with the same value
  const different  = comparables.filter((comparable) => comparable != oldValue)
  let duplicatesIndices : number[] = [];
  comparables.map((comparable, index) => {
    if (comparable === oldValue) {
      const rowIndex = logs?.findIndex(log => log.id === comparisonLogs?.at(index)!.id) as number;
      duplicatesIndices.push(rowIndex);
    }
  })

  /* Single comparable case */
  if (comparables.length === 1) return  comparison()

  /* Inline comparison */
  if (comparisonMode === "inline") {
    return (
      <div className={`grid grid-cols-[repeat(auto-fill,25rem)] gap-2 overflow-x-auto w-full`}>
        {groupedComparison === "grouped" && comparison(undefined, duplicatesIndices, "left")}
        {(groupedComparison === "grouped" ? different : comparables).map((comparable: LogItemProps | undefined, index: number) => {
            const rowIndex = logs?.findIndex(log => log.id === comparisonLogs?.at(index)!.id) as number;
            newValue = comparable ?? "None";
            return comparison(index, rowIndex);
          })
        }
      </div>
      )
  }

  /* Block comparison */
  return <>
  {groupedComparison === "grouped" && comparison(undefined, duplicatesIndices, "left")}
  {(groupedComparison === "grouped" ? different : comparables).map((comparable, index) => {

    const rowIndex = logs?.findIndex(log => log.id === comparisonLogs?.at(index)!.id) as number;
    newValue = comparable ?? "None";
    const property = newValue.toString().slice(0, 20);

    const pairwise = groupedComparison === "grouped" ? comparison(index, rowIndex) : 
      <BaseNode key={index} unfolded={unfolded} setUnfolded={setUnfolded} property={property} className="ml-5 hover:bg-muted p-2 rounded-md relative">
        {unfolded && comparison(index, rowIndex)}
      </BaseNode>
    
    return <div className="mt-2">{pairwise}</div>
  })}
  </>
};

export default Compare;