"use client";

import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { Group, Ungroup } from "lucide-react";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import SettingButton from "@/components/Common/Buttons/Setting";

const PlotGroupBy = ({properties, groupBy, setGroupBy}: {
    properties: string[], 
    groupBy: string | undefined, 
    setGroupBy: (x: string | undefined) => void, 
}) => {
    const icon = !groupBy || groupBy === "None" ? <Group/> : <Ungroup/>;
    const variant = !groupBy || groupBy === "None" ? "outline" : "primary";
    const options = ["None"].concat(properties)
    return (
        <BaseDropdown
            button={
                <SettingButton icon={icon} tooltip={"Group by"} variant={variant}/>
            }
            label={"Group plot by property"}
        >
            {
            options.map(option => {
                return (
                    <DropdownMenuItem 
                        key={option} 
                        onClick={() => setGroupBy(option != "None" ? option : undefined)}
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
