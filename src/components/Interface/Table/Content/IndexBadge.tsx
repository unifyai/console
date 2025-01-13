import Tooltip from "@/components/Common/Misc/Tooltip"
import { Badge } from "@/components/UI/badge"
import { LogProps } from "@/types/evals/logs"
import { Row } from "@tanstack/react-table"

const IndexBadge = ({ baseLog, comparisonLogs, row }: {
    baseLog: LogProps | undefined,
    comparisonLogs: LogProps[] | undefined,
    row: Row<any | unknown>,
}) => {
    return (
        baseLog?.id === row.original.id
            ? <Tooltip content={"Base log (Remove with \"Ctrl/Cmd + Click\")"}><Badge className="bg-blue-200 hover:bg-blue-200/80 border-transparent">{row.index + 1}</Badge></Tooltip>
            : comparisonLogs?.map(log => log.id).includes(row.original.id)
                ? <Tooltip content={"Compared Log (Remove with \"Alt/Option + Click\")"}><Badge variant="primary">{row.index + 1}</Badge></Tooltip>
                : <Badge>{row.index + 1}</Badge>
    )
}

export default IndexBadge;
