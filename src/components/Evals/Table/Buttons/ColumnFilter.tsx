"use client";

import { Dispatch, SetStateAction, useState } from "react";

import { Column } from "@tanstack/react-table";
import { CirclePlus, Filter, Trash } from "lucide-react";
import { Input } from "@/components/UI/input";
import ActionButton from "@/components/Common/Buttons/Action";
import BaseDropdown from "@/components/Common/Dropdowns/Base";

import SubmitButton from "@/components/Common/Buttons/Submit";

import { Equal, EqualNot, Brackets, } from "lucide-react";
import { FaGreaterThan, FaGreaterThanEqual, FaLessThan, FaLessThanEqual } from "react-icons/fa";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/UI/dropdown-menu";

const filterModes = [
    { icon: <Brackets />, name: "Contains", fn: "in", description: "Values contained in the input." },
    { icon: <Equal />, name: "Is", fn: "is", description: "Values equal to the the input." },
    { icon: <EqualNot />, name: "Not", fn: "not", description: "Values not equal to the the input." },
    { icon: <FaGreaterThan />, name: "Greater Than", fn: ">", description: "Values greater than the input number" },
    { icon: <FaGreaterThanEqual />, name: "Greater Or Equal", fn: ">=", description: "Values greater than or equal to the input number" },
    { icon: <FaLessThan />, name: "Lower Than", fn: "<", description: "Values lower than the input number number" },
    { icon: <FaLessThanEqual />, name: "Lower Or Equal", fn: "<=", description: "Values lower than or equal to the input number" },
];

const ColumnFilter = ({ setFilters, filters, column, columnTypes }: {
    setFilters: (x: { [key: string]: { [fn: string]: string } }) => void,
    filters: { [key: string]: { [fn: string]: string } },
    column: Column<any | unknown>,
    columnTypes: { [key: string]: string }
}) => {

    const property = column.columnDef.header?.valueOf() as string;
    const [selectedFilters, setSelectedFilters] = useState<{ [fn: string]: string }>(
        filters[property] ?? {}
    );
    const [newRow, setNewRow] = useState(false);
    const [changed, setChanged] = useState(false);
    const [open, setOpen] = useState(false);
    const remainingModes = filterModes.filter(mode => !(mode.fn in selectedFilters));

    const onSubmit = (selectedFilters: { [fn: string]: string }) => {
        const newFilters = { ...filters };
        Object.entries(selectedFilters).forEach(([key, value]) => {
            if (value === "")
                newFilters[property] = {};
            else {
                newFilters[property] = {
                    ...newFilters[property],
                    [key]: (
                        value.startsWith('"') && value.endsWith('"')
                    ) || (["int", "float"].includes(columnTypes[property])) ? value : `"${value}"`
                };
            }
        });
        const selectedKeys = Object.keys(selectedFilters);
        newFilters[property] = Object.fromEntries(
            Object.entries(newFilters[property]).filter(([key]) => selectedKeys.includes(key))
        );
        setFilters(newFilters);
        setOpen(false);
        setChanged(false);
        setNewRow(false);
    };

    const button = <ActionButton icon={<Filter />} tooltip="Filter" variant={property in filters ? "primary" : undefined} />
    return (
        <BaseDropdown
            button={button}
            open={open}
            setOpen={setOpen}
            label={`Filter logs by`}
        >
            <div className="ml-2 flex gap-2 items-center">
                <div className="text-sm">Current filters:</div>
                <ActionButton icon={<CirclePlus />} tooltip="Add new filter" onClick={() => setNewRow(true)} />
            </div>
            <div className="flex-col">
                {Object.keys(selectedFilters).concat(newRow ? [""] : []).map((key, index) => {
                    const currentMode = filterModes.find(mode => mode.fn === key);
                    return (
                        <div key={index} className={
                            "w-[400px] grid grid-cols-7 gap-2 p-2 mx-1 rounded-lg items-center outline-none"
                        }>
                            <div className="col-span-3">
                                <DropdownMenu>
                                    <DropdownMenuTrigger className="w-full">
                                        <div className={
                                            "text-sm w-full p-1 px-2 rounded-md flex justify-between items-center " +
                                            `hover:bg-primary transition-all ${currentMode?.name ? "" : "border-2 border-muted"
                                            }`
                                        }>
                                            <div className="w-fit h-fit">
                                                {
                                                    currentMode?.name
                                                    || <span className="text-muted-foreground">Select Operation</span>
                                                }
                                            </div>
                                            {currentMode && <div className="w-fit h-fit scale-90">
                                                {currentMode?.icon}
                                            </div>}
                                        </div>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        {remainingModes.map((mode, index) => (
                                            <DropdownMenuItem key={index} onClick={() => {
                                                const keyIndex = Object.keys(selectedFilters).indexOf(key);
                                                const newEntries = Object.entries(selectedFilters).filter(
                                                    ([selectedKey]) => selectedKey !== key
                                                );
                                                setSelectedFilters(currentMode != undefined ? Object.fromEntries(
                                                    newEntries.slice(0, keyIndex).concat([[mode.fn, ""]]).concat(
                                                        newEntries.slice(keyIndex)
                                                    )
                                                ) : { ...selectedFilters, [mode.fn]: "" });
                                            }}>
                                                <div className="w-full grid grid-cols-2 gap">
                                                    <div className="text-sm">{mode.name}</div>
                                                    <div className="flex justify-center scale-90">{mode.icon}</div>
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <Input
                                className="col-span-3"
                                placeholder={"Enter a filter value.."}
                                onChange={() => setChanged(true)}
                                value={selectedFilters[key]}
                                onInput={(input) => currentMode && setSelectedFilters(
                                    { ...selectedFilters, [currentMode.fn]: input.currentTarget.value }
                                )}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                        onSubmit(selectedFilters);
                                }}
                            />
                            <ActionButton icon={<Trash />} tooltip="Delete filter" onClick={() => {
                                if (currentMode == undefined)
                                    setNewRow(false);
                                else {
                                    const newSelectedFilters = Object.fromEntries(
                                        Object.entries(selectedFilters).filter(
                                            ([selectedKey]) => selectedKey !== key
                                        )
                                    );
                                    setSelectedFilters(newSelectedFilters);
                                    setChanged(true);
                                }
                            }} />
                        </div>
                    )
                })}
            </div>
            {changed &&
                <div className="flex flex-row gap-3 justify-end p-2 mx-1 rounded-lg outline-none">
                    <SubmitButton text="Apply" onClick={() => onSubmit(selectedFilters)} />
                </div>
            }
        </BaseDropdown>
    );
}

export default ColumnFilter;
