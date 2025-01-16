"use client";

import { KeyboardEventHandler, useState } from "react";
import { Filters, FiltersByColumn } from "@/types/evals/columns";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import BaseButton from "@/components/Common/Buttons/Base";
import SubmitButton from "@/components/Common/Buttons/Submit";
import { Filter, Plus, Trash, CircleX } from "lucide-react";
import InputWithStartSelect from "@/components/Common/Input/StartSelect";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { combineFilters, initFilters } from "@/utils/evals/filters";

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

    /* Init filters */
    const options = [
        {name: "in", label: "Includes"},
        {name: "not in", label: "Excludes"}
    ]
    const modes = options.map(option => option.name)
    let defaultFilter : StringFilter = {key: 0, mode: "in", join: "&&", value: ""}
    let initialValues : StringFilter[] = [defaultFilter];
    if (columnFilters[column]) initFilters(column, columnFilters, initialValues, modes);
    const [filters, setFilters] = useState(initialValues);
    
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
                value: f.value.startsWith('"') && f.value.endsWith('"') ? f.value : `"${f.value}"`  // Need to wrap in quotes
            }))
            const filter : Filters = combineFilters(newFilters, modes)
            newColumnFilters = {...columnFilters, [column]: filter}
        } else{
            Object.fromEntries(
                Object.entries(columnFilters).filter(([key, _]) => key != column)
            )
            setFilters([defaultFilter])
        }
        setColumnFilterQuery(newColumnFilters);
        setOpen(false);
    }
    const onReset = () => {
        const newColumnFilters = Object.fromEntries(
            Object.entries(columnFilters).filter(([key, _]) => key != column)
        )
        setFilters([defaultFilter])
        setColumnFilterQuery(newColumnFilters)
        setOpen(false)
    }
    const onEnter : KeyboardEventHandler = (event) => {
        if (event.key === "Enter") {
            onSubmit()
            setOpen(false)
        }
    }

    // Dialog interactions
    const [open, setOpen] = useState(false);
    const close = <BaseButton size="sm" icon={<CircleX/>} onClick={() => setOpen(false)} className="top-0 right-0 scale-60 absolute" variant="warning"/>
    const button = <ActionButton icon={<Filter/>} tooltip="Filter" variant={column in columnFilters ? "primary" : undefined} />
    const reset = <ActionButton tooltip="Delete all filters" variant="warning" icon={<Trash/>} onClick={() => onReset()}/> 
    const submit = <SubmitButton text="Apply" onClick={() => onSubmit()}/>
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
                    {method.toLowerCase()}
                </DropdownMenuItem>
            )}
        </BaseDropdown>

    // Filter row
    const join = (filter: StringFilter) => 
        <BaseDropdown button={<ActionButton tooltip="Update joining method" text={filter.join === "&&" ? "and" : "or"}/>}>
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
                    {method.toLowerCase()}
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
                newFilters = newFilters.length ? newFilters : [defaultFilter]
                setFilters(newFilters)
            }}
        /> 

    return (
        <BaseDropdown button={button} open={open} setOpen={setOpen}>
            <div className="flex flex-col gap-3 px-2 pt-4 pb-2">
                {filters.map((filter, index) => 
                    <div key={index} className="grid grid-cols-8 items-center">
                        {filters.length > 0 && filter.key != 0 && <div className="col-span-1">{join(filter)}</div>}
                        <div className={`${filters.length > 0 && filter.key != 0 ? "col-span-6" : "col-span-7"}`}>{filterInput(filter)}</div>
                        <div className="col-span-1 text-center">{remove(filter)}</div>
                    </div>
                )}
                <div className="flex flex-row gap-2 justify-between">
                    {append}
                    <div className="flex flex-row gap-2 justify-end">
                        {reset}
                        {submit}
                    </div>
                </div>
                {close}
            </div>
        </BaseDropdown>
    );
}

export default StringColumnFilter;