"use client";

import { useEffect, useState } from "react";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { Group, Ungroup, LoaderCircle } from "lucide-react";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
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

    const properties = Object
        .entries(fields)
        .filter(([name, { data_type, field_type }]) => field_type != "param")
        .map(([name]) => name);
    const icon = !groupBy || groupBy === "None" 
        ? loading ? <LoaderCircle className="animate-spin text-primary"/> : <Group/> 
        : loading ? <LoaderCircle className="animate-spin text-white"/> : <Ungroup/>;
    const variant = !groupBy || groupBy === "None" ? "outline" : "primary";
    const options = ["None"].concat(properties)

    const onClick = (option: string) => {
        setGroupBy(option != "None" ? option : undefined)
        setLoading(true)
    }
    return (
        <BaseDropdown
            button={
                <SettingButton icon={icon} tooltip={"Group by"} variant={variant} disabled={loading}/>
            }
        >
            {
            options.map(option => {
                return (
                    <DropdownMenuItem 
                        key={option} 
                        onClick={() => onClick(option)}
                    >
                        {option}
                    </DropdownMenuItem>
                );
            })
          }
        </BaseDropdown>
    );
}

export default PlotGroupBy;
