"use client";

import { useState } from "react";
import * as Diff from "diff";
import React from "react";
import { MatrixDisplay, isMatrix, ImageDisplay, isImage } from "@/utils/evals/selection";
import { Bold } from "lucide-react"
import { useQueryState } from "nuqs";
import BaseToggle from "@/components/Common/Toggle/Base";

const Difference = ({oldValue, newValue}: {oldValue: any, newValue: any | undefined}) => {
    // Character-based comparison
    const [isCharacterDiff, setIsCharacterDiff] = useState(true);
    const [comparisonMode, ] = useQueryState("comparisonMode");

    // Comparing images
    if (newValue &&  isImage(oldValue) && isImage(newValue)){
      return (
        <div className={`grid ${comparisonMode === "multiple" ? "grid-rows-2" : "grid-cols-2"} gap-2`}>
          <div className="w-fit pr-2 py-2 rounded-md bg-red-300"><ImageDisplay value={oldValue as string}/></div>
          <div className="w-fit pr-2 py-2 rounded-md bg-green-300"><ImageDisplay value={newValue}/></div>
        </div>
      );
    }

    // Comparing matrices
    if (newValue && isMatrix(oldValue) && isMatrix(newValue)){
      return (
        <div className={`grid ${comparisonMode === "multiple" ? "grid-rows-2" : "grid-cols-2"} gap-2`}>
          <div className="w-fit pr-2 py-2 rounded-md bg-red-300"><MatrixDisplay value={oldValue}/></div>
          <div className="w-fit pr-2 py-2 rounded-md bg-green-300"><MatrixDisplay value={newValue}/></div>
        </div>
      );
    }

    if (newValue && typeof oldValue === "string" && typeof newValue === "string" ){
      const differences = Diff.diffChars(oldValue, newValue);
      const characterDiff =   <p className="font-normal whitespace-pre-wrap">
                                {
                                    differences.map((part, index) => (
                                        <span key={index} className={`${part.added ? "bg-green-300" : part.removed ? "bg-red-300" : ""}`}>
                                          {part.value}  
                                        </span>
                                    ))
                                }
                              </p>
      const itemDiff =  <div className={`grid ${comparisonMode === "multiple" ? "grid-rows-2" : "grid-cols-2"} gap-2 whitespace-pre-wrap`}>
                          <p className="bg-red-300 py-1 px-2 rounded-sm">{oldValue}</p>
                          {newValue && <p className="bg-green-300 py-1 px-2 rounded-sm">{newValue}</p>}
                        </div>
      return (
        <div className="relative">
          {isCharacterDiff ? characterDiff : itemDiff}
          <div className="absolute bottom-0.5 right-0.5 scale-55">
            <BaseToggle 
              icon={<Bold/>} 
              isOn={isCharacterDiff}
              setOn={setIsCharacterDiff}
              onTooltip="Toggle side-by-side comparison"
              offTooltip="Toggle character-based comparison"
            />
          </div>
        </div>
      );
    }

    // Item-based comparison
    if (oldValue != newValue) return (
      <div className={`grid ${comparisonMode === "multiple" ? "grid-rows-2" : "grid-cols-2"} gap-2 whitespace-pre-wrap`}>
        <p className="bg-red-300 py-1 px-2 rounded-sm">{oldValue}</p>
        {newValue && <p className="bg-green-300 py-1 px-2 rounded-sm">{newValue}</p>}
      </div>
    );

    return (
      <p className="py-1 px-2 rounded-sm whitespace-pre-wrap">{oldValue}</p>
    );
  };

export default Difference;