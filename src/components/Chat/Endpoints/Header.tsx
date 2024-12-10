import { Header, flexRender } from "@tanstack/react-table";
import { Checkbox } from "@/components/UI/checkbox";
import ColumnSort from "@/components/Common/Tables/Data/Buttons/ColumnSort";
import ProviderFilter from "./Filter";
import { TableHead } from "@/components/UI/table";
import { Endpoint } from "@/types/chat/endpoints";
import { Options } from "nuqs";

const EndpointsTableHeader = ({header, data, selectedEndpoints, excludedProviders, setProviderFilterParam, setSelectedEndpointsParam}: {
    header: Header<any, unknown>,
    data: Endpoint[],
    selectedEndpoints: string[]
    excludedProviders: string[],
    setProviderFilterParam: (value: string | ((old: string | null) => string | null) | null, options?: Options) => Promise<URLSearchParams>,
    setSelectedEndpointsParam: (value: string | ((old: string | null) => string | null) | null, options?: Options) => Promise<URLSearchParams>
}) => {
    const column = header.column;
    let content;
    if (column.id === "select")
        content = selectedEndpoints.length === 0 
            ? null 
            : <Checkbox checked onCheckedChange={(value) => {if (!value) setSelectedEndpointsParam(null);}} aria-label="Select all rows"/>
    else if (column.id === "code")
        content =   <div className="flex flex-row justify-between gap-2 items-center">
                        <p>{"Model"}</p>
                        <ColumnSort column={column}/>
                    </div>
    else 
        content =   <div className="flex flex-row justify-between gap-2 items-center">
                        <p>{"Provider"}</p>
                        <div className="flex flex-row">
                            <ProviderFilter endpoints={data} excludedProviders={excludedProviders} setProviderFilterParam={setProviderFilterParam} />
                            <ColumnSort column={column}/>
                        </div>
                    </div>
    return (
        <TableHead key={header.id} className="bg-background">
            {header.isPlaceholder ? null : flexRender(content, header.getContext())}
        </TableHead>
    )
}

export default EndpointsTableHeader;
