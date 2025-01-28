"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { Group, Ungroup } from "lucide-react";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import SettingButton from "@/components/Common/Buttons/Setting";
import { LogFieldsResponseProps } from "@/types/evals/logs";

const PlotGroupBy = ({fields, groupBy, setGroupBy}: {
    fields: LogFieldsResponseProps, 
    groupBy: string | null, 
    setGroupBy: (x: string | null) => void, 
}) => {
    const properties = Object
        .entries(fields)
        .filter(([name, { data_type, field_type }]) => field_type != "param")
        .map(([name]) => name);
    const icon = !groupBy || groupBy === "None" ? <Group/> : <Ungroup/>;
    const variant = !groupBy || groupBy === "None" ? "outline" : "primary";
    const options = ["None"].concat(properties)
    return (
        <BaseDropdown
            button={
                <SettingButton icon={icon} tooltip={"Group by"} variant={variant}/>
            }
        >
            {
            options.map(option => {
                return (
                    <DropdownMenuItem 
                        key={option} 
                        onClick={() => setGroupBy(option != "None" ? option : null)}
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
