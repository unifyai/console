import SelectEndpoint from "./Select";
import Image from "next/image";
import { TableCell } from "@/components/UI/table";
import { Cell, flexRender, Row } from "@tanstack/react-table";
import { Endpoint } from "@/types/chat/endpoints";

const EndpointsTableCell = ({ cell, row, selectedEndpoints, setSelectedEndpoints }: {
    cell: Cell<any, unknown>, 
    row: Row<any | unknown>,
    selectedEndpoints: Endpoint[],
    setSelectedEndpoints: React.Dispatch<React.SetStateAction<Endpoint[]>>
}) => {
    const provider = cell.getValue() as string;
    const column = cell.column;
    let content;
    if (column.id === "select")
        content = <SelectEndpoint
            endpoint={row.original}
            maxSelectable={8}
            selectedEndpoints={selectedEndpoints}
            setSelectedEndpoints={setSelectedEndpoints}
        />;
    else if (column.id === "code")
        content = cell.renderValue() as string;
    else
        content = (
            <div className="flex items-center space-x-2">
                <Image src={row.original.providerImage} alt={provider} width={20} height={20} className="my-auto" />
                <span>{provider}</span>
            </div>
        );
    return (
        <TableCell key={cell.id}>
            {flexRender(content, cell.getContext())}
        </TableCell>
    );
};

export default EndpointsTableCell;