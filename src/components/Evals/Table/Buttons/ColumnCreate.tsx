"use client";

import { KeyboardEventHandler, useState, useEffect } from "react";
import { Input } from "@/components/UI/input";
import SubmitButton from "@/components/Common/Buttons/Submit";
import { GroupedLogProps, LogProps, TablesArguments, getLogsParameters } from "@/types/evals/logs"
import BaseButton from "@/components/Common/Buttons/Base";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuGroup } from "@/components/UI/dropdown-menu";
import { Plus, LoaderCircle } from "lucide-react";
import { ResponseProps } from "@/types/common";
import FormulaInput from "@/components/Common/Input/Formula";

const ColumnCreate = ({ project, context, logs, currentTable, tableArguments, derive, _setTimestamp }: {
    project: string,
    context: string | undefined,
    logs: LogProps[] | GroupedLogProps[],
    currentTable: keyof TablesArguments,
    tableArguments: TablesArguments,
    derive: (project: string, context: string | undefined, key: string, equation: string, referenced_logs: {[table_name: string]: getLogsParameters}) => Promise<ResponseProps>,
    _setTimestamp: (_timestamp: string) => void
}) => {

    /* Construct autocomplete options list from table arguments and extract tables and columns from the options for regex parsing */
    const options = Object
        .entries(tableArguments)
            .map(([table, args]) => ({name: table, type: "Table Name", children: Object.keys(args.available_fields)}))  // Add all displayed tables
        .concat(Object.entries(tableArguments[currentTable as keyof TablesArguments].available_fields)                   // Add all columns of current table
            .map(([column, _]) => ({name: column, type: "Column Name", children: []}))
        )
    const tables = options.filter(option => option.type === "Table Name").map(option => option.name)
    const columns = options.filter(option => option.type === "Column Name").map(option => option.name);
    const appendRegex = new RegExp(`(?<!(${tables.join('|')})[.:])(${columns.join('|')})`, 'g'); // Replace standalone column names with current_table.column_name
    const wrapRegex = new RegExp(`(${tables.join('|')})[.:](${columns.join('|')})`, 'g');        // Wrap all instances of table_name.column_name with curly braces

    /* State tracking */
    const [open, setOpen] = useState<boolean>(false);
    const [name, setName] = useState<string>("");
    const [nameError, setNameError] = useState<string>("");
    const [expression, setExpression] = useState<string>("");
    const [equation, setEquation] = useState<string>("");
    const [errorMessage, setErrorMessage] = useState<string>("");

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    },[logs])

    /* Handle inputs */
    const handleName = (value: string) => {
        setName(value)
        if (columns.includes(value)) {
            setNameError(`${value} already used as a column name.`);
            return;
        }
        setNameError("");
    }

    const handleExpression = (value: string) => {
        setExpression(value);
        const equation = value
            .replace(appendRegex, (match, p1, p2) => `${currentTable}:${p2}`)
            .replace(wrapRegex, '{$1:$2}');
        setEquation(equation)
    }

    // Handle submission    
    const onSubmit = () => {
        let referencedTables : (keyof TablesArguments)[] = tables.filter(table => equation.includes(table))
        if (!referencedTables.length) referencedTables = [currentTable]
        const referencedArguments = Object.fromEntries(
            Object.entries(tableArguments)
                  .filter(([key, _]) => referencedTables.includes(key))
                  .map(([key, args]) => [key, args.getLogs_parameters])
        );
        derive(project, context, name, equation, referencedArguments).then(response => {
            if ("info" in response) {
                setErrorMessage("");
                setLoading(true);
                setOpen(false);
                _setTimestamp(Date.now().toString());
                return;
            } 
            let error = "Failed to create derived entries, please try again.";
            if ("detail" in response) {
                if (typeof response.detail === "string") error = response.detail;
                else error = JSON.stringify(response.detail);
            }
            setErrorMessage(error);
            setTimeout(() => setErrorMessage(""), 5000);
        })
    }
    const onEnter : KeyboardEventHandler = (e) => {
        e.stopPropagation()
        if (e.key === "Enter" && name && expression && !nameError) onSubmit()
    }

    // Subcomponents
    const column =  <Input
                        className="w-1/2 min-w-[100px]"
                        onClick={(event) => event.stopPropagation()}
                        placeholder={"Enter a column name.."}
                        value={name}
                        onInput={(event) => handleName(event.currentTarget.value)}
                        onKeyDown={onEnter}
                    />
    
    const entry = <FormulaInput options={options} value={expression} setValue={handleExpression} onEnter={onEnter}/>

    const warning = (error: string) => 
                    <p className="flex justify-start text-sm text-destructive">{error}</p>
    const submit =  <div className="flex justify-end">
                        <SubmitButton text="Apply" onClick={() => onSubmit()}/>
                    </div>

    const button = <BaseButton variant="ghost" icon={loading ? <LoaderCircle className="animate-spin text-white"/> : <Plus/>} text={loading ? "Creating column.." : "Create Column"} className={"h-4 pt-2"}/>
    return (
    <DropdownMenuGroup>
        <DropdownMenuItem className="flex flex-row justify-between">
            <BaseDropdown button={button} open={open} setOpen={setOpen}>

                    <div className="p-2 flex flex-col gap-1 h-full w-[400px]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col h-full">
                            <DropdownMenuLabel className="px-0 text-sm font-semibold">Column name</DropdownMenuLabel>
                            {column}
                            {nameError && warning(nameError)}
                        </div>

                        <div className="flex flex-col h-full">
                            <DropdownMenuLabel className="px-0 text-sm font-semibold">Derived expression</DropdownMenuLabel>
                            {entry}
                        </div>
                    </div>
                    
                    <div className="p-2 flex flex-row gap-1 justify-between">
                        {warning(errorMessage)}
                        {name && expression && !nameError && submit}
                    </div>
            
            </BaseDropdown>
        </DropdownMenuItem>
    </DropdownMenuGroup>
    );
}

export default ColumnCreate;

/* TODO: 
    
    - Add button to refresh the values
    - Add grouping when server side grouping is supported
    - Add option to edit the equation
    
    - Prevent issue of unintentional text selection
    - Add dropdown options for: 
        (See https://github.com/unifyai/orchestra/blob/main/orchestra/web/api/log/helpers.py#L151 for source)
        functions: 
            r"(?<!\w)(?:len|type|exists|version|str(?=\()|to_str)"
            ["len", "type", "exists", "version", "str", "to_str"]
        operators: 
            r"==|!=|<=|>=|<|>|(?<!\w)(?:not in|is not|in|not|and|or|is)(?!\w)|\*\*|//|\+|\-|\*|/|%"
            ["!=", "<=", ">=", ">", "<", "not in", "is not", "in", "not", "and", "or", "is", "//", "**", "+", "-", "/", "%"]
*/