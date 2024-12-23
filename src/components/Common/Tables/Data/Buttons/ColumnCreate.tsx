"use client";

import { useState } from "react";
import * as math from "mathjs";
import { Table, Header } from "@tanstack/react-table";
import { Input } from "@/components/UI/input";
import SubmitButton from "@/components/Common/Buttons/Submit";
import { DropdownMenuLabel } from "@radix-ui/react-dropdown-menu";
import { BaseTable } from "../../Base";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/UI/collapsible";

const ColumnCreate = ({ table, header }: {
    table: Table<any | unknown>,
    header: Header<any, unknown>
}) => {

    const originals = table.getRowModel().rows.map((row) => row.original)
    const columns = table.getAllLeafColumns().map((column) => column.id);

    // State tracking
    const [name, setName] = useState<string>("");
    const [nameError, setNameError] = useState<string>("");
    const [expression, setExpression] = useState<string>("");
    const [expressionError, setExpressionError] = useState<string>("");
    const [previewValues, setPreviewValues] = useState<{[key: string]: any}[]>();

    // Handle inputs
    const handleName = (value: string) => {
        if (columns.includes(value)) {
            setNameError(`${value} already used as a column name.`);
            return;
        }
        setNameError("");
    }

    const handleExpression = (value: string) => {
        try {
            const results = originals
                .map((original) => {
                    const variables = Object.fromEntries(columns.map(column => [column, original.entries[column]])) // Hardcoded entries for now
                    const operation = math.evaluate(value, variables)
                    return operation
                })

            // Exclude support of all but numbers and strings
            if (results.some(result => !["number", "string", "undefined"].includes(typeof result) )) {
                setPreviewValues(undefined)
                setExpressionError(`Invalid input`)
                return;                
            }

            // Handle empty input
            if (results.every(result => result === undefined)){
                setPreviewValues(undefined)
                setExpressionError("")
                return;
            }

            // Otherwise display results for preview
            setPreviewValues(
                results.map((result, index) => ({"n°":index + 1, [name]: result}))
            )
            setExpressionError("")
        
        } catch (e: any) {
            setPreviewValues(undefined)
            setExpressionError(`Invalid input: ${e.message}`)
        }
    }

    // Subcomponents
    const column =  <Input
                        className="w-1/2"
                        onClick={(event) => event.stopPropagation()}
                        placeholder={"Enter a column name.."}
                        value={name}
                        onInput={(event) => {
                            const value = event.currentTarget.value
                            setName(value);
                            handleName(value)
                        }}
                        onKeyDown={(e) => {
                            e.stopPropagation()
                            // if (e.key === "Enter")
                            //     onSubmit();
                        }}
                    />
    const entry =   <Input
                        className="w-full"
                        onClick={(event) => event.stopPropagation()}
                        placeholder={"Enter an expression.."}
                        value={expression}
                        disabled={!name || nameError != ""}
                        onInput={(event) => {
                            const value = event.currentTarget.value
                            if (value === "" || expression === "") setPreviewValues(undefined)
                            setExpression(value);
                            handleExpression(value)
                        }}
                        onKeyDown={(e) => {
                            e.stopPropagation()
                            // if (e.key === "Enter")
                            //     onSubmit();
                        }}
                    />
    const warning = (error: string) => 
                    <p className="text-sm text-destructive">{error}</p>

    const preview =     <div className="max-h-[200px] max-w-[600px] overflow-auto">
                            <BaseTable items={previewValues as {[key: string]: any}[]}/>
                        </div>
    const submit =  <div className="flex justify-end">
                        <SubmitButton text="Apply"/>
                    </div>

    const hints =   <Collapsible>
                        <CollapsibleTrigger 
                            onClick={(event) => event.stopPropagation()}
                            className="text-gray-500 underline"
                        >
                            Click to view examples of common supported operations
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="text-gray-500 grid grid-cols-2">
                                
                                <p>Length of a column value</p>
                                <span className="flex flex-row ">
                                    <p className="font-semibold">count(</p>
                                    <p>column_name</p>
                                    <p className="font-semibold">)</p>
                                </span>

                                <p>Rounded decimal value</p>
                                <span className="flex flex-row ">
                                    <p className="font-semibold">round(</p>
                                    <p>column_name, </p>
                                    <p className="font-semibold">number_of_decimals)</p>
                                </span>
                                
                                <p>Value extracted from a dictionary</p>
                                <span className="flex flex-row ">
                                    <p>dict_column</p>
                                    <p className="font-semibold">.extracted_column</p>
                                </span>

                                <p>Element extracted from a list</p>
                                <span className="flex flex-row ">
                                    <p>list_column</p>
                                    <p className="font-semibold">[index_of_extracted]</p>

                                </span>

                            </div>
                        </CollapsibleContent>
                    </Collapsible>
    return (
    <div className="p-2 flex flex-col gap-3 ">

        <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto">
            <DropdownMenuLabel className="text-sm">Create a new derived column from any entry column.</DropdownMenuLabel>
            <div className="flex flex-col gap-1">
                <DropdownMenuLabel className="text-sm font-semibold">Column name</DropdownMenuLabel>
                {column}
                {nameError && warning(nameError)}
            </div>

            <div className="flex flex-col gap-1">
                <DropdownMenuLabel className="text-sm font-semibold">Derived expression</DropdownMenuLabel>
                <DropdownMenuLabel className="text-sm">
                    <p>Enter a mathematical expression to evaluate. You can use any entry column name as variable.</p>
                    {hints}
                </DropdownMenuLabel>
                {entry}
                {expressionError && warning(expressionError)}
            </div>

            {previewValues && 
                <div className="flex flex-col gap-1">
                    <DropdownMenuLabel className="text-sm font-semibold">Output preview</DropdownMenuLabel>
                    {preview}
                </div>
            }
        </div>
        
        {name && expression && !expressionError && !nameError && submit}

    </div>
    );
}

export default ColumnCreate;

/*
TODO: Integrate with orchestra endpoint and handle derived columns in the table
*/