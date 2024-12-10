"use client"

import { Checkbox } from "@/components/UI/checkbox"
import { CheckedState } from "@radix-ui/react-checkbox"

export function LabeledCheckbox ({label, description, id, checked, onCheckedChange}: {
    id?: string
    label: string,
    description?: string,
    checked: CheckedState,
    onCheckedChange: (checked: CheckedState) => void
}) {
  return (
    <div className="items-top flex space-x-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <div className="grid gap-1.5 leading-none">
        <label
          htmlFor="terms1"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
        </label>
        {description && <p className="text-sm text-muted-foreground">
          {description}
        </p>}
      </div>
    </div>
  )
}
