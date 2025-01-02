"use client";

import { useState } from "react";
import { Input } from "@/components/UI/input";
import { Filter, X } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

const GlobalFilter = ({ searchParams, columnNames, commonFilterQuery, setCommonFilterQuery, setLogsFilters }: {
    searchParams: { project?: string, metric?: string, filters?: string, common_filter?: string },
    columnNames: string[]
    commonFilterQuery: string | undefined,
    setCommonFilterQuery: (query: string | null) => void
    setLogsFilters: (logsFilters: { [key: string]: { [key: string]: string } }) => void
}) => {
    const [commonFilter, setCommonFilter] = useState<string | undefined>(
        commonFilterQuery ? commonFilterQuery.split(",")[0] : undefined
    );

    return (
        <>
            <div className="relative">
                <Input
                    placeholder={"Enter a global filter.."}
                    value={commonFilter || ""}
                    onInput={(input) => setCommonFilter(input.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            if (commonFilter) {
                                setCommonFilterQuery((commonFilter.startsWith('"') && commonFilter.endsWith('"')) 
                                    ? commonFilter 
                                    : `"${commonFilter}"`
                                );
                            }
                            else
                                setCommonFilterQuery(null);
                        }
                    }}
                    className="h-8"
                />
                {commonFilter?.length ? <div className="absolute right-2 top-[9px]">
                    <X size={18} onClick={() => setCommonFilter("")} className="cursor-pointer" />
                </div> : <></>}
            </div>
            {(searchParams.filters || searchParams.common_filter) && <ActionButton
                icon={<Filter />}
                tooltip="Reset All Filters"
                variant={"destructive"}
                onClick={() => {
                    setLogsFilters({});
                    setCommonFilter("");
                    setCommonFilterQuery(null);
                }}
            />}
        </>
    );
}

export default GlobalFilter;
