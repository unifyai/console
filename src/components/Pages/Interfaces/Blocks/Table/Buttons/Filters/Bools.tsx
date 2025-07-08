"use client";

import { KeyboardEventHandler, useState, useEffect, Dispatch, SetStateAction } from "react";
import { Filters, FiltersByColumn } from "@/types/interfaces/columns";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import BaseButton from "@/components/Common/Buttons/Base";
import SubmitButton from "@/components/Common/Buttons/Submit";
import { Filter, Plus, Minus, Trash, CircleX, LoaderCircle, ChevronRightIcon, X } from "lucide-react";
import InputWithStartSelect from "@/components/Common/Input/StartSelect";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { combineFilters, initFilters } from "@/utils/interfaces/table/filters";
import { GroupedLogProps, LogProps } from "@/types/interfaces/logs";
import BaseDialog from "@/components/Common/Dialogs/Base";
import { sanitizeId } from "@/utils/interfaces/table/columnOperations";
import { SelectValue, SelectTrigger, SelectLabel, SelectContent, SelectItem, SelectGroup } from "@/components/UI/select";
import { Select } from "@/components/UI/select";

interface BooleanFilter {
    key: number,
    mode: "is" | "exists" | "isNone",
    join: "&&" | "||",
    value: string
}

const capitalizeFirstLetter = (value: string): string => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return '';
    return trimmedValue.charAt(0).toUpperCase() + trimmedValue.slice(1);
  };

const BooleanColumnFilter = ({ interactive, column, columnFilters, setColumnFilterQuery, open, setOpen, filterLoading, setFilterLoading, setIsFiltered, renderMode }: {
    interactive: boolean,
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void,
    open: boolean,
    setOpen: Dispatch<SetStateAction<boolean>>,
    filterLoading: boolean,
    setFilterLoading: (filterLoading: boolean) => void,
    setIsFiltered: (isFiltered: boolean) => void,
    renderMode: "button" | "menuItem"
}) => {

    /* Display loader when data updates */
    const [spinnerColor, setSpinnerColor] = useState("white");

    /* Init filters */
    const options = [
        {name: "is", label: "Is", description: `Filter for ${column} values equal to..`},
        {name: "exists", label: "Exists" , description: `Filter for ${column} existing values..`},
        {name: "isNone", label: "Is None" , description: `Filter for ${column} none values..`}
    ]
    const modes = options.map(option => option.name)
    let defaultFilter : BooleanFilter = {key: 0, mode: "is", join: "&&", value: "true"}
    let initialValues : BooleanFilter[] = [];
    if (columnFilters[column]) {
        initFilters(column, columnFilters, initialValues, modes)
    } else {
        initialValues.push(defaultFilter)
    }
    const [filters, setFilters] = useState(initialValues);
    const isFiltered = column in columnFilters;

    useEffect(() => {
        setIsFiltered(isFiltered);
    }, [isFiltered, setIsFiltered])

    /* Event handlers */
    const onInput = (input: string, filter: BooleanFilter) => {
        const newFilters = [...filters]
        newFilters.find(f => f.key === filter.key)!.value = input
        setFilters(newFilters)
    }
    const onSubmit = () => {
        let newColumnFilters = { ...columnFilters }
        if (filters.length){
            const newFilters = filters.map(f => ({
                key: f.key, 
                mode: f.mode, 
                join: f.join, 
                value: f.value === "true" ? "True" : f.value === "false" ? "False" : f.value
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
        setFilterLoading(true)
        setColumnFilterQuery(newColumnFilters);
        setOpen(false);
    }
    const onReset = () => {
        const newColumnFilters = Object.fromEntries(
            Object.entries(columnFilters).filter(([key, _]) => key != column)
        )
        setSpinnerColor("primary")
        setFilterLoading(true)
        setFilters([defaultFilter])
        setColumnFilterQuery(newColumnFilters)
        setOpen(false)
    }
    const onEnter : KeyboardEventHandler = (event) => {
        if (event.key === "Enter") {
            onSubmit()
        }
    }

    // Dialog interactions
    const close = <BaseButton size="sm" icon={<CircleX/>} onClick={() => setOpen(false)} className="top-0 right-0 scale-60 absolute" variant="warning"/>
    const baseBtn = <ActionButton icon={filterLoading ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> : <Filter/>} tooltip="Filter" variant={column in columnFilters ? "primary" : undefined} disabled={!interactive || filterLoading} />
    const button = renderMode === "button" ? (
        <div className="relative inline-flex group">
            {baseBtn}
            {isFiltered && (
                <button type="button" onPointerDown={(e)=>e.stopPropagation()} onPointerUp={(e)=>e.stopPropagation()} onClick={(e)=>{e.stopPropagation(); onReset();}} className="absolute -top-1 -right-1 h-3 w-3 flex items-center justify-center rounded-full bg-gray-400 text-white opacity-0 group-hover:opacity-100 hover:bg-gray-500 transition-opacity">
                    <X className="h-2 w-2" />
                </button>
            )}
        </div>
    ) : (
        <Filter className="h-4 w-4" />
    )
    const reset = <ActionButton tooltip="Delete all filters" variant="warning" icon={<Trash/>} onClick={() => onReset()}/> 
    const submit = <SubmitButton text="Apply" onClick={() => onSubmit()}/>
    const append = 
        <BaseDropdown context="tile" button={<ActionButton tooltip="Add new filter" icon={<Plus/>}/>}>
            {["And", "Or"].map((method, index) => 
                <DropdownMenuItem 
                    key={index}
                    className="p-2 hover:text-white hover:bg-primary cursor-pointer" 
                    onClick={() => {
                        const newFilters = [...filters]
                        newFilters.push({key: filters.length, mode: "is", join: method === "And" ? "&&" : "||", value: ""})
                        setFilters(newFilters)
                    }}            
                >
                    {method.toLowerCase()}
                </DropdownMenuItem>
            )}
        </BaseDropdown>

    // Filter row
    const join = (filter: BooleanFilter) => 
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
    const toggleInput = (filter: BooleanFilter) =>     
        <BaseButton 
            text={capitalizeFirstLetter(filter.value)} 
            variant="outline" 
            className="rounded-none rounded-tr-lg rounded-br-lg w-full font-normal text-sm"
            onKeyDown={onEnter}
            onClick={() => {
                const newFilters = [...filters]
                newFilters.find(f => f.key === filter.key)!.value === "true" 
                    ? newFilters.find(f => f.key === filter.key)!.value = "false"
                    : newFilters.find(f => f.key === filter.key)!.value = "true"
                setFilters(newFilters)
            }}
        />
    const filterInput = (filter: BooleanFilter) => {
        const option = options.find(option => option.name === filter.mode)!;
        return (
            <InputWithStartSelect
                options={options}
                option={option}
                onOptionChange={(option) => {
                    const newFilters = [...filters]
                    newFilters.find(f => f.key === filter.key)!.mode = option.name as "is"
                    if (["exists", "isNone", "is"].includes(option.name)) {
                        newFilters.find(f => f.key === filter.key)!.value = "true"
                    }
                    setFilters(newFilters)
                }}
            >
                {toggleInput(filter)}
            </InputWithStartSelect>
        )
    }
    const remove = (filter: BooleanFilter) =>
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
                    <div className={`${filters.length > 0 && filter.key != 0 ? "col-span-8" : "col-span-9"}`}>{filterInput(filter)}</div>
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
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onPointerOver={(e) => e.stopPropagation()}
            className="sm:max-w-lg"
        />
      );
}

export default BooleanColumnFilter;