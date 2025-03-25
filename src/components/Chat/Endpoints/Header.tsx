import { Header as TableHeader, flexRender } from "@tanstack/react-table";
import { Checkbox } from "@/components/UI/checkbox";
import ColumnSort from "@/components/Common/Tables/Buttons/Sort";
import { TableHead } from "@/components/UI/table";
import { Endpoint } from "@/types/chat/endpoints";
import { CheckedState } from "@radix-ui/react-checkbox";
import { useRef, useEffect } from "react";

const EndpointsTableHeader = ({ header, selectedEndpoints, setSelectedEndpoints, data }: {
    header: TableHeader<any, unknown>,
    selectedEndpoints: Endpoint[],
    setSelectedEndpoints: React.Dispatch<React.SetStateAction<Endpoint[]>>,
    data: Endpoint[]
}) => {
    const column = header.column;
    const checkboxRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (checkboxRef.current) {
            const input = checkboxRef.current.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (input) {
                input.indeterminate = selectedEndpoints.length > 0 && selectedEndpoints.length < data.length;
            }
        }
    }, [selectedEndpoints, data]);

    let content;
    if (column.id === "select") {
        const isDisabled = selectedEndpoints.length === 0;
        const isChecked = selectedEndpoints.length > 0;

        const onCheckedChange = (value: CheckedState) => {
            if (value === false) {
                // Deselect all endpoints
                setSelectedEndpoints([]);
            }
        };

        content = (
            <Checkbox
                ref={checkboxRef}
                checked={isChecked}
                onCheckedChange={onCheckedChange}
                disabled={isDisabled}
                aria-label="Select all rows"
            />
        );
    } else if (column.id === "code") {
        content = (
            <div className="flex flex-row justify-between items-center">
                <p>{"Model"}</p>
                <ColumnSort column={column} data={data} sortLoading={false} setSortLoading={() => {}} setIsSorted={() => {}} renderMode="button"/>
            </div>
        );
    } else {
        content = (
            <div className="flex flex-row justify-between items-center">
                <p>{"Provider"}</p>
                <ColumnSort column={column} data={data} sortLoading={false} setSortLoading={() => {}} setIsSorted={() => {}} renderMode="button"/>
            </div>
        );
    }
    return (
        <TableHead key={header.id} className="bg-background">
            {header.isPlaceholder ? null : flexRender(content, header.getContext())}
        </TableHead>
    );
};

export default EndpointsTableHeader;