'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/UI/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';

export interface ComboboxItem {
  value: string;
  label: string;
}

export interface ComboboxProps {
  items: ComboboxItem[]; // The list of selectable { value, label } pairs
  value: string; // Currently selected value
  onValueChange: (newValue: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  /** Tailwind classes applied to the popover. Defaults to a fixed 200px width;
   *  pass e.g. "w-[--radix-popover-trigger-width]" to match the trigger width. */
  popoverClassName?: string;
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
  placeholder = 'Select an item…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No options found.',
  className = '',
  disabled = false,
  popoverClassName = 'w-[200px]',
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const currentItem = items.find((item) => item.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('justify-between px-2 py-1', className)}
        >
          <span className="truncate">{currentItem ? currentItem.label : placeholder}</span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('p-0', popoverClassName)}>
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            onKeyDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  // Make the human-readable label searchable too — by default
                  // cmdk only filters on the `value` (e.g. "America/New_York"),
                  // so without this typing "London" or "UTC" wouldn't match.
                  keywords={[item.label]}
                  onSelect={(selectedValue) => {
                    onValueChange(selectedValue === value ? '' : selectedValue);
                    setOpen(false);
                  }}
                >
                  {item.label}
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4',
                      value === item.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
