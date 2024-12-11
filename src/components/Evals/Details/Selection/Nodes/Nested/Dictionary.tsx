import DetailedEntry from "../../Entry";
import { LogProps, LogItemProps } from "@/types/evals/logs";
import { Dispatch, SetStateAction } from "react";

const DictionaryNode = ({unfolded, value, rowColor, comparisonLogs, path, comparables, type, logs}: {
    unfolded: boolean,
    setUnfolded: Dispatch<SetStateAction<boolean>>,
    property: string,
    value: any,
    rowColor: string,
    comparisonLogs: LogProps[] | undefined,
    path: string,
    comparables: (LogItemProps | undefined)[],
    type: string,
    logs: LogProps[] | undefined
}) => {
    if (!unfolded) return null;
    return (
      <div className="flex flex-col px-3">
        {Object.entries(value).map(([subProperty, subValue], index) => 
          <DetailedEntry key={index} property={subProperty} value={subValue} rowColor={rowColor} comparisonLogs={comparisonLogs} parentPath={path} oldParentNode={value} newParentNodes={comparables} type={type} logs={logs}/>            
        )}
       </div>
    );
}

export default DictionaryNode;