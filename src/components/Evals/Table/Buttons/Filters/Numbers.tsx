"use client";

import { useState } from "react";
import { FiltersByColumn } from "@/types/evals/columns";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import SubmitButton from "@/components/Common/Buttons/Submit";
import CancelButton from "@/components/Common/Buttons/Cancel";
import { Filter } from "lucide-react";
import { useSliderWithInput } from "@/hooks/useSliderWithInput";
import { Slider } from "@/components/UI/slider";
import { KeyboardEventHandler } from "react";
import InputWithStartSelect from "@/components/Common/Input/StartSelect";
import { Option } from "@/components/Common/Input/StartSelect";
import { DualRangeSlider } from "@/components/Common/Sliders/DualRange";

const NumericColumnFilter = ({ column, columnFilters, setColumnFilterQuery, boundaries }: {
    column: string,
    columnFilters: FiltersByColumn
    setColumnFilterQuery: (columnFilters: FiltersByColumn) => void,
    boundaries: {minimums: {[key: string]: number;}, maximums: {[key: string]: number}}
}) => {
    
    /* Track states */
    const [minValue, maxValue] = [boundaries.minimums[column], boundaries.maximums[column]]
    const initialValue = [
        columnFilters[column] && columnFilters[column][">"] ? parseFloat(columnFilters[column][">"]) : minValue ? minValue : 0,
        columnFilters[column] && columnFilters[column]["<"] ? parseFloat(columnFilters[column]["<"]) : maxValue ? maxValue : 0
    ]
    const { sliderValue, inputValues, validateAndUpdateValue, handleInputChange, handleSliderChange } = useSliderWithInput({ minValue, maxValue, initialValue });
    const changed = 
        parseFloat(inputValues[0]) != initialValue[0] || 
        parseFloat(inputValues[1]) != initialValue[1]
    
    /* Handle submit */
    const onSubmit = () => {
        let newColumnFilters = { ...columnFilters };
    
        if (inputValues[0] || inputValues[1]) { // Combine both conditions
            newColumnFilters[column] = { ...(newColumnFilters[column] || {}) };
    
            if (inputValues[0]) {
                const minFunctionName = minOption.name;
                newColumnFilters[column][minFunctionName] = inputValues[0];
            }
    
            if (inputValues[1]) {
                const maxFunctionName = maxOption.name;
                newColumnFilters[column][maxFunctionName] = inputValues[1];
            }
        } else {  // No filters applied
            newColumnFilters = Object.fromEntries(
                Object.entries(columnFilters).filter(([key, _]) => key != column)
            );
            validateAndUpdateValue(minValue.toString(), 0);
            validateAndUpdateValue(maxValue.toString(), 1);
        }
    
        setColumnFilterQuery(newColumnFilters);
    };
    const onReset = () => {
        const newColumnFilters = Object.fromEntries(
            Object.entries(columnFilters).filter(([key, _]) => key != column)
        )
        validateAndUpdateValue(minValue.toString(), 0)
        validateAndUpdateValue(maxValue.toString(), 1)
        setColumnFilterQuery(newColumnFilters)
    }
    const onEnter : KeyboardEventHandler = (event) => {
        if (event.key === "Enter") {
            onSubmit()
        }
    }

    /* Inputs */
    const minOptions = [ {name: ">", label: "Greater than"}, {name: "=>", label: "Greater or equal to"} ]
    const maxOptions = [ {name: "<", label: "Lower than"}, {name: "<=", label: "Lower or equal to"} ]
    const initialOptions = [
        (columnFilters[column] && columnFilters[column][">"]) ? minOptions[0] : (columnFilters[column] && columnFilters[column][">="]) ? minOptions[1] : minOptions[0],
        (columnFilters[column] && columnFilters[column]["<"]) ? maxOptions[0] : (columnFilters[column] && columnFilters[column]["=<"]) ? maxOptions[1] : maxOptions[0],
    ] 
    const [minOption, setMinOption] = useState<Option>(initialOptions[0])
    const [maxOption, setMaxOption] = useState<Option>(initialOptions[1])
    const sliderStep = (maxValue - minValue) / 100
    const filterInput = 
    <div className="items-center">
        <DualRangeSlider
            className="grow"
            value={sliderValue}
            onValueChange={handleSliderChange}
            min={minValue}
            max={maxValue}
            step={sliderStep}
        />
        <div className="flex flex-row gap-5 justify-between pt-4">
            <InputWithStartSelect
                options={minOptions}
                option={minOption}
                placeholder={`Filter for entries ${minOption.name === ">" ? "greater than" : "greater or equal to"}..`}
                inputValue={inputValues[0]}
                onChange={(e) => handleInputChange(e, 0)}
                onInput={() => validateAndUpdateValue(inputValues[0], 0)}
                onKeyDown={onEnter}
                onOptionChange={setMinOption}
                inputMode="decimal"
            />
            <InputWithStartSelect
                options={maxOptions}
                option={maxOption}
                placeholder={`Filter for entries ${maxOption.name === "<" ? "lower than" : "lower or equal to"}..`}
                inputValue={inputValues[1]}
                onChange={(e) => handleInputChange(e, 1)}
                onInput={() => validateAndUpdateValue(inputValues[1], 1)}
                onKeyDown={onEnter}
                onOptionChange={setMaxOption}
                inputMode="decimal"
            />
        </div>
    </div>
    const button = <ActionButton icon={<Filter/>} tooltip="Filter" variant={column in columnFilters ? "primary" : undefined} />
    const reset = <CancelButton text="Reset" onClick={() => onReset()}/>
    const submit = <SubmitButton text="Apply" onClick={() => onSubmit()}/>
    return (
        <BaseDropdown button={button} label={`Filter logs by ${column} value`}>
            <div className="flex flex-col gap-2 p-2">
                {filterInput}
                {changed && 
                    <div className="flex flex-row gap-2 justify-end">
                        {reset}
                        {submit}
                    </div>
                }
            </div>
        </BaseDropdown>
    );
}

export default NumericColumnFilter;
