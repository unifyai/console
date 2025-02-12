"use client"

import * as React from "react"
import { useEffect } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/UI/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/UI/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/UI/popover"

export default function AutoComplete ({items, type, defaultValue, onSelect, onOpen, className}: {
    items: {value:string, label: string}[],
    type: string,
    defaultValue?: string,
    onSelect: (currentValue: string) => void,
    onOpen?: () => void,
    className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(defaultValue || "")
  useEffect(() => {setValue(defaultValue || "")}, [defaultValue])
  const onOpenChange = (o: boolean) => {
    if (onOpen && o) onOpen();
    setOpen(o);
  }
  const label = items.find((item) => item.value === value)?.label;
  return (
    <Popover open={open} onOpenChange={(o) => onOpenChange(o)}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`h-8 px-3 w-[200px] justify-between truncate ... ${className}`}
        >
          {value && label
            ? (type.includes("axis") ? label?.slice(0, 15) + (label?.length > 15 ? "..." : "") : label)
            : `Select ${type}...`}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={`Search ${type}...`} className="h-10" />
          <CommandList>
            <CommandEmpty>{`No ${type} found.`}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? "" : currentValue);
                    onSelect(currentValue === value ? "" : currentValue);
                    setOpen(false)
                  }}
                  className="h-10"
                >
                  {item.label}
                  <Check
                    className={cn(
                      "ml-auto",
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
