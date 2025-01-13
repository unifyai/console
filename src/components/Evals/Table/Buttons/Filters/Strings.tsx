"use client";

import { KeyboardEventHandler, useState } from "react";
import { FiltersByColumn } from "@/types/evals/columns";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import SubmitButton from "@/components/Common/Buttons/Submit";
import CancelButton from "@/components/Common/Buttons/Cancel";
import { Filter } from "lucide-react";
import InputWithStartSelect from "@/components/Common/Input/StartSelect";
import { Option } from "@/components/Common/Input/StartSelect";

const StringColumnFilter = ({ column, columnFilters, setColumnFilterQuery }: {
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void
}) => {
    
    /* Track states */
    const initialValue = 
        (columnFilters[column] && columnFilters[column]["in"]) ? columnFilters[column]["in"] :
        (columnFilters[column] && columnFilters[column]["not in"]) ? columnFilters[column]["not in"] : ""
    const [filter, setFilter] = useState<string>(initialValue);
    const changed = filter != initialValue
    
    /* Handle submit */
    const onSubmit = () => {
        let newColumnFilters = { ...columnFilters }
        if (filter){
            const filterFunction = option.name
            const filterValue = filterFunction === "not in" 
                ? filter
                : filter.startsWith('"') && filter.endsWith('"') 
                    ? filter 
                    : `"${filter}"`
            newColumnFilters = {...columnFilters, [column]: {[filterFunction] : filterValue}}
        } else{
            Object.fromEntries(
                Object.entries(columnFilters).filter(([key, _]) => key != column)
            )
            setFilter("")
        }
        setColumnFilterQuery(newColumnFilters)
    }
    const onReset = () => {
        const newColumnFilters = Object.fromEntries(
            Object.entries(columnFilters).filter(([key, _]) => key != column)
        )
        setFilter("")
        setColumnFilterQuery(newColumnFilters)
    }
    const onEnter : KeyboardEventHandler = (event) => {
        if (event.key === "Enter") {
            onSubmit()
        }
    }

    /* Inputs */
    const options = [
        {name: "in", label: "Includes"},
        {name: "not in", label: "Excludes"}
    ]
    const initialOption =  
    (columnFilters[column] && columnFilters[column]["in"]) ? options[0] :
    (columnFilters[column] && columnFilters[column]["not in"]) ? options[1] : options[0]
    const [option, setOption] = useState<Option>(initialOption)
    const filterInput = <InputWithStartSelect
        options={options}
        option={option}
        placeholder={`Filter for entries ${option.name === "in" ? "including" : "excluding"}..`}
        inputValue={filter}
        onInput={(input) => setFilter(input.currentTarget.value)}
        onKeyDown={onEnter}
        onOptionChange={setOption}
    />
    const button = <ActionButton icon={<Filter/>} tooltip="Filter" variant={column in columnFilters ? "primary" : undefined} />
    const reset = <CancelButton text="Reset" onClick={() => onReset()}/>
    const submit = <SubmitButton text="Apply" onClick={() => onSubmit()}/>
    return (
        <BaseDropdown button={button} label={`Filter logs by ${column} value`}>
            <div className="flex flex-col gap-2 p-2">
                {filterInput}
                {changed && <div className="flex flex-row gap-2 justify-end">
                    {reset}
                    {submit}
                </div>}
            </div>
        </BaseDropdown>
    );
}

export default StringColumnFilter;
