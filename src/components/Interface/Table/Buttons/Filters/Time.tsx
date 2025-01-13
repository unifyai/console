"use client";

import { useState } from "react";
import { FiltersByColumn } from "@/types/evals/columns";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import SubmitButton from "@/components/Common/Buttons/Submit";
import CancelButton from "@/components/Common/Buttons/Cancel";
import { Filter } from "lucide-react";
import { DateTimeRangeSelector } from "@/components/Common/Time/DatetimeRangeSelector";
import { KeyboardEventHandler } from "react";

const TimeColumnFilter = ({ column, columnFilters, setColumnFilterQuery, boundaries }: {
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void,
    boundaries: {minimums: {[key: string]: any}, maximums: {[key: string]: any}}
}) => {

    /* Track states */
    const [initialStartDate, initialEndDate] = [
        columnFilters[column] && columnFilters[column][">"] ? columnFilters[column][">"] : boundaries.minimums["ts"], 
        columnFilters[column] && columnFilters[column]["<"] ? columnFilters[column]["<"] : boundaries.maximums["ts"]
    ];
    const [startDate, setStartDateState] = useState<string | undefined>(initialStartDate);
    const [endDate, setEndDateState] = useState<string | undefined>(initialEndDate);
    const changed = startDate != initialStartDate || endDate != initialEndDate;
    
    /* Handle submit */
    const onSubmit = () => {
        let newColumnFilters = { ...columnFilters }
        newColumnFilters[column] = { ...(newColumnFilters[column] || {}) };
        if (startDate) 
            newColumnFilters[column][">"] = `"${startDate}"`
        if (endDate)
            newColumnFilters[column]["<"] = `"${endDate}"`
        if (!startDate && !endDate) 
            newColumnFilters = Object.fromEntries(
                Object.entries(columnFilters).filter(([key, _]) => key != column)
            )
        setColumnFilterQuery(newColumnFilters)
    }
    const onReset = () => {
        const newColumnFilters = Object.fromEntries(
            Object.entries(columnFilters).filter(([key, _]) => key != column)
        );
        setColumnFilterQuery(newColumnFilters)
    }
    const onEnter : KeyboardEventHandler = (event) => {
        if (event.key === "Enter") {
            onSubmit()
        }
    }

    /* Inputs */
    const filterInput = <DateTimeRangeSelector
        startDate={startDate}
        endDate={endDate}
        onDateRangeChange={(start: string, end: string) => {
          setStartDateState(start);
          setEndDateState(end);
        }}
        className="flex-1 min-w-[200px]"
    />
    const button = <ActionButton icon={<Filter/>} tooltip="Filter" variant={column in columnFilters ? "primary" : undefined} />
    const reset = <CancelButton text="Reset" onClick={() => onReset()}/>
    const submit = <SubmitButton text="Apply" onClick={() => onSubmit()}/>
    return (
        <BaseDropdown button={button} label={`Filter logs by ${column} value`}>
            <div className="flex flex-col gap-2 p-2">
                {filterInput}
                {changed &&
                    <div className="flex flex-row gap-2 justify-end">
                        {reset}
                        {submit}
                    </div>
                }
            </div>
        </BaseDropdown>
    );
}

export default TimeColumnFilter;