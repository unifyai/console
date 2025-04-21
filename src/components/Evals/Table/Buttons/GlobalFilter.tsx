"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/Common/Input/Content";
import { LoaderCircle, Trash, Filter, X } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import { LogProps, GroupedLogProps } from "@/types/evals/logs";

const GlobalFilter = ({ searchParams, columnNames, commonFilterQuery, setCommonFilterQuery, setLogsFilters, logs }: {
    searchParams: { project?: string, metric?: string, filters?: string, common_filter?: string, grouping?: string | null },
    columnNames: string[]
    commonFilterQuery: string | undefined,
    setCommonFilterQuery: (query: string | null) => void
    setLogsFilters: (logsFilters: { [key: string]: { [key: string]: string } }) => void,
    logs: LogProps[] | GroupedLogProps[]
}) => {

    /* Display loader when data updates */
    const [loadingReset, setLoadingReset] = useState(false);
    const [loadingInput, setLoadingInput] = useState(false);
    useEffect(() => {
        setLoadingInput(false);
        setLoadingReset(false);
    },[logs])

    const [commonFilter, setCommonFilter] = useState<string | undefined>(
        commonFilterQuery ? commonFilterQuery.split(",")[0] : undefined
    );

    return (
        <>
            <div className="relative">
                <Input
                    placeholder={loadingInput ? "Updating logs.." : "Enter a global filter.."}
                    value={commonFilter || ""}
                    onInput={(input) => setCommonFilter(input.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            if (commonFilter) {
                                setCommonFilterQuery((commonFilter.startsWith('"') && commonFilter.endsWith('"')) 
                                    ? commonFilter 
                                    : `"${commonFilter}"`
                                );
                                setLoadingInput(true);
                            }
                            else {
                                setCommonFilterQuery(null);
                                setLoadingInput(true);
                            }
                        }
                    }}
                    className="h-5"
                    disabled={loadingInput}
                    StartContent={loadingInput ? <LoaderCircle className="animate-spin text-primary"/> : null}
                />
                {commonFilter?.length ? <div className="absolute right-2 top-[6px]">
                    <X size={18} onClick={() => setCommonFilter("")} className="cursor-pointer" />
                </div> : <></>}
            </div>
            {(searchParams.filters || searchParams.common_filter) && <ActionButton
                icon={loadingReset ? <LoaderCircle className="animate-spin text-white"/> : <Filter/>}
                tooltip="Reset all filters"
                variant={"destructive"}
                disabled={loadingReset}
                onClick={() => {
                    setLogsFilters({});
                    setCommonFilter("");
                    setCommonFilterQuery(null);
                    setLoadingReset(true)
                }}
            />}
        </>
    );
}

export default GlobalFilter;
