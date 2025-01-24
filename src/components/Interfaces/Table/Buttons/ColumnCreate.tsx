"use client";

import { KeyboardEventHandler, useState } from "react";
import { Input } from "@/components/UI/input";
import SubmitButton from "@/components/Common/Buttons/Submit";
import { TableArguments, LogFieldsResponseProps } from "@/types/evals/logs"
import BaseButton from "@/components/Common/Buttons/Base";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuGroup } from "@/components/UI/dropdown-menu";
import { Plus } from "lucide-react";
import { ResponseProps } from "@/types/common";

const ColumnCreate = ({ project, currentTable, tableArguments, fields, derive, refresh }: {
    project: string,
    currentTable: string,
    tableArguments: {[table_name:string]: {[table_argument: string]: string}},
    fields: LogFieldsResponseProps,
    derive: (project: string, key: string, equation: string, referenced_logs: TableArguments) => Promise<ResponseProps>,
    refresh: Promise<void>
}) => {

    const tables = Object.keys(tableArguments)
    const columns = Object.keys(fields);
    const appendRegex = new RegExp(`(?<!(${tables.join('|')})\\:)(${columns.join('|')})`, 'g'); // Replace standalone column names with current_table.column_name
    const wrapRegex = new RegExp(`(${tables.join('|')})\\:(${columns.join('|')})`, 'g');        // Wrap all instances of table_name.column_name with curly braces

    // State tracking
    const [open, setOpen] = useState<boolean>(false);
    const [name, setName] = useState<string>("");
    const [nameError, setNameError] = useState<string>("");
    const [expression, setExpression] = useState<string>("");
    const [equation, setEquation] = useState<string>("");
    const [errorMessage, setErrorMessage] = useState<string>("");

    // Handle inputs
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
        let referencedTables = tables.filter(table => equation.includes(table))
        if (!referencedTables.length) referencedTables = [currentTable]
        const referencedArguments = Object.fromEntries(
            Object.entries(tableArguments).filter(([key, _]) => referencedTables.includes(key))
        );
        derive(project, name, equation, referencedArguments).then(response => {
            if ("info" in response) {
                setErrorMessage("");
                setOpen(false);
                refresh.then(() => {
                    return;
                });
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
                        className="w-1/2"
                        onClick={(event) => event.stopPropagation()}
                        placeholder={"Enter a column name.."}
                        value={name}
                        onInput={(event) => handleName(event.currentTarget.value)}
                        onKeyDown={onEnter}
                    />
    const entry =   <Input
                        className="w-full"
                        onClick={(event) => event.stopPropagation()}
                        placeholder={"Enter an expression.."}
                        value={expression}
                        disabled={!name || nameError != ""}
                        onInput={(event) => handleExpression(event.currentTarget.value)}
                        onKeyDown={onEnter}
                    />
    const warning = (error: string) => 
                    <p className="flex justify-start text-sm text-destructive">{error}</p>
    const submit =  <div className="flex justify-end">
                        <SubmitButton text="Apply" onClick={() => onSubmit()}/>
                    </div>

    const button = <BaseButton variant="ghost" icon={<Plus/>} text={"Create Column"} className={"h-4 pt-2"}/>
    return (
    <DropdownMenuGroup>
        <DropdownMenuItem className="flex flex-row justify-between">
            <BaseDropdown button={button} open={open} setOpen={setOpen}>
                <div className="p-2 flex flex-col gap-3 ">

                    <div className="flex flex-col gap-1 max-h-[500px] overflow-y-auto">
                        <div className="flex flex-col">
                            <DropdownMenuLabel className="text-sm font-semibold">Column name</DropdownMenuLabel>
                            {column}
                            {nameError && warning(nameError)}
                        </div>

                        <div className="flex flex-col">
                            <DropdownMenuLabel className="text-sm font-semibold">Derived expression</DropdownMenuLabel>
                            <DropdownMenuLabel className="text-sm font-normal">
                                <p>Enter a mathematical expression to evaluate. You can use any entry column name as variable.</p>
                            </DropdownMenuLabel>
                            {entry}
                        </div>

                    </div>
                    
                    <div className="flex flex-row gap-1 justify-between">
                        {warning(errorMessage)}
                        {name && expression && !nameError && submit}
                    </div>

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
*/