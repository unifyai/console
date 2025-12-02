"use client"

import React, { useState } from 'react'
import { cn } from '@/utils/misc/cn'
import { 
  ChevronsUpDown,
  Check,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/UI/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/UI/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/UI/command"
import { renderSidebarIcon } from './utils'

// ============================================================================
// Types
// ============================================================================

export interface InterfaceItem {
  name: string;
  icon?: string;
}

export interface InterfacePickerProps {
  /** List of available interfaces */
  interfaces: InterfaceItem[];
  /** Currently selected interface */
  selectedInterface: InterfaceItem | null;
  /** Whether interfaces are loading */
  isLoading: boolean;
  /** Whether interfaces are being fetched (refetch) */
  isFetching?: boolean;
  /** Interface currently being transitioned to (shows loading state) */
  transitioningToInterface?: string | null;
  /** Whether an interface change is in progress */
  isChangingInterface?: boolean;
  /** Callback when an interface is selected */
  onSelect: (interfaceName: string) => void;
  /** Whether the popover is controlled externally */
  open?: boolean;
  /** Callback when popover open state changes */
  onOpenChange?: (open: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export function InterfacePicker({
  interfaces,
  selectedInterface,
  isLoading,
  isFetching = false,
  transitioningToInterface,
  isChangingInterface = false,
  onSelect,
  open: controlledOpen,
  onOpenChange,
}: InterfacePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Support both controlled and uncontrolled modes
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const handleSelect = (interfaceName: string) => {
    onSelect(interfaceName);
    setOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="flex-1 min-w-0 justify-between h-8 text-body-sm"
          data-testid="interface-picker-trigger"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            {renderSidebarIcon(selectedInterface?.icon, "h-4 w-4 flex-shrink-0", "interface")}
            <span className="truncate">{selectedInterface?.name || "Select interface"}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] min-w-[12rem] max-w-[20rem] p-0" 
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-testid="interface-picker-content"
      >
        <Command>
          <CommandInput placeholder="Search interfaces..." data-testid="interface-search-input" />
          {!isLoading && !isFetching && interfaces.length > 0 && (
            <CommandEmpty>No interface found.</CommandEmpty>
          )}
          <CommandGroup className='max-h-[250px] overflow-y-auto' style={{'scrollbarWidth': 'none'}}>
            {(isLoading || isFetching) ? (
              <div className="p-1" data-testid="interface-picker-loading">
                <div className="p-2 text-center text-caption text-muted-foreground mb-1">Loading interfaces...</div>
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-sm">
                    <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                    <div className="flex-1 h-4 bg-muted animate-pulse rounded" style={{ width: `${80 + i * 10}%` }} />
                  </div>
                ))}
              </div>
            ) : interfaces.length === 0 ? (
              <div className="p-3 text-center text-body text-muted-foreground" data-testid="interface-picker-empty">
                <svg className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                No interfaces in this project
              </div>
            ) : (
              interfaces.map((iface) => {
                const isSelected = selectedInterface?.name === iface.name;
                const isInterfaceLoading = isChangingInterface && transitioningToInterface === iface.name;
                return (
                  <CommandItem
                    key={iface.name}
                    value={iface.name}
                    onSelect={() => handleSelect(iface.name)}
                    className={cn("text-body-sm", isSelected && !isInterfaceLoading && "text-primary")}
                    data-testid={`interface-option-${iface.name}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 w-full">
                      {isInterfaceLoading ? (
                        renderSidebarIcon(iface.icon, "h-4 w-4 flex-shrink-0", "interface")
                      ) : isSelected ? (
                        <Check className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        renderSidebarIcon(iface.icon, "h-4 w-4 flex-shrink-0", "interface")
                      )}
                      <span className="truncate flex-1">{iface.name}</span>
                      {isInterfaceLoading && (
                        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                      )}
                    </div>
                  </CommandItem>
                );
              })
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default InterfacePicker;

