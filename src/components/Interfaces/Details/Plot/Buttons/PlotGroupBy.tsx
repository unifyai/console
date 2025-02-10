"use client";

import { useEffect, useState } from "react";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { Group, Ungroup, LoaderCircle } from "lucide-react";
import { DropdownMenuItem, DropdownMenuGroup, DropdownMenuSub, DropdownMenuPortal, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/UI/dropdown-menu";
import SettingButton from "@/components/Common/Buttons/Setting";
import { LogProps, LogFieldsResponseProps } from "@/types/evals/logs";

const PlotGroupBy = ({fields, groupBy, setGroupBy, logs}: {
    fields: LogFieldsResponseProps, 
    groupBy: string | undefined, 
    setGroupBy: (x: string | undefined) => void, 
    logs: LogProps[] | undefined
}) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    },[logs])

    /* Available options */
    const properties = Object
        .entries(fields)
        .filter(([name, { data_type, field_type }]) => field_type != "param")
        .map(([name]) => name);
    let options = properties.reduce((acc: {[key: string]: string[]}, item) => {
        const [table, column] = item.split(".");
        acc[table] = acc[table] || [];
        acc[table].push(column);
        return acc;
    }, {}) as {[key: string]: string[]};
    options ["None"] = []

    /* Selection handler */
    const onSelect = (option: string) => {
        setGroupBy(option != "None" ? option : undefined)
        setLoading(true)
    }
    
    /* Dropdown button */
    const icon = !groupBy || groupBy === "None" 
        ? loading ? <LoaderCircle className="animate-spin text-primary"/> : <Group/> 
        : loading ? <LoaderCircle className="animate-spin text-white"/> : <Ungroup/>;
    const variant = !groupBy || groupBy === "None" ? "outline" : "primary";
    const button = <SettingButton icon={icon} tooltip={"Group by"} variant={variant} disabled={loading}/> 
    return (
        <BaseDropdown button={button}>
            {Object.entries(options).map(([table, columns], optionIndex) => {

                if (table === "None") {
                    return <DropdownMenuItem key={"None"} onClick={() => onSelect("None")}>{"None"}</DropdownMenuItem>
                }

                const tableTrigger = <DropdownMenuSubTrigger disabled={loading} className="hover:text-white data-[state=open]:text-white">{table}</DropdownMenuSubTrigger>
                const tableOptions = columns.map((column, optionIndex) => {
                    const selection = `${table}.${column}`
                    return <DropdownMenuItem key={optionIndex} onSelect={() => onSelect(selection)}>{column}</DropdownMenuItem>
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

export default PlotGroupBy;
