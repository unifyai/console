import Compare from "../../Comparison/Base";
import { LogProps, LogItemProps } from "@/types/evals/logs";
import { MatrixDisplay } from "@/utils/evals/selection";

const MatrixNode = ({unfolded, comparisonLogs, comparables, value, logs}: {
    unfolded: boolean, 
    comparisonLogs: LogProps[] | undefined,
    comparables: (LogItemProps | undefined)[],
    value: number[][],
    logs: LogProps[] | undefined,
}) => {
    if (!unfolded) return null;
    if (comparables.length === 0) return <MatrixDisplay value={value}/>
    return <Compare logs={logs} comparables={comparables} comparisonLogs={comparisonLogs} value={value}/>;
}

export default MatrixNode;
