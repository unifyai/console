"use client";

import { Dispatch, SetStateAction, useState } from "react";

import { Column } from "@tanstack/react-table";
import { Filter } from "lucide-react";
import { Input } from "@/components/UI/input";
import ActionButton from "@/components/Common/Buttons/Action";
import BaseDropdown from "@/components/Common/Dropdowns/Base";

import SubmitButton from "@/components/Common/Buttons/Submit";

import { Equal, EqualNot, Brackets, } from "lucide-react";
import { FaGreaterThan, FaGreaterThanEqual, FaLessThan, FaLessThanEqual } from "react-icons/fa";

const filterModes = [
    { icon: <Brackets />, name: "In", fn: "in", description: "Values included in the input range." },
    { icon: <Equal />, name: "Is", fn: "is", description: "Values equal to the the input." },
    { icon: <EqualNot />, name: "Not", fn: "not", description: "Values not equal to the the input." },
    { icon: <FaGreaterThan />, name: "Greater Than", fn: ">", description: "Values greater than the input number" },
    { icon: <FaGreaterThanEqual />, name: "Greater Or Equal", fn: ">=", description: "Values greater than or equal to the input number" },
    { icon: <FaLessThan />, name: "Lower Than", fn: "<", description: "Values lower than the input number number" },
    { icon: <FaLessThanEqual />, name: "Lower Or Equal", fn: "<=", description: "Values lower than or equal to the input number" },
];

const ColumnFilter = ({ setError, setFilters, filters, column }: {
    setError: Dispatch<SetStateAction<string | undefined>>,
    setFilters: (x: { [key: string]: { [fn: string]: string } }) => void,
    filters: { [key: string]: { [fn: string]: string } },
    column: Column<any | unknown>
}) => {

    const property = column.columnDef.header?.valueOf() as string;
    const [selectedFilters, setSelectedFilters] = useState(filters[property] ?? {});
    const [changed, setChanged] = useState(false);
    const [open, setOpen] = useState(false);

    const onSubmit = (selectedFilters: { [fn: string]: string }) => {
        const newFilters = { ...filters };
        let isError = false;
        Object.entries(selectedFilters).forEach(([key, value]) => {
            if (value.includes(" ") && !/^(['"])(.*?)\1$/.test(value))
                isError = true;
            if (value === "")
                newFilters[property] = {};
            else {
                newFilters[property] = {
                    ...newFilters[property],
                    [key]: key != "in" ? value : `[${value}]`
                };
            }
        });
        if (isError) {
            setError("Please wrap your filter string with quotes as it contains whitespace characters.");
            setSelectedFilters(filters[property] ?? {});
        }
        else
            setFilters(newFilters);
        setOpen(false);
    };

    const button = <ActionButton icon={<Filter />} tooltip="Filter" variant={property in filters ? "primary" : undefined} />
    return (
        <BaseDropdown
            button={button}
            open={open}
            setOpen={setOpen}
            label={`Filter logs by`}
        >
            {filterModes.map((mode, index) =>
                <div
                    key={index}
                    className={`w-[300px] grid grid-cols-5 gap p-2 mx-1 rounded-lg items-center hover:bg-muted outline-none`}
                >
                    <span className="text-sm">{mode.name}</span>
                    <span className="flex justify-center scale-90">{mode.icon}</span>
                    <Input
                        className="col-span-3"
                        placeholder={"Enter a filter value.."}
                        onChange={() => setChanged(true)}
                        value={mode.fn in selectedFilters ? selectedFilters[mode.fn] : ""}
                        onInput={(input) => setSelectedFilters({ ...selectedFilters, [mode.fn]: input.currentTarget.value })}
                        onKeyDown={(e) => {
                            if (e.key === "Enter")
                                onSubmit(selectedFilters);
                        }}
                    />
                </div>
            )}
            {changed &&
                <div className="flex flex-row gap-3 justify-end p-2 mx-1 rounded-lg outline-none">
                    <SubmitButton text="Apply" onClick={() => onSubmit(selectedFilters)} />
                </div>
            }
        </BaseDropdown>
    );
}

export default ColumnFilter;
