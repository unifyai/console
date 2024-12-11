import DetailedEntry from "../../Entry";
import { LogItemProps, LogProps } from "@/types/evals/logs";

const ListNode = ({value, rowColor, comparisonLogs, path, comparables, type, logs}: {
    value: any[],
    rowColor: string,
    comparisonLogs: LogProps[] | undefined,
    path: string,
    comparables: (LogItemProps | undefined)[],
    type: string,
    logs: LogProps[] | undefined
}) => {
    return (
        <div className="flex flex-col px-3">
            {value.map((element, index) => 
              <DetailedEntry key={index} property={index.toString()} value={element} rowColor={rowColor} comparisonLogs={comparisonLogs} parentPath={path} oldParentNode={value} newParentNodes={comparables} type={type} logs={logs}/> 
            )}
        </div>
    )
}
export default ListNode;