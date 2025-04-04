"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem, DropdownMenuGroup, DropdownMenuSub, DropdownMenuPortal, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/UI/dropdown-menu";
import SettingButton from "@/components/Common/Buttons/Setting";
import { Sigma, LoaderCircle, Workflow } from "lucide-react";
import { LogProps } from "@/types/evals/logs";
import { useEffect, useState } from "react";

const PlotAggregate = ({groupings, isAggregated, setIsAggregated, logs}: {
    groupings: {[table: string]: string[]}
    isAggregated: string | undefined, 
    setIsAggregated: (x: string | undefined) => void,
    logs: LogProps[] | undefined
}) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    },[logs])

    /* Available options */
    let options = groupings
    options["None"] = []

    /* Selection handler */
    const onSelect = (option: string) => {
        setIsAggregated(option === "None" || option === isAggregated ? undefined : option)
        setLoading(true)
    }

    /* Dropdown button */
    const icon = !isAggregated || isAggregated === "None" 
        ? loading ? <LoaderCircle className="animate-spin text-primary"/> : <Sigma/> 
        : loading ? <LoaderCircle className="animate-spin text-white"/> : <Sigma/>;
    const variant = !isAggregated || isAggregated === "None" ? "outline" : "primary";
    const button = <SettingButton icon={icon} tooltip={"Aggregate by"} variant={variant} disabled={loading}/> 
    return (
        <BaseDropdown button={button}>
            {Object.entries(options).map(([table, columns], optionIndex) => {

                if (table === "None") {
                    return <DropdownMenuItem key={"None"} onClick={() => onSelect("None")}>{"None"}</DropdownMenuItem>
                }

                const tableTrigger = <DropdownMenuSubTrigger className="hover:text-white data-[state=open]:text-white">{table}</DropdownMenuSubTrigger>
                const tableOptions = columns.map((column, optionIndex) => {
                    const selection = `${table}.${column}`
                    return <DropdownMenuItem key={optionIndex} onSelect={() => onSelect(selection)} className="flex flex-row gap-2">
                        {optionIndex != 0 && <Workflow/>}
                        {column}
                    </DropdownMenuItem>
                })

                return (
                    <DropdownMenuGroup key={optionIndex}> 
                        <DropdownMenuSub>
                            {tableTrigger}
                            <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                    {tableOptions}
                                </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>
                    </DropdownMenuGroup>
                )
            })
        }
        </BaseDropdown>
    );
}

export default PlotAggregate