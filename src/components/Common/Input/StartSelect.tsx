import { Input } from "@/components/UI/input";
import { ChevronDown } from "lucide-react";
import { FormEvent, ChangeEvent, ReactNode, KeyboardEventHandler } from "react";

export interface Option {name: string, label: string | ReactNode}

const InputWithStartSelect = ({ options, inputValue, option, onOptionChange, onKeyDown, onChange, onInput, placeholder, inputMode }:{
    options: Option[],
    onOptionChange: (option: Option) => void,
    onChange?: (event: any) => void,
    onInput?: (input: FormEvent<HTMLInputElement>) => void,
    inputValue?: string,
    option?: Option,
    onKeyDown?: KeyboardEventHandler,
    placeholder?: string,
    inputMode?: "search" | "email" | "tel" | "text" | "url" | "none" | "numeric" | "decimal" | undefined
}) => {
  return (
      <div className="flex rounded-lg shadow-sm shadow-black/5">
        <div className="relative">
          <select
            className="peer inline-flex h-full appearance-none items-center rounded-none rounded-s-lg border border-input bg-background pe-8 ps-3 text-sm text-muted-foreground transition-shadow hover:bg-accent hover:text-foreground focus:z-10 focus-visible:border-ring focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Protocol"
            value={option?.name}
            onChange={(event) => onOptionChange(
                options.find(o => o.name === event.currentTarget.value)!
              )
            }
          >
            {options.map((option, index) => <option key={index} value={option.name}>{option.label}</option>)}
          </select>
          <span className="pointer-events-none absolute inset-y-0 end-0 z-10 flex h-full w-9 items-center justify-center text-muted-foreground/80 peer-disabled:opacity-50">
            <ChevronDown size={16} strokeWidth={2} aria-hidden="true" role="img" />
          </span>
        </div>
        <Input
          id="input-17"
          className="-ms-px rounded-s-none shadow-none focus-visible:z-10"
          placeholder={placeholder}
          type="text"
          value={inputValue}
          onInput={onInput}
          onChange={onChange}
          onKeyDown={onKeyDown}
          inputMode={inputMode}
        />
      </div>
  );
}

export default InputWithStartSelect;