"use client";

import { KeyboardEventHandler, useState, useEffect, Dispatch, SetStateAction } from "react";
import { Filters, FiltersByColumn } from "@/types/evals/columns";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import BaseButton from "@/components/Common/Buttons/Base";
import SubmitButton from "@/components/Common/Buttons/Submit";
import { Filter, Plus, Minus, Trash, CircleX, LoaderCircle, ChevronRightIcon } from "lucide-react";
import InputWithStartSelect from "@/components/Common/Input/StartSelect";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { combineFilters, initFilters } from "@/utils/evals/filters";
import { GroupedLogProps, LogProps } from "@/types/evals/logs";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/UI/dialog";
import { sanitizeId } from "@/utils/evals/columnOperations";
import { SelectValue, SelectTrigger, SelectLabel, SelectContent, SelectItem, SelectGroup } from "@/components/UI/select";
import { Select } from "@/components/UI/select";

interface BooleanFilter {
    key: number,
    mode: "is" | "exists" | "isNone",
    join: "&&" | "||",
    value: string
}

const toLowerBoolean = (value: string): string => {
    return value.trim().toLowerCase();
}

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
    }, [isFiltered])

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
    const button = renderMode === "button" ? (
        <ActionButton icon={filterLoading ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> : <Filter/>} tooltip="Filter" variant={column in columnFilters ? "primary" : undefined} disabled={!interactive || filterLoading} />
    ) : (
        <Filter className="h-4 w-4"/>
    )
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
    const valueInput = (
        filter: BooleanFilter,
        option: { name: string; label: string; description: string }
    ) => {
        // We'll store the field's local 'value' in state, or rely on `filter.value`.
        // But to keep minimal changes, we can just read from `filter.value` directly
        // and update filters with onValueChange.
        return (
            <Select
                value={toLowerBoolean(filter.value)} // either "true" or "false"
                onValueChange={(val) => {
                    onInput(val, filter)
                }}
            >
                <SelectTrigger className="w-full" onKeyDown={onEnter}>
                    <SelectValue placeholder={option.description} />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel>Boolean</SelectLabel>
                        <SelectItem className="cursor-pointer" value="true">true</SelectItem>
                        <SelectItem className="cursor-pointer" value="false">false</SelectItem>
                    </SelectGroup>
                </SelectContent>
            </Select>
        )
    };
    const toggleInput = (filter: BooleanFilter) =>     
        <BaseButton 
            text={filter.value === "True" ? "true" : filter.value === "False" ? "false" : filter.value} 
            variant="outline" 
            className="rounded-none rounded-tr-lg rounded-br-lg w-full"
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
                }}
            >
                {["exists", "isNone", "is"].includes(option.name)
                    ? toggleInput(filter)
                    : valueInput(filter, option)
                }
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
        <Dialog
          // Tie the <Dialog> open to the parent state if not "menuItem" mode
          open={renderMode === "menuItem" ? undefined : interactive && open}
          onOpenChange={renderMode === "menuItem" ? undefined : setOpen}
        >
          <DialogTrigger asChild>
            {renderMode === "menuItem" ? (
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
          </DialogTrigger>
    
          <DialogContent
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onPointerOver={(e) => e.stopPropagation()}
            className="sm:max-w-lg"
          >

            {/* The main filter UI */}
            {filterContent}

            {/* 
            If you wanted a separate <DialogFooter>, you could do:
            <DialogFooter>
              <div className="flex flex-row gap-2 justify-end">
                {reset}
                {submit}
              </div>
            </DialogFooter>
            */}
          </DialogContent>
        </Dialog>
      );
}

export default BooleanColumnFilter;