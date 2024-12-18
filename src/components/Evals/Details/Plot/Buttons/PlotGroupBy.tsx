"use client";

import { Dispatch, SetStateAction } from "react";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { Group, Ungroup } from "lucide-react";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import SettingButton from "@/components/Common/Buttons/Setting";
import { GroupingColors } from "@/types/evals/plot";

const PlotGroupBy = ({properties, groupBy, setGroupBy, setGroupByColors}: {
    properties: string[], 
    groupBy: string | null, 
    setGroupBy: (x: string | null) => void, 
    setGroupByColors: Dispatch<SetStateAction<GroupingColors>>
}) => {
    const icon = !groupBy || groupBy === "None" ? <Group/> : <Ungroup/>;
    const variant = !groupBy || groupBy === "None" ? "outline" : "primary";
    return (
        <BaseDropdown
            button={
                <SettingButton icon={icon} tooltip={"Group by property"} variant={variant}/>
            }
            label={"Group plot by property"}
        >
            {
            ["None"].concat(properties).map(property => {
                return (
                    <DropdownMenuItem 
                        key={property} 
                        onClick={() => {
                            setGroupBy(property != "None" ? property : null)
                            if (property === "None") setGroupByColors([])
                        }}
                    >
                        {property}
                    </DropdownMenuItem>
                );
            })
          }
        </BaseDropdown>
    );
}

export default PlotGroupBy;
