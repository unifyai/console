"use client";

import { BasePopover } from "@/components/Common/Popovers/Base";
import { Columns3 } from "lucide-react";
import SettingButton from "@/components/Common/Buttons/Setting";
import { Switch } from "@/components/UI/switch";
import { updateColumnVisibility } from "@/utils/evals/columnOperations";

const VisibilityFilter = ({ columnVisibility, setColumnVisibility }: {
    columnVisibility: { [key: string]: boolean },
    setColumnVisibility: (x: { [key: string]: boolean }) => void
}) => {
    const columns = Object.keys(columnVisibility);
    const anyHidden = Object.values(columnVisibility).some(bool => !bool);

    const handleAllCheck = () => {
        const state = anyHidden ? true : false;
        const newColumnVisibility = Object.fromEntries(
          Object.entries(columnVisibility).map(([key]) => [key, state])
        );
        setColumnVisibility(newColumnVisibility);
    };

    const handleSingleCheck = (column: string) => {
        const isVisible = !columnVisibility[column];
        const newColumnVisibility = updateColumnVisibility(columnVisibility, column, isVisible);
        setColumnVisibility(newColumnVisibility);
    };

    return (
        <BasePopover
            button={
                <SettingButton tooltip={"Show / hide columns"} icon={<Columns3 />} />
            }
        >
            <div className="flex flex-col gap-1 p-3 max-h-100 overflow-y-auto">
                <p className="font-bold text-medium pb-1">Select visible columns</p>
                <div className="flex flex-row gap-2 items-center justify-between font-bold pb-2">
                    <Switch checked={!anyHidden} onCheckedChange={handleAllCheck} />
                    {`${anyHidden ? "Show all" : "Hide all"}`}
                </div>
                {columns.map((column, index) => (
                    <div key={index} className="flex flex-row gap-2 items-center justify-between">
                        <Switch checked={columnVisibility[column]} onCheckedChange={() => handleSingleCheck(column)} />
                        {column}
                    </div>
                ))}
            </div>
        </BasePopover>
    );
};

export default VisibilityFilter;
