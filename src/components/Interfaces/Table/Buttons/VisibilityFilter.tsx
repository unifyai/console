"use client";

import { useEffect, useState } from "react";
import { BasePopover } from "@/components/Common/Popovers/Base";
import { Columns3, LoaderCircle } from "lucide-react";
import SettingButton from "@/components/Common/Buttons/Setting";
import { Switch } from "@/components/UI/switch";
import { processContext, sanitizeId, updateColumnVisibility } from "@/utils/evals/columnOperations";
import { LogProps, LogFieldsResponseProps, GroupedLogProps } from "@/types/evals/logs";

const VisibilityFilter = ({ fields, columnVisibility, setColumnVisibility, context}: {
    fields: LogFieldsResponseProps,
    columnVisibility: { [key: string]: boolean },
    setColumnVisibility: (x: { [key: string]: boolean }) => void,
    context: string | null,
    logs: LogProps[] | GroupedLogProps[]
}) => {

    const columns = Object.entries(fields).map(([key, value]) => value.field_type === "param" ? `Parameters/${key}` : `Entries/${key}`);
    const anyHidden = Object.values(columnVisibility).some(bool => !bool);

    const handleAllCheck = () => {
        
        const state = anyHidden ? true : false;
        const newColumnVisibility = Object.fromEntries(
          Object.entries(columnVisibility).map(([key]) => [key, state])
        );

        setColumnVisibility(newColumnVisibility);
    };

    const handleSingleCheck = (column: string) => {
        const isVisible = !columnVisibility[column];
        const newColumnVisibility = updateColumnVisibility(columnVisibility, column, isVisible);
        setColumnVisibility(newColumnVisibility);
    };


    return (
        <BasePopover
            button={
                <SettingButton 
                    tooltip={"Show / hide columns"} 
                    icon={<Columns3 />} 
                />
            }
        >
            <div className="flex flex-col gap-1 p-3 max-h-100 overflow-y-auto">
                <p className="font-bold text-medium pb-1">Select visible columns</p>
                <div className="flex flex-row gap-2 items-center justify-between font-bold pb-2">
                    <Switch checked={!anyHidden} onCheckedChange={handleAllCheck}/>
                    {`${anyHidden ? "Show all" : "Hide all"}`}
                </div>
                {columns.map((column, index) => (
                    <div key={index} className="flex flex-row gap-2 items-center justify-between">
                        <Switch checked={columnVisibility[column]} onCheckedChange={() => handleSingleCheck(column)}/>
                        {context ? sanitizeId(processContext("split", context, column)) : column}
                    </div>
                ))}
            </div>
        </BasePopover>
    );
};

export default VisibilityFilter;
