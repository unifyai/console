"use client";

import { KeyboardEventHandler, useState } from "react";
import { Filters, FiltersByColumn } from "@/types/evals/columns";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import SubmitButton from "@/components/Common/Buttons/Submit";
import CancelButton from "@/components/Common/Buttons/Cancel";
import { Filter, Plus, Trash } from "lucide-react";
import InputWithStartSelect from "@/components/Common/Input/StartSelect";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { separateFunctionFilters } from "@/utils/evals/filters";

interface StringFilter {
    key: number,
    mode: "in" | "not in",
    join: "&&" | "||",
    value: string
}

const StringColumnFilter = ({ column, columnFilters, setColumnFilterQuery }: {
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void
}) => {

    /* Track states */
    let initialValues : StringFilter[] = [];
    if (columnFilters[column]) {
        const included = columnFilters[column]["in"]
        if (included) {
            const array = ["&&"].concat(separateFunctionFilters(included))
            for (let i = 0; i < array.length; i += 2) {
                const key = i
                const mode = "in"
                const join = array[i] as "&&" || "||"
                const value = array[i + 1].startsWith('"') && array[i + 1].endsWith('"') ? array[i + 1].slice(1, -1) : array[i + 1]
                initialValues.push({key, mode, join, value});
            }
        }
        const excluded = columnFilters[column]["not in"]
        if (excluded) {
            const array = ["&&"].concat(separateFunctionFilters(excluded))
            for (let i = 0; i < array.length; i += 2) {
                const key = initialValues.length + i
                const mode = "not in"
                const join = array[i] as "&&" || "||"
                const value = array[i + 1].startsWith('"') && array[i + 1].endsWith('"') ? array[i + 1].slice(1, -1) : array[i + 1]
                initialValues.push({key, mode, join, value});
            }
        }
    }

    const [filters, setFilters] = useState(initialValues);
    const changed = JSON.stringify(filters) != JSON.stringify(initialValues)
    
    /* Event handlers */
    const onInput = (input: any, filter: StringFilter) => {
        const newFilters = [...filters]
        newFilters.find(f => f.key === filter.key)!.value = input.currentTarget.value
        setFilters(newFilters)
    }

    const onSubmit = () => {
        let newColumnFilters = { ...columnFilters }
        if (filters.length){
            const newFilters = filters.map(f => ({
                key: f.key, 
                mode: f.mode, 
                join: f.join, 
                value: f.value.startsWith('"') && f.value.endsWith('"') ? f.value : `"${f.value}"`
            }))
            const filter : Filters = {}
            const included = newFilters.filter(f => f.mode === "in")
            if (included.length) {
                let value = included[0].value
                for (let i = 1; i < included.length; i++) {
                    value += " " + included[i].join + " " + included[i].value;
                }
                filter["in"] = value
            }
            const excluded = newFilters.filter(f => f.mode === "not in")
            if (excluded.length) {
                let value = excluded[0].value
                for (let i = 1; i < excluded.length; i++) {
                    value += " " + excluded[i].join + " " + excluded[i].value;
                }
                filter["not in"] = value
            } 
            newColumnFilters = {...columnFilters, [column]: filter}
        } else{
            Object.fromEntries(
                Object.entries(columnFilters).filter(([key, _]) => key != column)
            )
            setFilters([])
        }
        setColumnFilterQuery(newColumnFilters)
    }
    const onReset = () => {
        const newColumnFilters = Object.fromEntries(
            Object.entries(columnFilters).filter(([key, _]) => key != column)
        )
        setFilters([])
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

    // Dialog interactions
    const button = <ActionButton icon={<Filter/>} tooltip="Filter" variant={column in columnFilters ? "primary" : undefined} />
    const reset = <CancelButton text="Reset" onClick={() => onReset()}/>
    const submit = <SubmitButton text="Apply" onClick={() => onSubmit()}/>
    const create = <ActionButton tooltip="Add filter" icon={<Plus/>} onClick={() => {
        const mode = "in" as "in" | "not in"
        const join = "&&" as "&&" | "||"
        const newFilters = [{key: 0, mode: mode, join: join, value: ""}]
        setFilters(newFilters)
    }}/>
    const append = 
        <BaseDropdown button={<ActionButton tooltip="Add new filter" icon={<Plus/>}/>}>
            {["And", "Or"].map((method, index) => 
                <DropdownMenuItem 
                    key={index}
                    className="p-2 hover:text-white hover:bg-primary cursor-pointer" 
                    onClick={() => {
                        const newFilters = [...filters]
                        newFilters.push({key: filters.length, mode: "in", join: method === "And" ? "&&" : "||", value: ""})
                        setFilters(newFilters)
                    }}            
                >
                    {method}
                </DropdownMenuItem>
            )}
        </BaseDropdown>

    // Filter row
    const join = (filter: StringFilter) => 
        <BaseDropdown button={<ActionButton tooltip="Update joining method" text={filter.join === "&&" ? "And" : "Or"}/>}>
            {["And", "Or"].map((method, index) => 
                <DropdownMenuItem 
                    key={index}
                    className="p-2 hover:text-white hover:bg-primary cursor-pointer" 
                    onClick={() => {
                        const newFilters = [...filters]
                        const join = method === "And" ? "&&" : "||"
                        newFilters.find(f => f.key === filter.key)!.join = join 
                        setFilters(newFilters)
                    }}            
                >
                    {method}
                </DropdownMenuItem>
            )}
        </BaseDropdown>
    const filterInput = (filter: StringFilter) => 
        <InputWithStartSelect
            options={options}
            option={options.find(option => option.name === filter.mode)}
            placeholder={`Filter for entries ${filter.mode === "in" ? "including" : "excluding"}..`}
            inputValue={filter.value}
            onInput={(input) => onInput(input, filter)}
            onKeyDown={onEnter}
            onOptionChange={(option) => {
                const newFilters = [...filters]
                newFilters.find(f => f.key === filter.key)!.mode = option.name as "in" | "not in"
            }}
        />    
    const remove = (filter: StringFilter) =>
        <ActionButton
            tooltip="Remove filter"
            icon={<Trash/>}
            onClick={() => {
                let newFilters = filters.filter(f => f.key != filter.key)
                newFilters = newFilters.map((f, i) => ({key: i, mode: f.mode, join: i === 0 ? "&&" : f.join, value: f.value}))
                setFilters(newFilters)
            }}
        /> 

    return (
        <BaseDropdown button={button}>
            <div className="flex flex-col gap-3 p-2">
                <div className="flex flex-row justify-between items-center gap-5 pl-1 pr-3">
                    <p>Apply one or more filters</p>
                    {filters.length === 0 ? create : append}
                </div>
                {filters.map((filter, index) => 
                    <div key={index} className="grid grid-cols-8 items-center">
                        {filters.length > 0 && filter.key != 0 && <div className="col-span-1">{join(filter)}</div>}
                        <div className={`${filters.length > 0 && filter.key != 0 ? "col-span-6" : "col-span-7"}`}>{filterInput(filter)}</div>
                        <div className="col-span-1 text-center">{remove(filter)}</div>
                    </div>
                )}
                {changed && <div className="flex flex-row gap-2 justify-end">
                    {reset}
                    {submit}
                </div>}
            </div>
        </BaseDropdown>
    );
}

export default StringColumnFilter;