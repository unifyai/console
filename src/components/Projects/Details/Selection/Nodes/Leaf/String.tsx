import Compare from "../../Comparison/Base";
import { LogProps, LogItemProps } from "@/types/projects/logs";
import { CodeBlock } from "@/components/UI/Chat/markdown-renderer";

const StringNode = ({unfolded, comparisonLogs, comparables, value, logs}: {
    unfolded: boolean, 
    comparisonLogs: LogProps[] | undefined,
    comparables: (LogItemProps | undefined)[],
    value: any,
    logs: LogProps[] | undefined,
}) => {
    if (!unfolded) return null;
    if (comparables.length === 0) {
      if (typeof value === "string" && value.startsWith("```") && value.endsWith("```")) 
        return <CodeBlock language="ts">{value.slice(3).slice(0, -3)}</CodeBlock>
      else 
        return <p className="font-normal px-3 whitespace-pre-wrap">{(value ?? "None").toString()}</p> 
    }
    return <Compare logs={logs} comparables={comparables} comparisonLogs={comparisonLogs} value={value}/>;
}

export default StringNode;