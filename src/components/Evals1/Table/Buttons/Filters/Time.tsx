"use client";

import { useState } from "react";
import { FiltersByColumn } from "@/types/evals/columns";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import SubmitButton from "@/components/Common/Buttons/Submit";
import { Filter } from "lucide-react";
import { TimeRangeSelector } from "@/components/Usage/Filters";

const TimeColumnFilter = ({ column, columnFilters, setColumnFilterQuery }: {
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void
}) => {
    
    /* Track states */
    const [initialStartDate, initialEndDate] = [columnFilters[column][">"], columnFilters[column]["<"]];
    const [startDate, setStartDateState] = useState<string | undefined>(initialStartDate);
    const [endDate, setEndDateState] = useState<string | undefined>(initialEndDate);
    const changed = startDate != initialStartDate || endDate != initialEndDate;
    
    /* Handle submit */
    const onSubmit = () => {
        let newColumnFilters = { ...columnFilters }
        if (startDate) 
            newColumnFilters = { ...columnFilters, [column]: {...columnFilters.column, ">" : startDate}}
        if (endDate) 
            newColumnFilters = { ...columnFilters, [column]: {...columnFilters.column, "<" : endDate}}
        if (!startDate && !endDate) 
            newColumnFilters = Object.fromEntries(
                Object.entries(columnFilters).filter(([key, _]) => key != column)
            )
        setColumnFilterQuery(newColumnFilters)
    }
    const onEnter = (event: KeyboardEvent) => {
        if (event.key === "Enter") {
            onSubmit()
        }
    }

    /* Inputs */
    const filterInput = <TimeRangeSelector
        startDate={startDate}
        endDate={endDate}
        onDateRangeChange={(start: string, end: string) => {
          setStartDateState(start);
          setEndDateState(end);
        }}
        className="flex-1 min-w-[200px]"
    />
    const button = <ActionButton icon={<Filter/>} tooltip="Filter" variant={column in columnFilters ? "primary" : undefined} />
    const submit = <SubmitButton text="Apply" onClick={() => onSubmit()}/>
    return (
        <BaseDropdown button={button} label={`Filter logs by`}>
            {filterInput}
            {changed && <div className="flex flex-row justify-end">{submit}</div>}
        </BaseDropdown>
    );
}

export default TimeColumnFilter;
