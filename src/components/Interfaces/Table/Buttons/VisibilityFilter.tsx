"use client";

import { useEffect, useState } from "react";
import { BasePopover } from "@/components/Common/Popovers/Base";
import { Columns3, LoaderCircle } from "lucide-react";
import SettingButton from "@/components/Common/Buttons/Setting";
import { Switch } from "@/components/UI/switch";
import { processContext, sanitizeId, updateColumnVisibility } from "@/utils/evals/columnOperations";
import { LogProps, LogFieldsResponseProps } from "@/types/evals/logs";

const VisibilityFilter = ({ fields, columnVisibility, setColumnVisibility, context, logs }: {
    fields: LogFieldsResponseProps,
    columnVisibility: { [key: string]: boolean },
    setColumnVisibility: (x: { [key: string]: boolean }) => void,
    context: string | null,
    logs: LogProps[]
}) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    },[logs])

    const columns = Object.entries(fields).map(([key, value]) => value.field_type === "param" ? `Parameters/${key}` : `Entries/${key}`);
    const anyHidden = Object.values(columnVisibility).some(bool => !bool);

    const handleAllCheck = () => {
        
        const state = anyHidden ? true : false;
        const newColumnVisibility = Object.fromEntries(
          Object.entries(columnVisibility).map(([key]) => [key, state])
        );

        // Only trigger loading state when adding new columns
        const oldVisibleColumns = Object.values(columnVisibility).filter(isVisible => isVisible)
        const newVisibleColumns = Object.values(newColumnVisibility).filter(isVisible => isVisible)
        if (newVisibleColumns.length > oldVisibleColumns.length) setLoading(true);

        setColumnVisibility(newColumnVisibility);
    };

    const handleSingleCheck = (column: string) => {
        const isVisible = !columnVisibility[column];
        if (isVisible) setLoading(true);
        const newColumnVisibility = updateColumnVisibility(columnVisibility, column, isVisible);
        setColumnVisibility(newColumnVisibility);
    };


    return (
        <BasePopover
            button={
                <SettingButton 
                    tooltip={"Show / hide columns"} 
                    icon={loading ? <LoaderCircle className="animate-spin text-primary"/> : <Columns3 />} 
                    disabled={loading}
                />
            }
        >
            <div className="flex flex-col gap-1 p-3 max-h-100 overflow-y-auto">
                <p className="font-bold text-medium pb-1">Select visible columns</p>
                <div className="flex flex-row gap-2 items-center justify-between font-bold pb-2">
                    <Switch checked={!anyHidden} onCheckedChange={handleAllCheck} disabled={loading}/>
                    {`${anyHidden ? "Show all" : "Hide all"}`}
                </div>
                {columns.map((column, index) => (
                    <div key={index} className="flex flex-row gap-2 items-center justify-between">
                        <Switch checked={columnVisibility[column]} onCheckedChange={() => handleSingleCheck(column)} disabled={loading}/>
                        {context ? sanitizeId(processContext("split", context, column)) : column}
                    </div>
                ))}
            </div>
        </BasePopover>
    );
};

export default VisibilityFilter;
