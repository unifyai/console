"use client"

import { ColumnDef, ColumnSort as SortProps } from "@tanstack/react-table"
import { Endpoint } from "@/types/chat/endpoints"
import { useQueryState } from "nuqs"
import EndpointsTableContent from "./Table";
import SearchFilter from "./Search";
import { useState } from "react";

// New hasKeyword function
const hasKeyword = (endpoint: Endpoint, keywords: string[]): boolean => {
  const searchString = `${endpoint.code} ${endpoint.provider}`.toLowerCase();
  return keywords.every(keyword => searchString.includes(keyword));
};

const EndpointsTable = ({endpoints}: {endpoints: Endpoint[]}) => {
    
    // Endpoint selection provider filtering
    const [selectedEndpointsParam, setSelectedEndpointsParam] = useQueryState("endpoints");
    const selectedEndpoints = selectedEndpointsParam ? selectedEndpointsParam.split(",") : [];
    const [providerFilterParam, setProviderFilterParam] = useQueryState("providers");
    const excludedProviders = providerFilterParam ? providerFilterParam.split(",") : [];

    // Updated Endpoint search
    const [searchQuery, setSearchQuery] = useState<string>("")
    const searchKeywords = Array.from(new Set(searchQuery.toLowerCase().split(/\s+/)));
    const searchedEndpoints = !searchQuery 
        ? endpoints 
        : endpoints.filter(endpoint => hasKeyword(endpoint, searchKeywords));

    // Table states
    const columns: ColumnDef<Endpoint>[] = [
        { id: "select" },
        { accessorKey: "code" },
        { accessorKey: "provider" }
    ]
    const [sortingStr, setSortingStr] = useQueryState("sorting");
    const sorting = sortingStr ? sortingStr.split(",").map(column => {
        const [id, desc] = column.split("@");
        return { id: id, desc: desc == "true" };
    }) : [];
    const setSorting = (sorting: SortProps[]) => {
        setSortingStr(sorting.map(col => `${col.id}@${col.desc}`).join(","));
    };

    return (
    <div className="w-full flex flex-col gap-2 h-full rounded-md bg-background p-2 tutorial-endpoints-table">        
        <SearchFilter searchQuery={searchQuery} setSearchQuery={setSearchQuery}/>
        <EndpointsTableContent 
            data={searchedEndpoints} 
            columns={columns}
            sorting={sorting} 
            setSorting={setSorting}
            selectedEndpoints={selectedEndpoints}
            setSelectedEndpointsParam={setSelectedEndpointsParam}
            excludedProviders={excludedProviders}
            setProviderFilterParam={setProviderFilterParam}
        />
    </div>
    )
}

export default EndpointsTable;