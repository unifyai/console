"use client";

import { KeyboardEventHandler, useState, useEffect, Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import SubmitButton from "@/components/Common/Buttons/Submit";
import { getLogsParameters, TableArguments, LogProps, GroupedLogProps } from "@/types/evals/logs"
import ActionButton from "@/components/Common/Buttons/Action";
import { ResponseProps } from "@/types/common";
import FormulaInput from "@/components/Common/Input/Formula";
import { TbMathFunction } from "react-icons/tb";
import { LoaderCircle } from "lucide-react";
import { expressionToDerivedFunction, derivedFunctionToExpression } from "@/utils/evals/derivedColumns";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/UI/dialog";
import { sanitizeId } from "@/utils/evals/columnOperations";
import { buildFilterExpressionArgument } from "@/utils/evals/filters";

const ColumnUpdate = ({
    project,
    colId,
    previousEquation,
    currentTable,
    tableArguments,
    logs,
    update,
    setPending,
    refresh,
    open,
    setOpen,
    updateLoading,
    setUpdateLoading,
    renderMode
}: {
    project: string,
    colId: string,
    previousEquation: string,
    currentTable: string,
    tableArguments: TableArguments,
    logs: LogProps[] | GroupedLogProps[]
    update: (project: string, key: string | null, equation: string | null, target_derived_logs: {[table_name: string]: getLogsParameters}, referenced_logs: {[table_name: string]: getLogsParameters} | null) => Promise<ResponseProps>,
    setPending: (pending: boolean) => void,
    refresh: () => Promise<ResponseProps>,
    open: boolean,
    setOpen: Dispatch<SetStateAction<boolean>>,
    updateLoading: boolean,
    setUpdateLoading: (updateLoading: boolean) => void,
    renderMode: "button" | "menuItem"
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

    // State tracking
    const previousExpression = derivedFunctionToExpression(previousEquation, tables, columns)
    const [expression, setExpression] = useState<string>(previousExpression);
    const [equation, setEquation] = useState<string>("");
    const [errorMessage, setErrorMessage] = useState<string>("");

    /* Display loader when data updates */
    useEffect(() => {
        setUpdateLoading(false);
    },[logs])

    // Handle inputs
    const handleExpression = (value: string) => {
        setExpression(value);
        const equation = expressionToDerivedFunction(value, currentTable, tables, columns);
        setEquation(equation)
    }

    // Handle submission    
    const onSubmit = () => {

        let previousReferencedTables : (keyof TableArguments)[] = tables.filter(table => previousEquation.includes(table))
        if (!previousReferencedTables.length) previousReferencedTables = [currentTable]
        const target_derived_logs = Object.fromEntries(
            Object.entries(tableArguments)
                  .filter(([key, _]) => previousReferencedTables.includes(key))
                  .map(([key, args]) => [key, buildFilterExpressionArgument(args).getLogs_parameters])
        );
        
        let newReferencedTables : (keyof TableArguments)[] = tables.filter(table => equation.includes(table))
        if (!newReferencedTables.length) newReferencedTables = [currentTable]
        const referenced_logs = Object.fromEntries(
            Object.entries(tableArguments)
                  .filter(([key, _]) => newReferencedTables.includes(key))
                  .map(([key, args]) => [key, buildFilterExpressionArgument(args).getLogs_parameters])
        );

        setUpdateLoading(true);
        update(project, colId, equation, target_derived_logs, referenced_logs).then(async (response: ResponseProps) => {
            if ("info" in response) {
                
                // Update states
                setErrorMessage("");
                setUpdateLoading(false);
                setOpen(false);
                
                // Refresh page
                refresh().then(() => {
                    router.refresh();
                    setPending(true);
                });
                
                return;
            } 
            let error = "Failed to update derived entries, please try again.";
            if ("detail" in response) {
                if (typeof response.detail === "string") error = response.detail;
                else error = JSON.stringify(response.detail);
            }
            setUpdateLoading(false);
            setErrorMessage(error);
            setTimeout(() => setErrorMessage(""), 5000);
        })
    }
    const onEnter : KeyboardEventHandler = (e) => {
        e.stopPropagation()
        if (e.key === "Enter" && expression) onSubmit()
    }

    // Subcomponents
    const warning = (error: string) => 
                    <p className="flex justify-start text-sm text-destructive">{error}</p>
    const submit =  <div className="flex justify-end">
                        <SubmitButton text="Apply" onClick={() => onSubmit()}/>
                    </div>

    const icon = updateLoading ? <LoaderCircle className="animate-spin text-primary"/> : <TbMathFunction/>
    const columnButton = renderMode === "button" ? (
        <ActionButton tooltip={"Update equation"} icon={icon} disabled={updateLoading}/>
    ) : (
        <TbMathFunction className="h-4 w-4"/>
    )
    const body =    <div className="flex flex-col gap-1 h-full" onClick={(e) => e.stopPropagation()}>
                        <FormulaInput options={options} value={expression} setValue={handleExpression} onEnter={onEnter} className="left-8"/>
                    </div>
    const footer =  <div className="p-2 flex flex-row gap-1 justify-between">
                        {warning(errorMessage)}
                        {expression && submit}
                    </div>

    return (
        <Dialog
            open={renderMode === "menuItem" ? undefined : open}
            onOpenChange={renderMode === "menuItem" ? undefined : setOpen}
        >
            <DialogTrigger asChild>
                {renderMode === "menuItem" ? (
                    // Because this is inside a parent DropdownMenuItem, 
                    // we must prevent the parent from closing automatically:
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
                        {columnButton}
                        <span>Update Equation</span>
                    </DropdownMenuItem>
                ) : (
                    columnButton
                )}
            </DialogTrigger>

            <DialogContent
                // Stop clicks from closing the parent if it’s still around
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onPointerOver={(e) => e.stopPropagation()}
                className="sm:max-w-xl"
            >
                <DialogHeader>
                    <DialogTitle>Update Equation</DialogTitle>
                    <DialogDescription>
                        Update the derived column equation for <strong>{sanitizeId(colId)}</strong>.
                    </DialogDescription>
                </DialogHeader>

                {body}

                <DialogFooter>{footer}</DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default ColumnUpdate;