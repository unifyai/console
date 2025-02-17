"use client";

import { useEffect, useState } from "react";
import BaseDropdown from "../Common/Dropdowns/Base";
import { DropdownMenuItem } from "../UI/dropdown-menu";
import { Plus } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";

const TabSelection = ({
    tab_,
    edit,
    open,
    onTabChange,
}: {
    tab_?: string,
    edit: boolean,
    open?: boolean,
    onTabChange: (tab: string) => void,
}) => {
    const tabTypes = ["Table", "Plot", "View"];
    const [tab, setTab] = useState<string | undefined>(tab_);

    useEffect(() => {
        setTab(tab_);
    }, [tab_]);

    return (
        <BaseDropdown
            button={<ActionButton
                tooltip="Add Tab"
                text={tab}
                icon={tab ? undefined : <Plus />}
                variant="outline"
                size="default"
                className="z-60"
            />}
            open={open}
        >
            {(!edit ? [] : tabTypes).map((tab, idx) => <DropdownMenuItem
                key={idx}
                onSelect={() => {
                    onTabChange(tab);
                    setTab(tab);
                }}
                className="w-64 z-10"
            >
                {tab}
            </DropdownMenuItem>)}
        </BaseDropdown>
    );
};

export default TabSelection;
