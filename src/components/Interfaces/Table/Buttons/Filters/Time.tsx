"use client";

import { useState, useRef, useEffect } from "react";
import { Filters, FiltersByColumn } from "@/types/evals/columns";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import SubmitButton from "@/components/Common/Buttons/Submit";
import BaseButton from "@/components/Common/Buttons/Base";
import { Filter } from "lucide-react";
import InputWithStartSelect from "@/components/Common/Input/StartSelect";
import { KeyboardEventHandler } from "react";
import { initFilters, combineFilters, defaultRelativeDate, defaultAbsoluteDate, initDefaultDate } from "@/utils/evals/filters";
import { Trash, Plus, CircleX, Clock, History, LoaderCircle } from "lucide-react";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { DateTimeInput } from "@/components/Common/Time/DateTimeInput";
import { AbsoluteDateString, RelativeDateString } from "@/types/evals/filters";
import { LogProps } from "@/types/evals/logs";

interface TimeFilter {
    key: number,
    mode: ">" | "<",
    join: "&&" | "||",
    value: string
}

const TimeColumnFilter = ({ interactive, column, columnFilters, setColumnFilterQuery, logs }: {
    interactive: boolean,
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void,
    logs: LogProps[]
}) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    const [spinnerColor, setSpinnerColor] = useState("white");
    useEffect(() => {
        setLoading(false);
    },[logs])

    /* Initialize filters */
    const options = [
        {name: ">",  label: ">"  , description: "Filter for values greater than.."},
        {name: "<",  label: "<"  , description: "Filter for values less than.."}
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
        setColumnFilterQuery(newColumnFilters);
        setSpinnerColor("white")
        setLoading(true)
        setOpen(false);
    }
    const onReset = () => {
        const newColumnFilters = Object.fromEntries(
            Object.entries(columnFilters).filter(([key, _]) => key != column)
        );
        setFilters([defaultFilter])
        setColumnFilterQuery(newColumnFilters)
        setSpinnerColor("primary")
        setLoading(true)
        setOpen(false)
    }
    const onEnter : KeyboardEventHandler = (event) => {
        if (event.key === "Enter") {
            onSubmit()
        }
    }

    /* Dialog interactions */
    const [open, setOpen] = useState(false);
    const close = <BaseButton size="sm" icon={<CircleX/>} onClick={() => setOpen(false)} className="top-0 right-0 scale-60 absolute" variant="warning"/>
    const button = <ActionButton icon={loading ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> : <Filter/>} tooltip="Filter" variant={column in columnFilters ? "primary" : undefined} disabled={!interactive || loading}/>
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
                }}
            >
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
            </InputWithStartSelect>
        )}
    const remove = (filter: TimeFilter) =>
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
                        <div className={`${filters.length > 0 && filter.key != 0 ? "col-span-6" : "col-span-7"}`}>{filterInput(filter)}</div>
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
                {close}
            </div>
        </BaseDropdown>
    );
}

export default TimeColumnFilter;