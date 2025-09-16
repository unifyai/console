import { Input } from "@/components/UI/input";
import { cn } from "@/lib/utils";
import React from "react";
import { KeyboardEventHandler } from "react";
import { rebaseDate } from "@/utils/interfaces/table/filters";
import { AbsoluteDateString, RelativeDateString } from "@/types/interfaces/filters";

export type TimeType = "year" | "month" | "day" | "minutes" | "seconds" | "hours" | "milliseconds"; 
export type Attributes = {[key in TimeType]: { symbol: string, padding: number, min: number, max: number, format: RegExp }}

/** Defining constants for each data type
 * symbol: character show on the input to indicate its type
 * padding: number of zeros to pad at the start of a value to convert an input to string
 * min: minimum value of the input, may vary depending on relative vs absolute time
 * max: maximum value of the input
 * format: RegEx to define the range of allowed values, may vary depending on relative vs absolute time
*/
const getAttributes = (relative: boolean) : Attributes => { 
  const [minMonth, minDay] = relative ? [0, 0] : [1, 1];
  const maxYear = relative ? 9999 : new Date().getFullYear();
  const [regExMonth, regExDay] = relative ? [/^(0[0-9]|1[0-2])$/, /^(0[0-9]|1[0-9]|2[0-9]|3[0-1])$/] : [/^(0[1-9]|1[0-2])$/, /^(0[1-9]|1[0-9]|2[0-9]|3[0-1])$/]
  return {
    "year":         {symbol: "Y",  padding: 4, max: maxYear, min: 0,        format: /^[0-9][0-9][0-9][0-9]$/},
    "month":        {symbol: "M",  padding: 2, max: 12,      min: minMonth, format: regExMonth},
    "day":          {symbol: "D",  padding: 2, max: 31,      min: minDay,   format: regExDay},
    "hours":        {symbol: "h",  padding: 2, max: 24,      min: 0,        format: /^(0[0-9]|1[0-9]|2[0-3])$/},
    "minutes":      {symbol: "m",  padding: 2, max: 60,      min: 0,        format: /^[0-5][0-9]$/},
    "seconds":      {symbol: "s",  padding: 2, max: 60,      min: 0,        format: /^[0-5][0-9]$/},
    "milliseconds": {symbol: "ms", padding: 3, max: 999,     min: 0,        format: /^[0-9][0-9][0-9]$/}
  }
}
/* Clamp the value to the valid boundaries and pad with the necessary number of zeros per input type */
export function getValidValue(value: string, type: TimeType, loop: boolean = false, attributes: Attributes) {
  if (attributes[type].format.test(value)) return value;
  let numericValue = parseInt(value, 10);
  if (!isNaN(numericValue)) {
    if (!loop) {
      if (numericValue > attributes[type].max) numericValue = attributes[type].max;
      if (numericValue < attributes[type].min) numericValue = attributes[type].min;
    } else {
      if (numericValue > attributes[type].max) numericValue = attributes[type].min;
      if (numericValue < attributes[type].min) numericValue = attributes[type].max;
    }
    return numericValue.toString().padStart(attributes[type].padding, "0");
  }
  return "0".repeat(attributes[type].padding);
}

/* Extract and validate the corresponding part from the full datetime input, or the difference between the current time and the datetime input */
export function getDateValue(date: AbsoluteDateString, type: TimeType, attributes: Attributes) {
  let value: string;
  const dateValue = new Date(date)
  switch (type) {
    case "year":
      value = String(dateValue.getFullYear());
      return getValidValue(value, "year", false, attributes)
    case "month":
      value = String(dateValue.getMonth() + 1);  // Months are 0 indexed
      return getValidValue(value, "month", false, attributes)
    case "day":
      value = String(dateValue.getDate());
      return getValidValue(value, "day", false, attributes)
    case "hours":
      value = String(dateValue.getHours());
      return getValidValue(value, "hours", false, attributes)
    case "minutes":
      value = String(dateValue.getMinutes());
      return getValidValue(value, "minutes", false, attributes)
    case "seconds":
      value = String(dateValue.getSeconds());
      return getValidValue(value, "seconds", false, attributes)
    case "milliseconds":
      value = String(dateValue.getMilliseconds());
      return getValidValue(value, "milliseconds", false, attributes)
    default:
      return "00";
  }
}

/* Update the full relative datetime value by deconstructing the value, updating the corresponding type input and reconstructing into a single string */
export function setRelativeDateValue(date: RelativeDateString, value: string, type: TimeType, attributes: Attributes) {
  const dateObject = date.split(";");
  const index = Object.entries(attributes).findIndex(([key, _]) => key === type)
  const symbol= attributes[type].symbol
  dateObject[index] = `${value}${symbol}`
  return dateObject.join(";")
}

/* Update the full datetime input with the corresponding part, or the difference between the current time and the corresponding part  */
export function setDateValue(date: AbsoluteDateString, value: string, type: TimeType, attributes: Attributes){
  const valid = getValidValue(value, type, false, attributes);
  const parsed = parseInt(valid, 10)
  let newDate = new Date(date)
  switch (type) {
    case "year":
      newDate.setFullYear(parsed)
      break;
    case "month":
      newDate.setMonth(parsed - 1) // Months are 0 indexed
      break;
    case "day":
      newDate.setDate(parsed)
      break;
    case "hours":
      newDate.setHours(parsed)
      break;
    case "minutes":
      newDate.setMinutes(parsed)
      break;
    case "seconds":
      newDate.setSeconds(parsed)
      break;
    case "milliseconds":
      newDate.setMilliseconds(parsed)
      break;
  }
  return newDate.toISOString();
}

/* Handle updating the input value using up and down arrow keys */
export function getIncrement( value: string, type: TimeType, step: number, attributes: Attributes ) {
  let numericValue = parseInt(value, 10);
  if (!isNaN(numericValue)) {
    numericValue += step;
    return getValidValue(String(numericValue), type, true, attributes);
  }
  return "0".repeat(attributes[type].padding);
}

export interface DateTimeInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  picker: TimeType;
  date: AbsoluteDateString | RelativeDateString;
  setDate: (date: AbsoluteDateString | RelativeDateString) => void;
  onRightFocus?: () => void;
  onLeftFocus?: () => void;
  relative: boolean;
  onEnter?: KeyboardEventHandler;
}
const DateTimeInput = React.forwardRef<
  HTMLInputElement, 
  DateTimeInputProps
>(
  (
    {
      className,
      type = "tel",
      value,
      id,
      name,
      relative = false,
      date,
      setDate,
      onChange,
      onKeyDown,
      picker,
      onLeftFocus,
      onRightFocus,
      onEnter,
      ...props
    },
    ref
  ) => {
 
    /* Handle absolute vs relative time computation */
    const attributes = React.useMemo(() => getAttributes(relative), [relative]);
    const initialOffset = React.useMemo(() => {
      if (relative) {
        const dateObject = (rebaseDate(date, "relative") as RelativeDateString).split(";");
        const index = Object.entries(attributes).findIndex(([key, _]) => key === picker)
        const value = +dateObject[index].replace(/[^0-9]/g, '');
        return value
      }
      return 0;
    }, [date, picker, relative, attributes]);
    React.useEffect(() => {
      if (relative) {
        const dateObject = (rebaseDate(date, "relative") as RelativeDateString).split(";");
        const index = Object.entries(attributes).findIndex(([key, _]) => key === picker)
        const value = +dateObject[index].replace(/[^0-9]/g, '');
        const offset = Math.max(0, value)
        setOffset(offset)
      }
    }, [relative, date, picker, attributes])
    const [offset, setOffset] = React.useState(initialOffset);

    /* Track input and date value */
    const [inputChars, setInputChars] = React.useState(0);
    const [lastInputTime, setLastInputTime] = React.useState<number | null>(null)
    const calculatedValue = React.useMemo(() => { 
      if (relative) return String(offset);
      const dateValue = rebaseDate(date, "absolute") as AbsoluteDateString;
      const value = getDateValue(dateValue, picker, attributes)
      return value; 
    }, [date, picker, attributes, offset, relative]);
    
    /* Event handler:
      - Moves to the next / previous input item when pressing right / left arrow
      - Increments the input value with 1 / -1 when pressing up / down arrow
      - Updates the input value with typed numbers, tracking time since last input
      - Reset the input when typing a new value after a given amount of time
    */
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      
      if (onEnter) onEnter(e);
      if (e.key === "Tab") return;
      e.preventDefault();
      
      if (e.key === "ArrowRight") onRightFocus?.();
      if (e.key === "ArrowLeft") onLeftFocus?.();
      
      if (["ArrowUp", "ArrowDown"].includes(e.key)) {
        const step = e.key === "ArrowUp" ? 1 : -1;
        const newOffset = Math.max(0, offset + step);
        const newValue = relative ? String(newOffset) : getIncrement(calculatedValue, picker, step, attributes);
        const newDate = relative
          ? setRelativeDateValue(date as RelativeDateString, newValue, picker, attributes) as RelativeDateString
          : setDateValue(date as AbsoluteDateString, newValue, picker, attributes) as AbsoluteDateString
        setOffset(newOffset);
        setDate(newDate);
      }

      if (e.key >= "0" && e.key <= "9") {
        const currentTime = Date.now();
        const timeDiff = lastInputTime ? currentTime - lastInputTime : Infinity;

        let newValue: string;

        if (relative) {
          if (timeDiff > 2000 || inputChars === 0) {
            newValue = e.key; // Start with the pressed key
            setInputChars(1);
          } else {
            if (inputChars < attributes[picker].padding) {
              newValue = offset.toString() + e.key;  // Append the new key
              setInputChars(prev => prev + 1);
            } else {
              newValue = offset.toString(); // Keep the current value
            }
          }
          newValue = newValue.slice(0, attributes[picker].padding);  // Limit length
        } else {
          if (timeDiff > 2000 || inputChars === 0) {
            newValue = "0".repeat(attributes[picker].padding - 1) + e.key;
            setInputChars(1);
          } else {
            if (inputChars < attributes[picker].padding) {
              newValue = calculatedValue.substring(1) + e.key;
              setInputChars(prev => prev + 1);
            } else {
              newValue = calculatedValue;
            }
          }
        }

        const newDate = relative
          ? setRelativeDateValue(date as RelativeDateString, newValue, picker, attributes) as RelativeDateString
          : setDateValue(date as AbsoluteDateString, newValue, picker, attributes) as AbsoluteDateString
        setOffset(parseInt(newValue, 10) || 0)
        setDate(newDate);
        setLastInputTime(currentTime);

        if (inputChars === attributes[picker].padding - 1) {
          setInputChars(0);
          onRightFocus?.();
        }
      }
    };
 
    return (
      <div className="relative items-center group">

      {relative &&
        <span className="pointer-events-none absolute inset-y-0 start-1.5 pe-3 text-caption text-strong flex items-center group-focus-within:text-accent-foreground">-</span>
      }

      <Input 
        ref={ref}
        id={id || picker}
        name={name || picker}
        className={cn(
          "w-[54px] rounded-none text-start font-mono text-body tabular-nums caret-transparent focus:bg-accent focus:text-accent-foreground [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
        value={value || calculatedValue}
        onChange={(e) => {
          e.preventDefault();
          onChange?.(e);
        }}
        type={type}
        inputMode="decimal"
        onKeyDown={(e) => {
          onKeyDown?.(e);
          handleKeyDown(e);
        }}
      />
  
      <span className="pointer-events-none absolute inset-y-0 end-0 pe-3 text-caption flex items-center text-muted-foreground group-focus-within:text-accent-foreground">{attributes[picker].symbol}</span>
  
    </div>
  
    );
  }
)

DateTimeInput.displayName = "DateTimeInput";
 
export { DateTimeInput };

/* Original component: https://time.openstatus.dev/ */
/* 
  Fixing typing and increments
*/