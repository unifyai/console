"use client";

import React from "react";
import { MatrixDisplay, isMatrix, ImageDisplay, isImage } from "@/utils/evals/selection";
import { useQueryState } from "nuqs";
import DiffViewer from "@/components/Common/Misc/DiffViewer";

const Difference = ({oldValue = "", newValue = "", splitView, selectedDiffMode}: {
  oldValue?: any, 
  newValue?: any | undefined, 
  splitView?: boolean,
  selectedDiffMode?: "characters" | "words" | "lines",
}) => {

    const [comparisonMode, ] = useQueryState("comparisonMode");

    // Comparing images
    if (newValue &&  isImage(oldValue) && isImage(newValue)){
      return (
        <div className={`grid ${comparisonMode === "block" ? "grid-rows-2" : "grid-cols-2"} gap-2`}>
          <div className="w-fit p-2 py-2 rounded-md bg-red-300"><ImageDisplay value={oldValue as string}/></div>
          <div className="w-fit p-2 py-2 rounded-md bg-green-300"><ImageDisplay value={newValue}/></div>
        </div>
      );
    }

    // Comparing matrices
    if (newValue && isMatrix(oldValue) && isMatrix(newValue)){
      return (
        <div className={`grid ${comparisonMode === "block" ? "grid-rows-2" : "grid-cols-2"} gap-2`}>
          <div className="w-fit p-2 py-2 rounded-md bg-red-300"><MatrixDisplay value={oldValue}/></div>
          <div className="w-fit p-2 py-2 rounded-md bg-green-300"><MatrixDisplay value={newValue}/></div>
        </div>
      );
    }

    // Character-based comparison
    if (newValue && typeof oldValue === "string" && typeof newValue === "string" ){
      return <DiffViewer 
        oldValue={oldValue}
        newValue={newValue} 
        splitView={splitView} 
        mode={selectedDiffMode}
      />;
    }

    // Item-based comparison
    if (oldValue != newValue) return (
      <div className={`grid ${comparisonMode === "block" ? "grid-rows-2" : "grid-cols-2"} whitespace-pre-wrap rounded-md font-mono w-full`}>
        <p className="bg-red-300 py-1 px-2 rounded-sm">{oldValue}</p>
        {newValue && <p className="bg-green-300 py-1 px-2 rounded-sm">{newValue}</p>}
      </div>
    );

    return (
      <p className="py-1 px-2 rounded-sm whitespace-pre-wrap w-full rounded-md font-mono border">{oldValue}</p>
    );
  };

export default Difference;