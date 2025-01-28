"use client";

import { useState } from "react";
import { Input } from "@/components/UI/input";
import { Filter, X } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

const GlobalFilter = ({ interactive, logsFilters, commonFilter_, setLogsFilters, setCommonFilter_ }: {
    interactive: boolean,
    logsFilters: string | undefined,
    commonFilter_: string | undefined,
    setLogsFilters: (logsFilters: { [key: string]: { [key: string]: string } }) => void
    setCommonFilter_: (newValue: string | undefined) => void
}) => {
    const [commonFilter, setCommonFilter] = useState<string | undefined>(
        commonFilter_ ? commonFilter_.split(",")[0] : undefined
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
                                setCommonFilter_((commonFilter.startsWith('"') && commonFilter.endsWith('"')) 
                                    ? commonFilter 
                                    : `"${commonFilter}"`
                                );
                            }
                            else
                                setCommonFilter_(undefined);
                        }
                    }}
                    disabled={!interactive}
                    className="h-8"
                />
                {commonFilter?.length ? <div className="absolute right-2 top-[9px]">
                    <X size={18} onClick={() => setCommonFilter("")} className="cursor-pointer" />
                </div> : <></>}
            </div>
            {(logsFilters || commonFilter_) && <ActionButton
                icon={<Filter />}
                tooltip="Reset All Filters"
                variant={"destructive"}
                onClick={() => {
                    setLogsFilters({});
                    setCommonFilter("");
                    setCommonFilter_(undefined);
                }}
                disabled={!interactive}
            />}
        </>
    );
}

export default GlobalFilter;
