import { ChevronDown } from 'lucide-react';
import { ReactNode } from 'react';

export interface Option {
  name: string;
  description?: string;
  label: string | ReactNode;
}

const InputWithStartSelect = ({
  options,
  option,
  onOptionChange,
  children,
}: {
  options: Option[];
  onOptionChange: (option: Option) => void;
  option?: Option;
  children: ReactNode;
}) => {
  return (
    <div className="flex w-full rounded-lg">
      <div className="relative">
        <select
          className="text-body focus-visible:ring-ring/20 peer inline-flex h-full appearance-none items-center rounded-none rounded-s-lg border border-input bg-background pe-8 ps-3 text-muted-foreground transition-shadow hover:bg-accent hover:text-foreground focus:z-10 focus-visible:border-ring focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Protocol"
          value={option?.name}
          onChange={(event) =>
            onOptionChange(options.find((o) => o.name === event.currentTarget.value)!)
          }
        >
          {options.map((option, index) => (
            <option key={index} value={option.name} className="text-center">
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 end-0 z-10 flex h-full w-9 items-center justify-center peer-disabled:opacity-50">
          <ChevronDown size={16} strokeWidth={2} aria-hidden="true" role="img" />
        </span>
      </div>
      {children}
    </div>
  );
};

export default InputWithStartSelect;
