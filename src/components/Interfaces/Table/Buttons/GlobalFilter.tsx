"use client";

import { useState, useEffect, FormEvent, KeyboardEvent } from "react";

import { GroupedLogProps, LogProps } from "@/types/evals/logs";
import { TableArguments } from "@/types/evals/logs";

import ActionButton from "@/components/Common/Buttons/Action";
import FormulaInput from "@/components/Common/Input/Formula";
import { Input } from "@/components/UI/input";

import { FilterX, X, LoaderCircle, Search } from "lucide-react";
import { TbMathFunction } from "react-icons/tb";

const GlobalFilter = ({ interactive, commonFilter, setCommonFilter, logs, setLogsFilters, currentTable, tableArguments }: {
    interactive: boolean,
    logsFilters: string | undefined,
    setLogsFilters: (logsFilters: { [key: string]: { [key: string]: string } }) => void,
    commonFilter: string | undefined,
    setCommonFilter: (newValue: string | undefined) => void,
    logs: LogProps[] | GroupedLogProps[],
    currentTable: string,
    tableArguments: TableArguments,
}) => {

    /* Display loader when data updates */
    const [loadingReset, setLoadingReset] = useState(false);
    const [loadingInput, setLoadingInput] = useState(false);
    useEffect(() => {
        setLoadingInput(false);
        setLoadingReset(false);
    },[logs])

    /* Handle filter states */
    const initialMode = commonFilter ? commonFilter.split("§")[0] : "search"
    const initialValue = commonFilter ? commonFilter.split("§")[1] : ""
    const initialFilter = {mode: initialMode, value: initialValue}
    const [globalFilter, setGlobalFilter] = useState(initialFilter);
    const mode = globalFilter.mode
    const value = globalFilter.value

    /* Mode toggler */
    const modeIcon = loadingInput ? <LoaderCircle className="animate-spin text-primary"/> : mode === "search" ? <Search/> : <TbMathFunction/>
    const modeTooltip = loadingInput ? "Filtering logs.." : mode === "search" ? "Toggle function mode" : "Toggle search mode"
    const onModeClick = () => setGlobalFilter((filter) => {
        const newMode = filter.mode === "search" ? "expression" : "search"
        return {mode: newMode, value: filter.value}
    })
    const modeDisabled = !interactive || loadingInput
    const modeClassName = "rounded-none rounded-tl-md rounded-bl-md border p-2 h-8 w-8"
    const modeButton = <ActionButton icon={modeIcon} tooltip={modeTooltip} onClick={onModeClick} disabled={modeDisabled} className={modeClassName}/>

    /* Expression input */
    const options = Object
        .entries(tableArguments)
            .map(([table, args]) => ({name: table, type: "Table Name", children: Object.keys(args.available_fields)}))  // Add all displayed tables
        .concat(Object.entries(tableArguments[currentTable as keyof TableArguments].available_fields)                   // Add all columns of current table
            .map(([column, _]) => ({name: column, type: "Column Name", children: []}))
        )
    const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            setCommonFilter(`${mode}§${value}`)
            setLoadingInput(true);
        }}
    const setExpression = (value: string) => setGlobalFilter((filter) => ({mode: filter.mode, value: value}))
    const expressionClassName = "left-0 top-0.5 w-[100%]"
    const expressionPlaceholder = "Filter with an expression.."
    const expressionInput = <FormulaInput options={options} value={value} setValue={setExpression} onEnter={onEnter} withIcon={false} withAutocomplete={false} className={expressionClassName} placeholder={expressionPlaceholder}/>

    /* Filter input */
    const placeholder = loadingInput ? "Filtering logs.." : "Filter columns by character.."
    const onInput = (input: FormEvent<HTMLInputElement>) => {
        setGlobalFilter((filter) => ({mode: filter.mode, value: input.currentTarget?.value}))
    } 
    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            setCommonFilter(`${mode}§${value}`)
            setLoadingInput(true);
        }}
    const filterDisabled = !interactive || loadingInput
    const filterClassName = "rounded-none rounded-tr-md rounded-br-md p-2 h-8"
    const filterInput = <Input placeholder={placeholder} value={value} onInput={onInput} onKeyDown={onKeyDown} disabled={filterDisabled} className={filterClassName}/>
    
    /* Close button */
    const onCloseClick = () => {
        setCommonFilter(undefined);
        setLoadingInput(true);
        setLoadingReset(true);
    }
    const closeIcon = <X size={15} onClick={onCloseClick} className="cursor-pointer" /> 
    const closeClassName = `absolute z-10 right-2 ${mode === "expression" ? "top-[10px]" : "top-[8px]"}`
    const closeButton = commonFilter?.length && <div className={closeClassName}>{closeIcon}</div> 
    
    /* Filter reset button */
    const resetIcon = loadingReset ? <LoaderCircle className="animate-spin text-primary"/> : <FilterX/>
    const resetTooltip = "Reset All Filters"
    const resetVariant = "warning_outline" 
    const onClick = () => {
        setLogsFilters({});
        setCommonFilter(undefined);
        setLoadingReset(true);
    }
    const resetDisabled = !interactive || loadingReset 
    const resetButton = <ActionButton icon={resetIcon} tooltip={resetTooltip} variant={resetVariant} onClick={onClick} disabled={resetDisabled}/>
    
    return (
        <div className="flex flex-row items-center">
            {modeButton}
            <div className="relative min-w-[200px]">
                {mode === "search" ? filterInput : expressionInput}
                {closeButton}
            </div>
            <div className="ml-2">
                {resetButton}
            </div>
        </div>
    );
}

export default GlobalFilter;
