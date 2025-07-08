"use client";

import { ColumnDef, ColumnSort } from "@tanstack/react-table";
import { Endpoint } from "@/types/chat/endpoints";
import EndpointsTableContent from "./Table";
import SearchFilter from "./Search";
import { useState } from "react";

const hasKeyword = (endpoint: Endpoint, keywords: string[]): boolean => {
    const searchString = `${endpoint.code} ${endpoint.provider}`.toLowerCase();
    return keywords.every(keyword => searchString.includes(keyword));
};

const EndpointsTable = ({ endpoints, selectedEndpoints, setSelectedEndpoints }: {
    endpoints: Endpoint[],
    selectedEndpoints: Endpoint[],
    setSelectedEndpoints: React.Dispatch<React.SetStateAction<Endpoint[]>>
}) => {
    // Endpoint search
    const [searchQuery, setSearchQuery] = useState<string>("");
    const searchKeywords = Array.from(new Set(searchQuery.toLowerCase().split(/\s+/)));
    const searchedEndpoints = !searchQuery 
        ? endpoints 
        : endpoints.filter(endpoint => hasKeyword(endpoint, searchKeywords));

    // Table states
    const columns: ColumnDef<Endpoint>[] = [
        { id: "select" },
        { accessorKey: "code" },
        { accessorKey: "provider" }
    ];
    const [sorting, setSorting] = useState<ColumnSort[]>([]);

    return (
        <div className="w-full flex flex-col gap-2 h-full rounded-md bg-background p-2 tutorial-endpoints-table">
            <SearchFilter searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
            <EndpointsTableContent 
                data={searchedEndpoints} 
                columns={columns}
                sorting={sorting} 
                setSorting={setSorting}
                selectedEndpoints={selectedEndpoints}
                setSelectedEndpoints={setSelectedEndpoints}
            />
        </div>
    );
};

export default EndpointsTable;