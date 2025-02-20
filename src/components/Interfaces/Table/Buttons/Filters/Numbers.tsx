"use client";

import { useState, useEffect, Dispatch, SetStateAction } from "react";
import { Filters, FiltersByColumn } from "@/types/evals/columns";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import SubmitButton from "@/components/Common/Buttons/Submit";
import BaseButton from "@/components/Common/Buttons/Base";
import { Filter } from "lucide-react";
import { KeyboardEventHandler } from "react";
import InputWithStartSelect from "@/components/Common/Input/StartSelect";
import { Input } from "@/components/UI/input";
import { Slider } from "@/components/UI/slider";
import { initFilters, combineFilters } from "@/utils/evals/filters";
import { Trash, Plus, CircleX, LoaderCircle } from "lucide-react";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { GroupedLogProps, LogProps } from "@/types/evals/logs";

interface NumericFilter {
    key: number,
    mode: "==" | "!=" | ">=" | "=<" | ">" | "<" | "exists" | "isNone",
    join: "&&" | "||",
    value: string
}

const NumericColumnFilter = ({
    interactive,
    column,
    columnFilters,
    setColumnFilterQuery,
    boundaries,
    logs,
    open,
    setOpen,
    filterLoading,
    setFilterLoading,
    setIsFiltered
}: {
    interactive: boolean,
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void,
    boundaries: {minimums: {[key: string]: number;}, maximums: {[key: string]: number}},
    logs: LogProps[] | GroupedLogProps[],
    open: boolean,
    setOpen: Dispatch<SetStateAction<boolean>>,
    filterLoading: boolean,
    setFilterLoading: (filterLoading: boolean) => void,
    setIsFiltered: (isFiltered: boolean) => void,
}) => {

    /* Display loader when data updates */
    const [spinnerColor, setSpinnerColor] = useState("white");
    useEffect(() => {
        setFilterLoading(false);
    },[logs])

    /* Initialize filters */
    const options = [
        {name: "==", label: "="  , description: "Filter for values equal to.."},
        {name: "!=", label: "!=" , description: "Filter for values not equal to.."},
        {name: ">",  label: ">"  , description: "Filter for values greater than.."},
        {name: ">=", label: ">=" , description: "Filter for values greater or equal to.."},
        {name: "<",  label: "<"  , description: "Filter for values less than.."},
        {name: "<=", label: "<=" , description: "Filter for values less or equal to.."},
        {name: "exists", label: "exists" , description: "Filter for existing values.."},
        {name: "isNone", label: "isNone" , description: "Filter for none values.."}
    ]
    const modes = options.map(option => option.name)
    const [minValue, maxValue] = [boundaries.minimums[column], boundaries.maximums[column]]
    let defaultFilter : NumericFilter = {key: 0, mode: "==", join: "&&", value: ""}
    let initialValues : NumericFilter[] = []
    if (columnFilters[column]) {
        initFilters(column, columnFilters, initialValues, modes)
    } else {
        initialValues.push(defaultFilter)
    }
    const [filters, setFilters] = useState(initialValues);
    const isFiltered = column in columnFilters;

    useEffect(() => {
        setIsFiltered(isFiltered);
    }, [isFiltered])

    /* Event handlers */
    const onInput = (value: any, filter: NumericFilter) => {
        const newFilters = [...filters]
        newFilters.find(f => f.key === filter.key)!.value = value
        setFilters(newFilters)
    }
    const onSubmit = () => {
        let newColumnFilters = { ...columnFilters }
        if (filters.length){
            const newFilters = filters.map(f => ({
                key: f.key, 
                mode: f.mode, 
                join: f.join, 
                value: f.value
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
        setSpinnerColor("white")
        setFilterLoading(true);
        setOpen(false);
    }
    const onReset = () => {
        const newColumnFilters = Object.fromEntries(
            Object.entries(columnFilters).filter(([key, _]) => key != column)
        );
        setFilters([defaultFilter])
        setColumnFilterQuery(newColumnFilters)
        setSpinnerColor("primary")
        setFilterLoading(true);
        setOpen(false)
    }
    const onEnter : KeyboardEventHandler = (event) => {
        if (event.key === "Enter") {
            onSubmit()
        }
    }

    /* Dialog interactions */
    const close = <BaseButton size="sm" icon={<CircleX/>} onClick={() => setOpen(false)} className="top-0 right-0 scale-60 absolute" variant="warning"/>
    const button = <ActionButton icon={filterLoading ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> : <Filter/>} tooltip="Filter" variant={column in columnFilters ? "primary" : undefined} disabled={!interactive || filterLoading}/>
    const reset = <ActionButton tooltip="Delete all filters" variant="warning" icon={<Trash/>} onClick={() => onReset()}/> 
    const submit = <SubmitButton text="Save" onClick={() => onSubmit()}/>
    const append = 
        <BaseDropdown button={<ActionButton tooltip="Add new filter" icon={<Plus/>}/>}>
            {["And", "Or"].map((method, index) => 
                <DropdownMenuItem 
                    key={index}
                    className="p-2 hover:text-white hover:bg-primary cursor-pointer" 
                    onClick={() => {
                        const newFilters = [...filters]
                        newFilters.push({key: filters.length, mode: "==", join: method === "And" ? "&&" : "||", value: ""})
                        setFilters(newFilters)
                    }}            
                >
                    {method.toLowerCase()}
                </DropdownMenuItem>
            )}
        </BaseDropdown>

    /* Filter row */
    const join = (filter: NumericFilter) => 
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
    const valueInput = (filter: NumericFilter, option: {name: string, label: string, description: string} ) => 
        <Input
            className="-ms-px rounded-s-none shadow-none focus-visible:z-10"
            placeholder={option.description}
            type="text"
            value={filter.value}
            onInput={(input: any) => onInput(input.currentTarget.value, filter)}
            onKeyDown={onEnter}
            inputMode="decimal"
        />
    const toggleInput = (filter: NumericFilter) =>     
        <BaseButton 
            text={filter.value} 
            variant="outline" 
            className="rounded-none rounded-tr-lg rounded-br-lg" 
            onClick={() => {
                const newFilters = [...filters]
                newFilters.find(f => f.key === filter.key)!.value === "true" 
                    ? newFilters.find(f => f.key === filter.key)!.value = "false"
                    : newFilters.find(f => f.key === filter.key)!.value = "true"
            }}
        />
    const filterInput = (filter: NumericFilter, withSlider: boolean) => {
        const option = options.find(option => option.name === filter.mode)!;
        return (
            <div className="flex flex-row gap-2">
                <InputWithStartSelect
                    options={options}
                    option={option}
                    onOptionChange={(option) => {
                        const newFilters = [...filters]
                        newFilters.find(f => f.key === filter.key)!.mode = option.name as "==" | "!="
                        if (["exists", "isNone"].includes(option.name)) {
                            newFilters.find(f => f.key === filter.key)!.value = "true"
                        }
                    }}
                >
                    {["exists", "isNone"].includes(option.name) ? toggleInput(filter) : valueInput(filter, option)}
                </InputWithStartSelect>
                {withSlider && 
                    <div className="flex flex-col grow w-full px-2">
                        <span
                            className="mb-2 flex w-full items-center justify-between gap-2 text-xs font-medium text-muted-foreground"
                            aria-hidden="true"
                        >
                            <span>{minValue}</span>
                            <span>{maxValue}</span>
                        </span>
                        <Slider
                            className="w-full"
                            value={[parseFloat(filter.value)]}
                            onValueChange={(value) => onInput(value[0].toString(), filter)}
                            min={minValue}
                            max={maxValue}
                            aria-label="Slider with input"
                        />
                    </div>
                }
            </div>
        )}
    const remove = (filter: NumericFilter) =>
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
        <BaseDropdown button={button} open={interactive && open} setOpen={setOpen}>
            <div className="flex flex-col gap-3 px-2 pt-4 pb-2">
                {filters.map((filter, index) => 
                    <div key={index} className="grid grid-cols-8 items-center">
                        {filters.length > 0 && filter.key != 0 && <div className="col-span-1">{join(filter)}</div>}
                        <div className={`${filters.length > 0 && filter.key != 0 ? "col-span-6" : "col-span-7"}`}>{filterInput(filter, !["==", "!=", "exists", "isNone"].includes(filter.mode))}</div>
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

export default NumericColumnFilter;
