"use client";

import { Dispatch, SetStateAction } from "react";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { Group } from "lucide-react";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import SettingButton from "@/components/Common/Buttons/Setting";

const PlotGroupBy = ({properties, groupBy, setGroupBy}: {properties: string[], groupBy: string | null, setGroupBy: (x: string | null) => void}) => {
    return (
        <BaseDropdown
            button={
                <SettingButton icon={<Group/>} tooltip={"Group by property"}/>
            }
            label={"Group plot by property"}
        >
            {
            ["None"].concat(properties).map(property => {
                return (
                    <DropdownMenuItem key={property} onClick={() => setGroupBy(property != "None" ? property : null)}>
                        {property}
                    </DropdownMenuItem>
                );
            })
          }
        </BaseDropdown>
    );
}

export default PlotGroupBy;
