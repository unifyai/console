import { Label } from "@/components/UI/label";
import { Input } from "@/components/UI/input";
import { Slider } from "@/components/UI/slider";
import { useState, useEffect, useRef } from "react";

const SliderWithValue = ({label, ticks, value: initialValue, setValue, max, min, disabled = false}: {
    label: string
    ticks: number[],
    value: number,
    setValue: (value: number | undefined) => void
    disabled?: boolean,
    max?: number,
    min?: number
}) => {

  const maximum = max ? max : Math.max(...ticks);
  const minimum = min ? min : Math.min(...ticks);

  const [inputValue, setInputValue] = useState(String(initialValue));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(String(initialValue));
  }, [initialValue]);


  const onChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValueString = e.currentTarget.value;
    setInputValue(newValueString); // Update input value immediately

    if (newValueString === "") {
        setValue(undefined); // Allow empty input to set undefined value
        return; // Exit early for empty string
    }

    const parsedValue = parseFloat(newValueString);

    if (!isNaN(parsedValue)) { // Only proceed if it's a valid number (or becomes valid)
        let clampedValue = parsedValue;
        if (clampedValue < minimum) {
          clampedValue = minimum;
        } else if (clampedValue > maximum) {
          clampedValue = maximum;
        }
        setValue(clampedValue); // Update value on type for valid numbers
    }
    // If it's NaN, we *don't* setValue, keeping the last valid value.
    // The input field will still show the invalid string, but the slider/value won't update until a valid number is typed.
  };


  const handleBlur = () => {
    // Blur logic is simplified, mostly to ensure clamping if the value somehow went out of range due to typing inconsistencies.
    if (inputValue === "") {
        setValue(undefined); // Keep handling empty input on blur as well for consistency
        return;
    }

    const parsedValue = parseFloat(inputValue);

    if (!isNaN(parsedValue)) {
        let clampedValue = parsedValue;
        if (clampedValue < minimum) {
          clampedValue = minimum;
        } else if (clampedValue > maximum) {
          clampedValue = maximum;
        }
        setValue(clampedValue);
        setInputValue(String(clampedValue)); // Ensure input reflects clamped value on blur.
    } else {
        // If still NaN on blur (maybe due to copy-paste of invalid text), revert to minimum or handle as you see fit
        setValue(minimum); // Revert to minimum on blur if it's still invalid
        setInputValue(String(minimum));
    }
  };

  const onChangeSlider = (sliderValue: number[]) => {
      setValue(sliderValue[0]);
      setInputValue(String(sliderValue[0]));
  }


  return (
    <div className="flex flex-col gap-2 p-2 pb-4">
        <div className="flex items-center gap-10 justify-between">
            <Label>{label}</Label>
            <Input
              ref={inputRef}
              min={minimum}
              max={maximum}
              type="number"
              value={inputValue}
              onChange={onChangeInput} // Now handle validation in onChangeInput
              onBlur={handleBlur}      // Keep blur for final check and empty input
              className="h-8 max-w-[80px]"
              disabled={disabled}
            />
        </div>
        <div className="flex flex-col grow w-full px-2">
            <span
                className="mb-2 flex w-full items-center justify-between gap-2 text-xs font-medium text-muted-foreground"
                aria-hidden="true"
            >
                <span>{minimum}</span>
                <span>{maximum}</span>
            </span>
            <Slider
                className="w-full"
                value={[initialValue]}
                onValueChange={onChangeSlider}
                min={minimum}
                max={maximum}
                aria-label="Slider with input"
                disabled={disabled}
            />
        </div>
    </div>
  );
}

export default SliderWithValue;