"use client";

import { useState, useRef, useEffect, Dispatch, SetStateAction } from "react";
import { Filters, FiltersByColumn } from "@/types/evals/columns";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import SubmitButton from "@/components/Common/Buttons/Submit";
import BaseButton from "@/components/Common/Buttons/Base";
import { Filter } from "lucide-react";
import InputWithStartSelect from "@/components/Common/Input/StartSelect";
import { KeyboardEventHandler } from "react";
import { initFilters, combineFilters, defaultRelativeDate, defaultAbsoluteDate, initDefaultDate } from "@/utils/evals/filters";
import { Trash, Plus, Minus, CircleX, Clock, History, LoaderCircle } from "lucide-react";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { DateTimeInput } from "@/components/Common/Time/DateTimeInput";
import { AbsoluteDateString, RelativeDateString } from "@/types/evals/filters";
import { GroupedLogProps, LogProps } from "@/types/evals/logs";
import { Dialog, DialogDescription, DialogHeader, DialogTitle, DialogContent, DialogTrigger } from "@/components/UI/dialog";
import { sanitizeId } from "@/utils/evals/columnOperations";

interface TimeFilter {
    key: number,
    mode: ">" | "<" | "exists" | "isNone",
    join: "&&" | "||",
    value: string
}

const TimeColumnFilter = ({ interactive, column, columnFilters, setColumnFilterQuery, logs, open, setOpen, filterLoading, setFilterLoading, setIsFiltered, renderMode }: {
    interactive: boolean,
    column: string,
    columnFilters: FiltersByColumn,
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void,
    logs: LogProps[] | GroupedLogProps[],
    open: boolean,
    setOpen: Dispatch<SetStateAction<boolean>>,
    filterLoading: boolean,
    setFilterLoading: (filterLoading: boolean) => void,
    setIsFiltered: (isFiltered: boolean) => void,
    renderMode: "button" | "menuItem"
}) => {

    /* Display loader when data updates */
    const [spinnerColor, setSpinnerColor] = useState("white");
    useEffect(() => {
        setFilterLoading(false);
    },[logs])

    /* Initialize filters */
    const options = [
        {name: ">",  label: ">"  , description: `Filter for ${column} values greater than..`},
        {name: "<",  label: "<"  , description: `Filter for ${column} values less than..`},
        {name: "exists", label: "exists" , description: `Filter for ${column} existing values..`},
        {name: "isNone", label: "isNone" , description: `Filter for ${column} none values..`}
    ]
    const modes = options.map(option => option.name)
    let defaultFilter : TimeFilter = {key: 0, mode: ">", join: "&&", value: defaultRelativeDate}
    let initialValues : TimeFilter[] = []
    if (columnFilters[column]) {
        initFilters(column, columnFilters, initialValues, modes)
    }
    else {
        initialValues.push(defaultFilter)
    }
    initialValues = initialValues.map(initial => ({
        key: initial.key, 
        mode: initial.mode, 
        join: initial.join, 
        value: initial.value
    }))
    const [filters, setFilters] = useState(initialValues);
    const isFiltered = column in columnFilters;
    useEffect(() => {
        setIsFiltered(isFiltered);
    }, [isFiltered])

    /* Event handlers */
    const onInput = (value: AbsoluteDateString | RelativeDateString, filter: TimeFilter) => {
        const newFilters = [...filters]
        newFilters.find(f => f.key === filter.key)!.value = value
        setFilters(newFilters)
    }
    const onSubmit = () => {
        let newColumnFilters = { ...columnFilters }
        if (filters.length){
            const newFilters = filters.map(f => {
                let newValue = f.value ? f.value : relative ? defaultRelativeDate : defaultAbsoluteDate
                if (newValue.includes(";")) {
                    newValue = newValue
                        .substring(0, newValue.indexOf("ms") + 2)                  // Clean-up relative date strings (remove characters after ms)
                        .substring(newValue.search(/\d/))                          //                                (remove characters ebfore first number)
                }
                else {
                    newValue = newValue.replace("T", " ").replace("Z", "")         // Clean-up absolute date strings
                }
                newValue = `"${newValue}"`                                         // Wrap date string in quotes
                return {
                        key: f.key, 
                        mode: f.mode, 
                        join: f.join, 
                        value: newValue
                    }
            })
            let filter : Filters = combineFilters(newFilters, modes)
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
        );
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
        <BaseDropdown button={<ActionButton tooltip="Add new filter" icon={<Plus/>}/>}>
            {["And", "Or"].map((method, index) => 
                <DropdownMenuItem 
                    key={index}
                    className="p-2 hover:text-white hover:bg-primary cursor-pointer" 
                    onClick={() => {
                        const newFilters = [...filters]
                        newFilters.push({key: filters.length, mode: ">", join: method === "And" ? "&&" : "||", value: ""})
                        setFilters(newFilters)
                    }}            
                >
                    {method.toLowerCase()}
                </DropdownMenuItem>
            )}
        </BaseDropdown>
    const [relative, setRelative] = useState(
        initialValues.map(initial => initial.value).every(value => value.includes(";"))
    );
    const onRebase = () => {
        const value = relative ? defaultAbsoluteDate as AbsoluteDateString : defaultRelativeDate as RelativeDateString
        const filter : TimeFilter = {key: 0, mode: ">", join: "&&", value: value}
        setFilters([filter])
        setRelative(!relative)
    }
    const basis = <ActionButton 
        tooltip={relative ? "Set absolute time" : "Set relative time"} 
        icon={relative ? <History/> : <Clock/>} 
        onClick={onRebase}
    />

    /* Filter row */
    const join = (filter: TimeFilter) => 
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
    const times = [
        {name: "year", className: "w-[72px] border-r-0"},
        {name: "month", className: "border-l-0 border-r-0"},
        {name: "day", className: "border-l-0 border-r-0"},
        {name: "hours", className: "border-l-0 border-r-0"},
        {name: "minutes", className: "border-l-0 border-r-0"},
        {name: "seconds", className: "border-l-0 border-r-0"},
        {name: "milliseconds", className: "w-[68px] border-l-0 rounded-tr-md rounded-br-md"},
    ]
    const filterRefs = useRef<Record<string, Record<string, HTMLInputElement | null>>>({});
    const valueInput = (filter: TimeFilter, refs: Record<string, HTMLInputElement | null>) => 
        <div className="flex flex-row">
            {times.map((time, index) => {
                const picker = time.name as ("year" | "month" | "day" | "hours" | "minutes" | "seconds" | "milliseconds")
                const date = initDefaultDate(filter.value, relative)
                const setDate = (date: AbsoluteDateString | RelativeDateString) => onInput(date, filter)
                const ref = (element:HTMLInputElement | null) => {
                    refs[time.name] = element
                }
                const prevIndex = index > 0 ? index - 1 : -1;
                const nextIndex = index < times.length - 1 ? index + 1 : -1;
                const onLeftFocus = () => {
                    if (prevIndex !== -1) {
                        refs[times[prevIndex].name]?.focus();
                    }
                };
                const onRightFocus = () => {
                    if (nextIndex !== -1) {
                        refs[times[nextIndex].name]?.focus();
                    }
                };
                const className = time.className
                return (
                    <DateTimeInput
                        key={index}
                        picker={picker}
                        date={date}
                        setDate={setDate}
                        ref={ref}
                        onLeftFocus={onLeftFocus}
                        onRightFocus={onRightFocus}
                        relative={relative}
                        className={className}
                        onEnter={onEnter}
                    />
                )
            })}
        </div>
    const toggleInput = (filter: TimeFilter) =>     
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
    const filterInput = (filter: TimeFilter) => {
        if (!filterRefs.current[filter.key]) {
            filterRefs.current[filter.key] = {};
        }
        const refs = filterRefs.current[filter.key];
        const option = options.find(option => option.name === filter.mode)!;
        return (
            <InputWithStartSelect
                options={options}
                option={option}
                onOptionChange={(option) => {
                    const newFilters = [...filters]
                    newFilters.find(f => f.key === filter.key)!.mode = option.name as ">" | "<"
                    if (["exists", "isNone"].includes(option.name)) {
                        newFilters.find(f => f.key === filter.key)!.value = "true"
                    }
                }}
            >
                {["exists", "isNone"].includes(option.name) ? toggleInput(filter) : valueInput(filter, refs)}
            </InputWithStartSelect>
        )}
    const remove = (filter: TimeFilter) =>
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
                <div className="flex flex-row justify-start">
                    {append}
                    {basis}
                </div>
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
          // Tie <Dialog> open to parent state if not "menuItem" mode
          open={renderMode === "menuItem" ? undefined : interactive && open}
          onOpenChange={renderMode === "menuItem" ? undefined : setOpen}
        >
          <DialogTrigger asChild>
            {renderMode === "menuItem" ? (
              // Render a styled <DropdownMenuItem> so the parent doesn't close
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
                <span>Filter by this column</span>
              </DropdownMenuItem>
            ) : (
              button
            )}
          </DialogTrigger>
    
          <DialogContent
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onPointerOver={(e) => e.stopPropagation()}
            className="sm:max-w-2xl"
          >    
            {filterContent}
          </DialogContent>
        </Dialog>
    );
}

export default TimeColumnFilter;