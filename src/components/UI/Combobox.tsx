"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/UI/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/UI/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/UI/popover"

export interface ComboboxItem {
  value: string
  label: string
}

export interface ComboboxProps {
  items: ComboboxItem[]              // The list of selectable { value, label } pairs
  value: string                      // Currently selected value
  onValueChange: (newValue: string) => void
  placeholder?: string
  className?: string
}

/**
 * Combobox:
 * Renders a Button as a popover trigger, displaying the currently selected label or
 * a placeholder if nothing is selected. The popover allows filtering the items by text
 * and selecting one with onSelect.
 *
 * Now includes an onKeyDown handler in CommandInput to prevent backspace & other
 * keystrokes from propagating up to parent listeners (like “Backspace = delete logs”).
 */
export function Combobox({
  items,
  value,
  onValueChange,
  placeholder = "Select an item…",
  className = "",
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const currentItem = items.find((item) => item.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between px-2 py-1", className)}
        >
          {currentItem ? currentItem.label : placeholder}
          <ChevronsUpDown className="ml-1 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput
            placeholder="Search…"
            onKeyDown={(e) => {
              e.stopPropagation()
              e.nativeEvent.stopImmediatePropagation()
            }}
          />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  onSelect={(selectedValue) => {
                    onValueChange(selectedValue === value ? "" : selectedValue)
                    setOpen(false)
                  }}
                >
                  {item.label}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === item.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}