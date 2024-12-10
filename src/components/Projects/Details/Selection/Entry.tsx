"use client";

import StringNode from "./Nodes/Leaf/String";
import MatrixNode from "./Nodes/Leaf/Matrix";
import NewNodes from "./Nodes/New";
import ListNode from "./Nodes/Nested/List";
import BaseNode from "./Nodes/Base";

import { LogProps, LogItemProps } from "@/types/projects/logs";
import { useState } from "react";
import DictionaryNode from "./Nodes/Nested/Dictionary";

import { isMatrix, isDict, isList, isImage } from "@/utils/projects/selection";
import ImageNode from "./Nodes/Leaf/Image";

const SelectionEntry = ({property, parentPath, value, rowColor, newEntry, comparisonLogs, oldParentNode, newParentNodes, type, logs}: {
    property: string,
    value: any, 
    rowColor: string,
    newEntry?: boolean,
    comparisonLogs?: LogProps[] | undefined
    parentPath?: string,
    oldParentNode?: any,
    newParentNodes?: any[]
    type: string,
    logs: LogProps[] | undefined
  }) => {
  
    // Handle node folding
    const [unfolded, setUnfolded] = useState(false);

    // Trace parent node
    const path = parentPath ? parentPath + "/" + property : property;
    const comparables = comparisonLogs
    ? comparisonLogs.map((comparisonLog, index) => {
      let comparable = path.split("/").reduce((acc, key) => (acc?.[key] as LogItemProps ?? undefined), type === "Entries" ? comparisonLog.entries : comparisonLog.params);
      if (newParentNodes && typeof oldParentNode !== typeof newParentNodes.at(index)) return undefined;
      return comparable;
    })
    : [];
  
    return (
      <div className={`${rowColor} p-3 ${!comparables || comparables?.length === 1 ? "hover:bg-gray-200" : ""}`}>
      <BaseNode unfolded={unfolded} setUnfolded={setUnfolded} newEntry={newEntry} property={property}>
        {isDict(value)
          ? <DictionaryNode unfolded={unfolded} setUnfolded={setUnfolded} comparables={comparables} comparisonLogs={comparisonLogs} rowColor={rowColor} property={property} value={value} type={type} path={path} logs={logs}/>
          : isImage(value)
            ? <ImageNode unfolded={unfolded} comparables={comparables} comparisonLogs={comparisonLogs} value={value} logs={logs}/>
            : isMatrix(value)
              ? <MatrixNode unfolded={unfolded} comparables={comparables} comparisonLogs={comparisonLogs} value={value} logs={logs}/>
              : isList(value)
                ? <ListNode comparables={comparables} comparisonLogs={comparisonLogs} rowColor={rowColor} value={value} type={type} path={path} logs={logs}/>
                : <StringNode unfolded={unfolded} comparables={comparables} comparisonLogs={comparisonLogs} value={value} logs={logs}/>
        }
      </BaseNode>
      {newParentNodes?.map((newParentNode, index) => 
        <NewNodes key={index} oldParentNode={oldParentNode} newParentNode={newParentNode} property={property} value={value} type={type}/>)
      }
      </div>
    );
  };

export default SelectionEntry;