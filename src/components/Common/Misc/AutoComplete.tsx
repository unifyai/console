"use client"

import * as React from "react"
import { useEffect } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/UI/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/UI/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/UI/popover"

export default function AutoComplete ({items, type, defaultValue, onSelect, isOpen, disabled, loading, onOpen, className}: {
    items: {value:string, label: string, icon?: React.ReactNode, disabled?: boolean}[],
    type: string,
    defaultValue?: string,
    onSelect: (currentValue: string) => void,
    isOpen?: boolean,
    disabled?: boolean,
    loading?: boolean,
    onOpen?: () => void,
    className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(defaultValue || "")
  const [icon, setIcon] = React.useState<React.ReactNode | undefined>(undefined);
  useEffect(() => {setValue(defaultValue || "")}, [defaultValue])
  const onOpenChange = (o: boolean) => {
    if (onOpen && o) onOpen();
    setOpen(o);
  }
  const label = items.find((item) => item.value === value)?.label;
  return (
    <Popover open={isOpen != undefined ? isOpen : open} onOpenChange={(o) => onOpenChange(o)}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen != undefined ? isOpen : open}
          className={`h-8 px-3 w-[200px] justify-between truncate backdrop-blur-sm bg-background/90 border border-border/50 shadow-md hover:bg-accent hover:text-accent-foreground transition-all duration-200 ${className}`}
          disabled={disabled}
        >
          {icon && icon}
          {value && label
            ? (type.includes("axis") ? label?.slice(0, 15) + (label?.length > 15 ? "..." : "") : label)
            : type == "Actions" ? "Search Actions..." : `Select ${type}...`}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        {loading ? <div className="h-10 flex justify-center items-center">
            <Loader2 className="animate-spin" />
          </div> :
          <Command>
            <CommandInput placeholder={`Search ${type}...`} className="h-10 bg-transparent border-none [&_[cmdk-input-wrapper]]:border-none" disabled={disabled} />
            <CommandList>
              <CommandEmpty>{`No ${type} found.`}</CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.value}
                    disabled={item.disabled}
                    onSelect={(currentValue) => {
                      setValue(currentValue === value ? "" : currentValue);
                      setIcon(currentValue === value ? undefined : item?.icon);
                      onSelect(currentValue === value ? "" : currentValue);
                      setOpen(false)
                    }}
                    className="h-10 cursor-pointer"
                  >
                    {item.icon && item.icon}
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
          </Command>}
      </PopoverContent>
    </Popover>
  )
}
