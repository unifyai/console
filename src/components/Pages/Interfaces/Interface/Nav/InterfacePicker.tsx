'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronsUpDown, Check, Loader2 } from 'lucide-react';
import { Loader } from '@/components/Common/Loader';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/UI/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/UI/command';
import Tooltip from '@/components/Common/Misc/Tooltip';
import { renderSidebarIcon } from './utils';

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

  // Sort interfaces with selected/transitioning at top
  const sortedInterfaces = useMemo(() => {
    return [...interfaces].sort((a, b) => {
      const aIsSelected = a.name === selectedInterface?.name;
      const bIsSelected = b.name === selectedInterface?.name;
      const aIsTransitioning = a.name === transitioningToInterface;
      const bIsTransitioning = b.name === transitioningToInterface;

      // Transitioning item first, then selected, then rest alphabetically
      if (aIsTransitioning && !bIsTransitioning) return -1;
      if (bIsTransitioning && !aIsTransitioning) return 1;
      if (aIsSelected && !bIsSelected) return -1;
      if (bIsSelected && !aIsSelected) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [interfaces, selectedInterface?.name, transitioningToInterface]);

  // Determine what to show in the trigger
  const displayInterface = transitioningToInterface
    ? interfaces.find((i) => i.name === transitioningToInterface)
    : selectedInterface;
  const displayName = displayInterface?.name || transitioningToInterface;

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="bg-background/60 h-9 min-w-0 flex-1 justify-between rounded-lg border-border shadow-sm hover:border-primary-tint-50 hover:bg-accent-soft"
          data-testid="interface-picker-trigger"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            {isChangingInterface ? (
              <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" />
            ) : (
              renderSidebarIcon(displayInterface?.icon, 'h-3.5 w-3.5 flex-shrink-0', 'interface')
            )}
            <span className="text-label truncate font-medium">
              {displayName || 'Select interface'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="bg-popover/95 w-[var(--radix-popover-trigger-width)] max-w-[20rem] overflow-hidden rounded-xl border-border p-0 shadow-pop backdrop-blur-sm"
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-testid="interface-picker-content"
        side="bottom"
        align="start"
        sideOffset={4}
        avoidCollisions={true}
        collisionPadding={{ top: 100, bottom: 100, left: 16, right: 16 }}
      >
        <Command>
          <CommandInput
            placeholder="Search interfaces..."
            className="text-label"
            data-testid="interface-search-input"
          />
          <CommandList className="max-h-[300px] overflow-hidden p-0">
            <ScrollArea className="h-[250px]">
              {!isLoading && !isFetching && interfaces.length > 0 && (
                <CommandEmpty className="text-label px-2 py-3">No interface found.</CommandEmpty>
              )}
              <CommandGroup>
                {isLoading || isFetching ? (
                  <div
                    className="flex flex-col items-center justify-center gap-2 p-4"
                    data-testid="interface-picker-loading"
                  >
                    <Loader size={20} />
                    <div className="text-caption">Loading interfaces...</div>
                  </div>
                ) : interfaces.length === 0 ? (
                  <div
                    className="text-caption p-3 text-center"
                    data-testid="interface-picker-empty"
                  >
                    <svg
                      className="text-muted-foreground/50 mx-auto mb-2 h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                      />
                    </svg>
                    No interfaces in this project
                  </div>
                ) : (
                  sortedInterfaces.map((iface) => {
                    const isSelected = selectedInterface?.name === iface.name;
                    const isInterfaceLoading =
                      isChangingInterface && transitioningToInterface === iface.name;
                    return (
                      <CommandItem
                        key={iface.name}
                        value={iface.name}
                        onSelect={() => handleSelect(iface.name)}
                        className={cn(
                          'text-label max-w-full overflow-hidden rounded-lg',
                          isSelected &&
                            !isInterfaceLoading &&
                            'bg-accent-soft text-accent-soft-foreground'
                        )}
                        data-testid={`interface-option-${iface.name}`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {isInterfaceLoading ? (
                            <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" />
                          ) : isSelected ? (
                            <Check className="h-3.5 w-3.5 flex-shrink-0" />
                          ) : (
                            renderSidebarIcon(iface.icon, 'h-3.5 w-3.5 flex-shrink-0', 'interface')
                          )}
                          <div className="w-0 min-w-0 flex-1 overflow-hidden">
                            <Tooltip content={iface.name} side="right">
                              <div className="truncate text-left">{iface.name}</div>
                            </Tooltip>
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })
                )}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default InterfacePicker;
