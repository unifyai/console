"use client"

import * as React from "react"
import { useEffect } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/UI/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/UI/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/UI/popover"

export default function AutoComplete ({items, type, defaultValue, onSelect, isOpen, disabled, loading, onOpen, className, onOpenChange, displayMode = 'button', triggerIcon}: {
    items: {value:string, label: string, icon?: React.ReactNode, disabled?: boolean}[],
    type: string,
    defaultValue?: string,
    onSelect: (currentValue: string) => void,
    isOpen?: boolean,
    disabled?: boolean,
    loading?: boolean,
    onOpen?: () => void,
    className?: string,
    onOpenChange?: (open: boolean) => void;
    displayMode?: 'button' | 'icon';
    triggerIcon?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(defaultValue || "")
  const [icon, setIcon] = React.useState<React.ReactNode | undefined>(undefined);
  
  useEffect(() => { setValue(defaultValue || "") }, [defaultValue]);

  const handleOpenChange = (o: boolean) => {
    if (onOpen && o) onOpen();
    if(onOpenChange) {
        onOpenChange(o);
    } else {
        setOpen(o);
    }
  }

  const effectiveOpen = isOpen !== undefined ? isOpen : open;
  const label = items.find((item) => item.value === value)?.label;

  return (
    <Popover open={effectiveOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={effectiveOpen}
          className={cn(
            `h-7 backdrop-blur-sm bg-background/90 border border-border/50 shadow-md hover:bg-accent hover:text-accent-foreground transition-all duration-200`,
            displayMode === 'icon' ? 'w-7 px-2 justify-center' : 'w-[200px] px-2 justify-between',
            className
          )}
          disabled={disabled}
        >
          {displayMode === 'icon' ? triggerIcon : (
            <>
              {icon && icon}
              {value && label
                ? (type.includes("axis") ? label?.slice(0, 15) + (label?.length > 15 ? "..." : "") : label)
                : `Select ${type}...`}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        {loading ? <div className="h-10 flex justify-center items-center">
            <Loader2 className="animate-spin" />
          </div> :
          <Command>
            <CommandInput placeholder={`Search ${type}...`} className="bg-transparent border-none [&_[cmdk-input-wrapper]]:border-none" disabled={disabled} />
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
                      onSelect(item.label);
                      handleOpenChange(false)
                    }}
                    className="h-8 cursor-pointer text-body-sm"
                  >
                    {item.icon && <div className="mr-2">{item.icon}</div>}
                    {item.label}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        value === item.label ? "opacity-100" : "opacity-0"
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
