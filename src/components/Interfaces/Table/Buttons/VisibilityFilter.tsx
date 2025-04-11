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
}) => {

    const [paramColumns, entryColumns] = fields 
        ? [
            Object.entries(fields).filter(([key, value]) => value.field_type === "param").map(([key, value]) => `Parameters/${key}`),
            Object.entries(fields).filter(([key, value]) => value.field_type !== "param").map(([key, value]) => `Entries/${key}`)
        ] 
        : [[], []];
    
    const [anyHiddenParam, anyHiddenEntry] = [
        Object.entries(columnVisibility).filter(([column, visible]) => column.startsWith("Parameters")).some(([colum, visible]) => !visible),
        Object.entries(columnVisibility).filter(([column, visible]) => column.startsWith("Entries")).some(([colum, visible]) => !visible),
    ];

    const anyHidden = anyHiddenParam || anyHiddenEntry
    
    /* Event handlers */
    const handleAllCheck = () => {
        const state = anyHidden ? true : false;
        const newColumnVisibility = {
                "RowNumbering": true,
                ...Object.fromEntries(
                    Object.entries(columnVisibility)
                          .filter(([k, _]) => k !== "RowNumbering")
                          .map(([key]) => [key, state])
                )
        }
        setColumnVisibility(newColumnVisibility);
    };
    const handleAllParamsCheck = () => {
        const state = anyHiddenParam ? true : false;
        const newColumnVisibility = {
            ...columnVisibility,
            "RowNumbering": true,
            ...Object.fromEntries(
                Object.entries(columnVisibility)
                        .filter(([k, _]) => k.startsWith("Parameters"))
                        .map(([key]) => [key, state]),
            )
        }
        setColumnVisibility(newColumnVisibility);
    }
    const handleAllEntriesCheck = () => {
        const state = anyHiddenEntry ? true : false;
        const newColumnVisibility = {
            ...columnVisibility,
            "RowNumbering": true,
            ...Object.fromEntries(
                Object.entries(columnVisibility)
                        .filter(([k, _]) => k.startsWith("Entries"))
                        .map(([key]) => [key, state]),
            )
        }
        setColumnVisibility(newColumnVisibility);
    }
    const handleSingleCheck = (column: string) => {
        const isVisible = !columnVisibility[column];
        const newColumnVisibility = updateColumnVisibility(columnVisibility, column, isVisible);
        setColumnVisibility(newColumnVisibility);
    };

    /* Show / hide all columns */
    const hideAll= <div className="flex justify-between items-center mb-5 mt-3">
                        <span className="font-bold text-sm">{anyHidden ? "Show all" : "Hide all"}</span>
                        <Switch checked={!anyHidden} onCheckedChange={handleAllCheck}/>
                    </div> 

    /* Params toggles - moved to appear before Entries */
    const hideParams = paramColumns.length > 0 && (
        <div className="mt-2">
            <div className="flex justify-between items-center mb-1">
            <p className="font-bold text-sm">Params</p>
            <Switch checked={!anyHiddenParam} onCheckedChange={handleAllParamsCheck}/>
            </div>
            {paramColumns.map((column, index) => (
            <div key={index} className="flex items-center justify-between py-1 pl-4">
                <span className="text-sm max-w-[200px] truncate" title={column}>
                    {context ? sanitizeId(processContext("split", context, column)) : column}
                </span>
                <Switch checked={columnVisibility[column]} onCheckedChange={() => handleSingleCheck(column)}/>
            </div>
            ))}
        </div>
    )
  
    /* Entries toggles - moved to appear after Params */
    const hideEntries =
        <div className="mt-4">
        <div className="flex justify-between items-center mb-1">
            <p className="font-bold text-sm">Entries</p>
            <Switch checked={!anyHiddenEntry} onCheckedChange={handleAllEntriesCheck}/>
        </div>
        {entryColumns.map((column, index) => (
            <div key={index} className="flex items-center justify-between py-1 pl-4">
                <span className="text-sm max-w-[200px] truncate" title={column}>
                    {context ? sanitizeId(processContext("split", context, column)) : column}
                </span>
                <Switch checked={columnVisibility[column]} onCheckedChange={() => handleSingleCheck(column)}/>
            </div>
        ))}
        </div>

    /* Popover trigger */
    const button = <SettingButton tooltip={"Show / hide columns"} icon={<Columns3 />} />

    return (
        <BasePopover button={button} context="tile">
            <div className="flex flex-col gap-1 p-3">
            <p className="font-bold text-medium pb-1">Select visible columns</p>
            <div
                className="max-h-[60vh] overflow-y-auto pr-2"
                onWheel={(e) => {
                    e.stopPropagation();
                    const container = e.currentTarget;
                    container.scrollTop += e.deltaY;
                }}
            >
                {hideAll}
                {hideParams}
                {hideEntries}
            </div>
            </div>
        </BasePopover>
    );
};

export default VisibilityFilter;
