"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/Common/Input/Content";
import { Filter, X, LoaderCircle } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";
import { LogProps } from "@/types/evals/logs";

const GlobalFilter = ({ interactive, logsFilters, commonFilter_, setLogsFilters, setCommonFilter_, logs }: {
    interactive: boolean,
    logsFilters: string | undefined,
    commonFilter_: string | undefined,
    setLogsFilters: (logsFilters: { [key: string]: { [key: string]: string } }) => void
    setCommonFilter_: (newValue: string | undefined) => void,
    logs: LogProps[]
}) => {

    /* Display loader when data updates */
    const [loadingReset, setLoadingReset] = useState(false);
    const [loadingInput, setLoadingInput] = useState(false);
    useEffect(() => {
        setLoadingInput(false);
        setLoadingReset(false);
    },[logs])

    const [commonFilter, setCommonFilter] = useState<string | undefined>(
        commonFilter_ ? commonFilter_.split(",")[0] : undefined
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
                                setCommonFilter_((commonFilter.startsWith('"') && commonFilter.endsWith('"')) 
                                    ? commonFilter 
                                    : `"${commonFilter}"`
                                );
                                setLoadingInput(true);
                            }
                            else {
                                setCommonFilter_(undefined);
                                setLoadingInput(true);
                            }
                        }
                    }}
                    disabled={!interactive || loadingInput}
                    className="h-5"
                    StartContent={loadingInput ? <LoaderCircle className="animate-spin text-primary"/> : null}
                />
                {commonFilter?.length ? <div className="absolute right-2 top-[6px]">
                    <X size={18} onClick={() => setCommonFilter("")} className="cursor-pointer" />
                </div> : <></>}
            </div>
            {(logsFilters || commonFilter_) && <ActionButton
                icon={loadingReset ? <LoaderCircle className="animate-spin text-white"/> : <Filter/>}
                tooltip="Reset All Filters"
                variant={"destructive"}
                onClick={() => {
                    setLogsFilters({});
                    setCommonFilter("");
                    setCommonFilter_(undefined);
                    setLoadingReset(true);
                }}
                disabled={!interactive || loadingReset}
            />}
        </>
    );
}

export default GlobalFilter;
