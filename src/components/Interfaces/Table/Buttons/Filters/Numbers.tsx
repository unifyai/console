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
import { Trash, Plus, Minus, CircleX, LoaderCircle } from "lucide-react";
import {  DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { GroupedLogProps, LogProps } from "@/types/evals/logs";
import BaseDialog from "@/components/Common/Dialogs/Base";
import { sanitizeId } from "@/utils/evals/columnOperations";
import { formatNumber } from "@/utils/formatNumber";

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
    dataTypes,
    open,
    setOpen,
    filterLoading,
    setFilterLoading,
    setIsFiltered,
    renderMode
}: {
    interactive: boolean,
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void,
    boundaries: {minimums: {[key: string]: number;}, maximums: {[key: string]: number}},
    dataTypes: {[key: string]: string},
    open: boolean,
    setOpen: Dispatch<SetStateAction<boolean>>,
    filterLoading: boolean,
    setFilterLoading: (filterLoading: boolean) => void,
    setIsFiltered: (isFiltered: boolean) => void,
    renderMode: "button" | "menuItem"
}) => {

    /* Display loader when data updates */
    const [spinnerColor, setSpinnerColor] = useState("white");

    /* Initialize filters */
    const options = [
        {name: "==", label: "==" , description: `Filter ${column} for values equal to..`},
        {name: "!=", label: "!=" , description: `Filter ${column} for values not equal to..`},
        {name: ">",  label: ">"  , description: `Filter ${column} for values greater than..`},
        {name: ">=", label: ">=" , description: `Filter ${column} for values greater or equal to..`},
        {name: "<",  label: "<"  , description: `Filter ${column} for values less than..`},
        {name: "<=", label: "<=" , description: `Filter ${column} for values less or equal to..`},
        {name: "exists", label: "exists" , description: `Filter ${column} for existing values..`},
        {name: "isNone", label: "isNone" , description: `Filter ${column} for none values..`}
    ]
    const modes = options.map(option => option.name)

    const [minValue, maxValue] = [boundaries.minimums[column], boundaries.maximums[column]]
    const sliderMin = minValue;
    const sliderMax = maxValue;

    // Choose step size based on data type
    let stepSize = 1; // default step for non-float
    if (dataTypes[column] === "float") {
        const range = sliderMax - sliderMin;
        // Avoid dividing by zero if range is 0
        stepSize = range !== 0 ? range / 1000 : 1;
    }

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
        setSpinnerColor("white")
        setFilterLoading(true);
        setColumnFilterQuery(newColumnFilters);
        setOpen(false);
    }
    const onReset = () => {
        const newColumnFilters = Object.fromEntries(
            Object.entries(columnFilters).filter(([key, _]) => key != column)
        );
        setSpinnerColor("primary")
        setFilterLoading(true);
        setFilters([defaultFilter])
        setColumnFilterQuery(newColumnFilters)
        setOpen(false)
    }
    const onEnter : KeyboardEventHandler = (event) => {
        if (event.key === "Enter") {
            onSubmit()
        }
    }

    /* Dialog interactions */
    const close = <BaseButton size="sm" icon={<CircleX/>} onClick={() => setOpen(false)} className="top-0 right-0 scale-60 absolute" variant="warning"/>
    const button = renderMode === "button" ? (
        <ActionButton icon={filterLoading ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> : <Filter/>} tooltip="Filter" variant={isFiltered ? "primary" : undefined} disabled={!interactive || filterLoading}/>
    ) : (
        <Filter className="h-4 w-4"/>
    )
    const reset = <ActionButton tooltip="Delete all filters" variant="warning" icon={<Trash/>} onClick={() => onReset()}/> 
    const submit = <SubmitButton text="Save" onClick={() => onSubmit()}/>
    const append = 
        <BaseDropdown context="tile" button={<ActionButton tooltip="Add new filter" icon={<Plus/>}/>}>
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
        <BaseDropdown context="tile" button={<ActionButton tooltip="Update joining method" text={filter.join === "&&" ? "and" : "or"}/>}>
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
                setFilters(newFilters)
            }}
        />
    const filterInput = (filter: NumericFilter, withSlider: boolean) => {
        const option = options.find(option => option.name === filter.mode)!;
        return (
            <div className="flex flex-row gap-2 w-full">
                <InputWithStartSelect
                    options={options}
                    option={option}
                    onOptionChange={(option) => {
                        const newFilters = [...filters]
                        newFilters.find(f => f.key === filter.key)!.mode = option.name as "==" | "!="
                        if (["exists", "isNone"].includes(option.name)) {
                            newFilters.find(f => f.key === filter.key)!.value = "true"
                        }
                        setFilters(newFilters)
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
                            <span>{formatNumber(sliderMin)}</span>
                            <span>{formatNumber(sliderMax)}</span>
                        </span>
                        <Slider
                            className="w-full"
                            value={[parseFloat(filter.value)]}
                            onValueChange={(vals) => {
                                const val = vals[0];
                                // Force it to 3 decimal places
                                const precise = parseFloat(val.toFixed(3));
                                onInput(precise.toString(), filter);
                            }}
                            min={sliderMin}
                            max={sliderMax}
                            step={stepSize}
                            aria-label="Slider with input"
                        />
                    </div>
                }
            </div>
        )}
    const remove = (filter: NumericFilter) =>
        <ActionButton
            tooltip="Remove filter"
            icon={<Minus/>}
            onClick={() => {
                let newFilters = filters.filter(f => f.key != filter.key)
                newFilters = newFilters.map((f, i) => ({key: i, mode: f.mode, join: i === 0 ? "&&" : f.join, value: f.value}))
                newFilters = newFilters.length ? newFilters : [defaultFilter]
                setFilters(newFilters)
            }}
        />
    
    const filterContent = (
        <div className="flex flex-col gap-3 px-2 pt-4 pb-2">
            {filters.map((filter, index) => 
                <div key={index} className="grid grid-cols-10 items-center">
                    {filters.length > 0 && filter.key != 0 && <div className="col-span-1">{join(filter)}</div>}
                    <div className={`${filters.length > 0 && filter.key != 0 ? "col-span-8" : "col-span-9"}`}>{filterInput(filter, !["==", "!=", "exists", "isNone"].includes(filter.mode))}</div>
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
            {/* {close} */}
        </div>
    )

    return (
        <BaseDialog
            context="tile"
            // Tie the <Dialog> open to the parent state if not "menuItem" mode
            open={renderMode === "menuItem" ? undefined : interactive && open}
            setOpen={renderMode === "menuItem" ? undefined : setOpen}
            button={renderMode === "menuItem" ? (
                // Because this is inside a parent DropdownMenuItem, 
                // we must prevent the parent from closing automatically:
                <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="
                        relative 
                        flex 
                        cursor-pointer 
                        select-none 
                        items-center 
                        gap-2 
                        rounded-sm 
                        px-2 
                        py-1.5 
                        text-sm 
                        outline-none 
                        transition-colors 
                        focus:bg-accent 
                        focus:text-accent-foreground 
                        data-[highlighted]:bg-accent 
                        data-[highlighted]:text-accent-foreground 
                        data-[disabled]:pointer-events-none 
                        data-[disabled]:opacity-50 
                        [&>svg]:size-4 
                        [&>svg]:shrink-0
                    "
                  >
                    {button}
                    <span>Filter column</span>
                  </DropdownMenuItem>
              ) : (
                  button
              )}
            body={filterContent}
            // Stop clicks from closing the parent if it’s still around
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onPointerOver={(e) => e.stopPropagation()}
            className="sm:max-w-lg"
        />
      );
}

export default NumericColumnFilter;
