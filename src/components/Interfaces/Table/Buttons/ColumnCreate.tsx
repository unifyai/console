"use client";

import { KeyboardEventHandler, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/UI/input";
import SubmitButton from "@/components/Common/Buttons/Submit";
import { getLogsParameters, TableArguments, LogProps, GroupedLogProps } from "@/types/evals/logs"
import { DropdownMenuLabel, DropdownMenuGroup, DropdownMenuSub, DropdownMenuPortal, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/UI/dropdown-menu";
import { LoaderCircle } from "lucide-react";
import { ResponseProps } from "@/types/common";
import FormulaInput from "@/components/Common/Input/Formula";
import { expressionToDerivedFunction } from "@/utils/evals/derivedColumns";
import { buildFilterExpressionArgument } from "@/utils/evals/filters";
import { Dialog, DialogTrigger, DialogContent } from "@/components/UI/dialog";

const ColumnCreate = ({ project, context, currentTable, tableArguments, logs, create, setPending, refresh, columnOrder, setColumnOrder, previousColumn, setOpen }: {
    project: string,
    context: string | undefined,
    currentTable: string,
    tableArguments: TableArguments,
    logs: LogProps[] | GroupedLogProps[],
    create: (project: string, context: string | undefined, key: string, equation: string, referenced_logs: {[table_name: string]: getLogsParameters}) => Promise<ResponseProps>,
    setPending: (pending: boolean) => void,
    refresh: () => Promise<ResponseProps>,
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
    
    // Implicitly append column context to the name
    let columnContextPrefix = previousColumn.split("/").slice(1, -1).join("/")
    if (columnContextPrefix.length) columnContextPrefix += "/"

    // State tracking
    const [name, setName] = useState<string>(columnContextPrefix);
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
        setName(value)
        if (columns.includes(value)) {
            setNameError(`${value} already used as a column name.`);
            return;
        }
        setNameError("");
    }

    const handleExpression = (value: string) => {
        setExpression(value);
        const equation = expressionToDerivedFunction(value, currentTable, tables, columns);
        setEquation(equation)
    }

    // Handle submission    
    const onSubmit = () => {
        let referencedTables : (keyof TableArguments)[] = tables.filter(table => equation.includes(table))
        if (!referencedTables.length) referencedTables = [currentTable]
        const referencedArguments = Object.fromEntries(
            Object.entries(tableArguments)
                  .filter(([key, _]) => referencedTables.includes(key))
                  .map(([key, args]) => [key, buildFilterExpressionArgument(args).getLogs_parameters])
        );
        setLoading(true);
        create(project, context, name, equation, referencedArguments).then(async (response: ResponseProps) => {
            if ("info" in response) {
                
                // Update states
                setErrorMessage("");
                setLoading(false);
                setOpen(false);

                // Add new column next to the previous
                const previousIndex = columnOrder.indexOf(previousColumn);
                const newOrder = previousIndex !== -1 
                    ?   [
                            ...columnOrder.slice(0, previousIndex + 1),
                            previousColumn.includes("Parameters/") ? `Parameters/${name}` : `Entries/${name}`,
                            ...columnOrder.slice(previousIndex + 1)
                        ] 
                    : columnOrder;
                setColumnOrder(newOrder);
                
                // Refresh page
                refresh().then(() => {
                    router.refresh();
                    setPending(true);
                });
                
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
    const column =  <Input
                        className="w-1/2 min-w-[100px]"
                        onClick={(event) => event.stopPropagation()}
                        placeholder={"Enter a column name.."}
                        value={name}
                        onInput={(event) => handleName(event.currentTarget.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseMove={(e) => e.stopPropagation()}
                        onKeyDown={onEnter}
                    />

    const entry = <FormulaInput options={options} value={expression} setValue={handleExpression} onEnter={onEnter} className="left-8"/>
    
    const warning = (error: string) => 
                    <p style={{"scrollbar-width": "thin"} as React.CSSProperties} className="flex justify-start text-sm text-destructive overflow-x-auto max-w-[300px]">{error}</p>
    const submit =  <div className="flex justify-end">
                        <SubmitButton text={loading ? "Creating column" : "Create"} onClick={() => onSubmit()} icon={loading && <LoaderCircle className="animate-spin text-white"/>} />
                    </div>
    const body =    <div className="px-2 pb-2 flex flex-col gap-1 h-full w-[400px]" onClick={(e) => e.stopPropagation()}>

        <div className="flex flex-col h-full">
            <DropdownMenuLabel className="text-sm font-semibold">Column name</DropdownMenuLabel>
            {column}
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
        <Dialog open={loading ? true : undefined}>
            <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                <span>New column</span>
            </DialogTrigger>    
            <DialogContent 
                // Stop clicks from closing the parent if it’s still around
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onPointerOver={(e) => e.stopPropagation()}
                // Prevent auto-focus on the first input element
                onOpenAutoFocus={(e) => e.preventDefault()}
                className="sm:max-w-lg"
            >
                {body}
                {footer}
            </DialogContent>
        </Dialog>
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