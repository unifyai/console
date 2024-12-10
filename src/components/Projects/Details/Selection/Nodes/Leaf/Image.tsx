import Compare from "../../Comparison/Base";
import { LogProps, LogItemProps } from "@/types/projects/logs";
import { ImageDisplay } from "@/utils/projects/selection";

const ImageNode = ({unfolded, comparisonLogs, comparables, value, logs}: {
    unfolded: boolean, 
    comparisonLogs: LogProps[] | undefined,
    comparables: (LogItemProps | undefined)[],
    value: string,
    logs: LogProps[] | undefined,
}) => {
    if (!unfolded) return null;
    if (comparables.length === 0) return <ImageDisplay value={value}/>
    return <Compare logs={logs} comparables={comparables} comparisonLogs={comparisonLogs} value={value}/>;
}

export default ImageNode;
