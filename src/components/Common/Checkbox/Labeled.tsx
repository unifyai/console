"use client"

import { Checkbox } from "@/components/UI/checkbox"
import { CheckedState } from "@radix-ui/react-checkbox"

export function LabeledCheckbox ({label, description, id, checked, onCheckedChange, descriptionOnHover}: {
  id?: string,
  label: string,
  description?: string,
  checked: CheckedState,
  onCheckedChange: (checked: CheckedState) => void,
  descriptionOnHover?: boolean,
}) {
  return (
    <div className="items-top flex space-x-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <div className="grid leading-none">
        <label
          htmlFor="terms1"
          className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${descriptionOnHover ? 'peer' : ''}`}
        >
          {label}
        </label>
        {description && (
          <div className={`overflow-hidden transition-all duration-300 ${descriptionOnHover ? 'max-h-0 peer-hover:max-h-[100px]' : 'max-h-[100px]'}`}>
            <p className="text-sm text-muted-foreground pt-1">
              {description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}