"use client";

import { KeyboardEventHandler, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SubmitButton from "@/components/Common/Buttons/Submit";
import { getLogsParameters, TableArguments, LogProps, GroupedLogProps } from "@/types/evals/logs"
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { BasePopover } from "@/components/Common/Popovers/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import { ResponseProps } from "@/types/common";
import FormulaInput from "@/components/Common/Input/Formula";
import { TbMathFunction } from "react-icons/tb";
import { LoaderCircle } from "lucide-react";
import { expressionToDerivedFunction, derivedFunctionToExpression } from "@/utils/evals/derivedColumns";

const ColumnUpdate = ({ project, key, previousEquation, currentTable, tableArguments, logs, update, setPending, refresh }: {
    project: string,
    key: string,
    previousEquation: string,
    currentTable: string,
    tableArguments: TableArguments,
    logs: LogProps[] | GroupedLogProps[]
    update: (project: string, key: string | null, equation: string | null, target_derived_logs: {[table_name: string]: getLogsParameters}, referenced_logs: {[table_name: string]: getLogsParameters} | null) => Promise<ResponseProps>,
    setPending: (pending: boolean) => void,
    refresh: () => Promise<ResponseProps>,
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
    const [open, setOpen] = useState(false);
    const previousExpression = derivedFunctionToExpression(previousEquation)
    const [expression, setExpression] = useState<string>(previousExpression);
    const [equation, setEquation] = useState<string>("");
    const [errorMessage, setErrorMessage] = useState<string>("");

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
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
                  .map(([key, args]) => [key, args.getLogs_parameters])
        );
        
        let newReferencedTables : (keyof TableArguments)[] = tables.filter(table => equation.includes(table))
        if (!newReferencedTables.length) newReferencedTables = [currentTable]
        const referenced_logs = Object.fromEntries(
            Object.entries(tableArguments)
                  .filter(([key, _]) => newReferencedTables.includes(key))
                  .map(([key, args]) => [key, args.getLogs_parameters])
        );

        setLoading(true);
        update(project, key, equation, target_derived_logs, referenced_logs).then(async (response: ResponseProps) => {
            if ("info" in response) {
                
                // Update states
                setErrorMessage("");
                setLoading(false);
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
            setLoading(false);
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

    const icon = loading ? <LoaderCircle className="animate-spin text-primary"/> : <TbMathFunction/>
    const columnButton = <ActionButton tooltip={"Update function"} icon={icon} disabled={loading}/>
    const body =    <div className="p-2 flex flex-col gap-1 h-full w-[400px]" onClick={(e) => e.stopPropagation()}>
                        <FormulaInput options={options} value={expression} setValue={handleExpression} onEnter={onEnter}/>
                    </div>
    const footer =  <div className="p-2 flex flex-row gap-1 justify-between">
                        {warning(errorMessage)}
                        {expression && submit}
                    </div>

    return (
    <BasePopover button={columnButton} open={open} setOpen={setOpen} className="flex flex-col w-full">
        {body}
        {footer}
    </BasePopover>
    );
}

export default ColumnUpdate;