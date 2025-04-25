import * as React from "react";
import { Check, ChevronsUpDown, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/UI/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/UI/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/UI/popover";
import type { Assistant } from "@/types/team/assistant";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";

interface TaskAssignedFilterProps {
  options: Assistant[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  triggerIcon?: React.ReactNode;
  className?: string;
}

export function TaskAssignedFilter({
  options,
  selected,
  onChange,
  placeholder = "Select...",
  triggerIcon = <UserCircle className="mr-2 h-4 w-4" />, // Default icon
  className,
}: TaskAssignedFilterProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (assistantId: string) => {
    if (selected.includes(assistantId)) {
      onChange(selected.filter((id) => id !== assistantId));
    } else {
      onChange([...selected, assistantId]);
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const getAssistantName = (id: string) => {
      const assistant = options.find(a => a.id === id);
      return assistant ? `${assistant.firstName} ${assistant.lastName}` : 'Unknown';
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[200px] justify-between h-10", className)}
        >
            <div className="flex items-center gap-2 truncate">
                {triggerIcon}
                {selected.length > 1
                    ? `${selected.length} selected`
                    : selected.length === 1
                    ? getAssistantName(selected[0])
                    : placeholder}
            </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search assistants..." />
          <CommandList>
            <CommandEmpty>No assistants found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.id);
                return (
                  <CommandItem
                    key={option.id}
                    value={`${option.firstName} ${option.lastName} ${option.email}`}
                    onSelect={() => handleSelect(option.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                     <Avatar className="h-5 w-5 mr-2">
                        <AvatarImage src={option.avatarUrl} alt={`${option.firstName} ${option.lastName}`} />
                        <AvatarFallback className="text-xs">
                            {`${option.firstName?.[0] ?? ''}${option.lastName?.[0] ?? ''}`.toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{option.firstName} {option.lastName}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.length > 0 && (
                <>
                    <CommandSeparator />
                    <CommandGroup>
                         <CommandItem
                            onSelect={handleClearAll}
                            className="justify-center text-center text-xs text-muted-foreground cursor-pointer"
                        >
                            Clear selection
                        </CommandItem>
                    </CommandGroup>
                </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}