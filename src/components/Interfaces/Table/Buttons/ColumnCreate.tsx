"use client";

import { KeyboardEventHandler, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/UI/input";
import SubmitButton from "@/components/Common/Buttons/Submit";
import Tooltip from "@/components/Common/Misc/Tooltip";
import { getLogsParameters, TableArguments, LogProps, GroupedLogProps } from "@/types/evals/logs"
import { DropdownMenuItem, DropdownMenuLabel } from "@/components/UI/dropdown-menu";
import { LoaderCircle, Info, Plus } from "lucide-react";
import { ResponseProps } from "@/types/common";
import FormulaInput from "@/components/Common/Input/Formula";
import { expressionToDerivedFunction } from "@/utils/evals/derivedColumns";
import { buildFilterExpressionArgument } from "@/utils/evals/filters";
import { processContext, sanitizeId } from "@/utils/evals/columnOperations";
import BaseDialog from "@/components/Common/Dialogs/Base";

const extractSharedPath = (firstColumnName: string, secondColumnName: string) => {
    const firstPathParts = firstColumnName.split('/').filter(p => p !== '');
    const secondPathParts = secondColumnName.split('/').filter(p => p !== '');
    let commonParts: string[] = [];
    let i = 0;
    while (i < firstPathParts.length && i < secondPathParts.length && firstPathParts[i] === secondPathParts[i]) {
        commonParts.push(firstPathParts[i]);
        i++;
    }
    const commonRoot = commonParts.length > 0 ? commonParts.join('/') + '/' : '';
    return commonRoot
}

const extractColumnPath = (columnName: string) => columnName.split("/").slice(1, -1).join("/")

const ColumnCreate = ({ project, context, columnContext, currentTable, tableArguments, logs, create, setPending, columnOrder, setColumnOrder, previousColumn, setOpen }: {
    project: string,
    context: string | undefined,
    columnContext: string | undefined,
    currentTable: string,
    tableArguments: TableArguments,
    logs: LogProps[] | GroupedLogProps[],
    create: (project: string, context: string | undefined, key: string, equation: string, referenced_logs: {[table_name: string]: getLogsParameters}) => Promise<ResponseProps>,
    setPending: (pending: boolean) => void,
    columnOrder: string[],
    setColumnOrder: (order: string[]) => void,
    previousColumn: string,
    setOpen: (open: boolean) => void
}) => {
    const router = useRouter();

    /* Construct autocomplete options list from table arguments and extract tables and columns from the options for regex parsing */
    const options = Object
        .entries(tableArguments)
            .map(([table, args]) => ({name: table, type: "Table Name", children: Object.keys(args.available_fields)}))  // Add all displayed tables
        .concat(Object.entries(tableArguments[currentTable as keyof TableArguments].available_fields)                   // Add all columns of current table
            .map(([column, _]) => ({name: column, type: "Column Name", children: []}))
        )
    const tables = options.filter(option => option.type === "Table Name").map(option => option.name)
    const columns = options.filter(option => option.type === "Column Name").map(option => option.name);
    
    // Prepend column context to the order and column name, if applicable
    const previous = columnContext && previousColumn != "RowNumbering"
    ? previousColumn.startsWith("Parameters/") 
        ? `${"Parameters/"}${processContext("merge", columnContext, sanitizeId(previousColumn))}`
        : `${"Entries/"}${processContext("merge", columnContext, sanitizeId(previousColumn))}`
    : previousColumn
    const order = columnOrder.map(columnID => {
        if (columnID === "RowNumbering") return columnID
        if (!columnContext) return columnID
        const prefix = columnID.startsWith("Parameters/") ? "Parameters/" : "Entries/" 
        const contextAwareColumn = processContext("merge", columnContext, sanitizeId(columnID))
        return `${prefix}${contextAwareColumn}`
    })

    // Find index of previous and next column to position the new column
    const previousIndex = order.indexOf(previous)
    const nextIndex = previousIndex != -1 && previousIndex < order.length - 1 ? previousIndex + 1 : previousIndex
    const nextColumn = order.at(nextIndex) ?? previous

    // Prefix derived column name with previous column prefix, if applicable
    let previousColumnPrefix = extractColumnPath(previousColumn)
    if (previousColumnPrefix.length) previousColumnPrefix += "/"
    let nextColumnPrefix = extractColumnPath(nextColumn)
    if (nextColumnPrefix.length) nextColumnPrefix += "/"
    const commonRoot = extractSharedPath(previousColumnPrefix, nextColumnPrefix)
    const editableInitialName = previousColumnPrefix.slice(commonRoot.length);
    
    // State tracking
    const [name, setName] = useState<string>(editableInitialName);
    const [nameError, setNameError] = useState<string>("");
    const [expression, setExpression] = useState<string>("");
    const [equation, setEquation] = useState<string>("");
    const [errorMessage, setErrorMessage] = useState<string>("");

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    },[logs])

    // Handle inputs
    const handleName = (value: string) => {
        if (commonRoot && !value.startsWith(commonRoot)) return;
        const newValue = value.slice(commonRoot.length);
        setName(newValue);
        const fullName = commonRoot + newValue;
        if (columns.includes(fullName)) {
          setNameError(`${fullName} already used as a column name.`);
          return;
        }
        setNameError("");
    };

    const handleExpression = (value: string) => {
        setExpression(value);
        const equation = expressionToDerivedFunction(value, currentTable, tables, columns);
        setEquation(equation)
    }

    // Handle submission    
    const onSubmit = () => {

        /* Build referenced arguments object */
        let referencedTables : (keyof TableArguments)[] = tables.filter(table => equation.includes(table))
        if (!referencedTables.length) referencedTables = [currentTable]
        const referencedArguments = Object.fromEntries(
            Object.entries(tableArguments)
                  .filter(([key, _]) => referencedTables.includes(key))
                  .map(([key, args]) => [key, buildFilterExpressionArgument(args).getLogs_parameters])
        );

        /* Implicitly prepend selected column context to the name, if applicable */
        let key = commonRoot ? commonRoot + name : name
        key = columnContext ? processContext("merge", columnContext, key) : key

        setLoading(true);
        create(project, context, key, equation, referencedArguments).then(async (response: ResponseProps) => {
            if ("info" in response) {
                
                // Update states
                setErrorMessage("");
                setLoading(false);
                setOpen(false);

                // Add new column next to the previous
                const newOrder = previousIndex !== -1 
                    ?   [
                            ...order.slice(0, previousIndex + 1),
                            previous.includes("Parameters/") ? `Parameters/${key}` : `Entries/${key}`,
                            ...order.slice(previousIndex + 1)
                        ] 
                    : order;
                setColumnOrder(newOrder);
                
                // Refresh page
                router.refresh();
                setPending(true);
                
                return;
            } 
            let error = "Failed to create derived entries, please try again.";
            if ("detail" in response) {
                if (typeof response.detail === "string") error = response.detail;
                else error = JSON.stringify(response.detail);
            }
            setLoading(false);
            setErrorMessage(error);
            setTimeout(() => setErrorMessage(""), 10000);
        })

    }
    const onEnter : KeyboardEventHandler = (e) => {
        e.stopPropagation()
        if (e.key === "Enter" && name && expression && !nameError) onSubmit()
    }

    // Subcomponents
    const column = <Input 
        className="w-1/2 min-w-[100px]" 
        onClick={(event) => event.stopPropagation()} 
        placeholder={"Enter a column name.."} 
        value={commonRoot + name} 
        onInput={(event) => handleName(event.currentTarget.value)} 
        onMouseDown={(e) => e.stopPropagation()} 
        onMouseMove={(e) => e.stopPropagation()} 
        onKeyDown={onEnter} 
    />;

    const info = <Tooltip content={`New columns created at this position can only belong to the ${commonRoot.slice(0, -1)} column context`}><Info size={16}/></Tooltip>

    const entry = <FormulaInput options={options} value={expression} setValue={handleExpression} onEnter={onEnter} className="left-8"/>
    
    const warning = (error: string) => 
                    <p style={{"scrollbar-width": "thin"} as React.CSSProperties} className="flex justify-start text-sm text-destructive overflow-x-auto max-w-[300px]">{error}</p>
    const submit =  <div className="flex justify-end">
                        <SubmitButton text={loading ? "Creating column" : "Create"} onClick={() => onSubmit()} icon={loading && <LoaderCircle className="animate-spin text-white"/>} />
                    </div>
    const body =    <div className="px-2 pb-2 flex flex-col gap-1 h-full w-[400px]" onClick={(e) => e.stopPropagation()}>

        <div className="flex flex-col h-full">
            <DropdownMenuLabel className="text-sm font-semibold">Column name</DropdownMenuLabel>
            <div className="flex flex-row gap-2">
                {column}
                {commonRoot && info}
            </div>
            {nameError && warning(nameError)}
        </div>

        <div className="flex flex-col h-full">
            <DropdownMenuLabel className="text-sm font-semibold">Derived expression</DropdownMenuLabel>
            <DropdownMenuLabel className="text-sm font-normal">
                <p>Enter a mathematical expression to evaluate. You can use any entry column name as variable.</p>
            </DropdownMenuLabel>
            {entry}
        </div>

    </div>
    const footer =  <div className="p-2 flex flex-row gap-5 justify-between w-full">
        {warning(errorMessage)}
        {name && expression && !nameError && submit}
    </div>

    return (
        <BaseDialog
            context="tile" 
            open={loading ? true : undefined}
            button={
                <DropdownMenuItem 
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
                    onSelect={(e) => e.preventDefault()}
                >
                    <Plus className="h-4 w-4"/>
                    <span>New column</span>
                </DropdownMenuItem>
            }
            body={body}
            footer={footer}
            // Stop clicks from closing the parent if it’s still around
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onPointerOver={(e) => e.stopPropagation()}
            // Prevent auto-focus on the first input element
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="sm:max-w-lg"
        />
    )
}

export default ColumnCreate;

/* TODO: 
    
    - Add button to refresh the values
    - Add dropdown options for: 
        (See https://github.com/unifyai/orchestra/blob/main/orchestra/web/api/log/helpers.py#L151 for source)
        functions: 
            r"(?<!\w)(?:len|type|exists|version|str(?=\()|to_str)"
            ["len", "type", "exists", "version", "str", "to_str"]
        operators: 
            r"==|!=|<=|>=|<|>|(?<!\w)(?:not in|is not|in|not|and|or|is)(?!\w)|\*\*|//|\+|\-|\*|/|%"
            ["!=", "<=", ">=", ">", "<", "not in", "is not", "in", "not", "and", "or", "is", "//", "**", "+", "-", "/", "%"]
*/