'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Input } from '@/components/UI/input';
import { buildNestedDropdownTree } from '@/utils/interfaces/common';
import RenderMenuItems from '../Dropdowns/RenderMenuItems';
import Tooltip from '../Misc/Tooltip';

interface SelectionCommandProps {
  type: string;
  items: string[];
  value: string | null | undefined;
  onSelect: (value: string) => void;
  loading?: boolean;
  onOpenChange?: () => void;
  defaultOpen?: boolean;
  rootDisplayName?: string;
  triggerClassName?: string;
}

const SelectionCommand = ({
  type,
  items,
  value,
  onSelect,
  loading = false,
  onOpenChange,
  defaultOpen = false,
  rootDisplayName,
  triggerClassName,
}: SelectionCommandProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && onOpenChange) {
      onOpenChange();
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    return items.filter((name) => name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [items, searchQuery]);

  const tree = buildNestedDropdownTree(filteredItems);

  const displayValue = value || `Select ${type}...`;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`bg-background/90 border-border/50 h-7 w-[200px] justify-between truncate border px-2 shadow-md backdrop-blur-sm transition-all duration-200 hover:bg-accent hover:text-accent-foreground ${triggerClassName}`}
          disabled={loading}
        >
          <Tooltip content={displayValue}>
            <span className="text-body-sm truncate">{displayValue}</span>
          </Tooltip>
          {loading ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] p-0">
        <div className="flex flex-col gap-2">
          <div className="border-b border-border p-2">
            <Input
              placeholder={`Search ${type}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              // Prevent dropdown from closing when clicking input
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {filteredItems.length === 0 ? (
            <div className="text-body-sm px-2 py-1.5 text-center">No results found.</div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {Object.entries(tree.children)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([name, node], idx) => (
                  <RenderMenuItems
                    key={idx}
                    node={node}
                    nodeName={name}
                    isTopLevel={true}
                    selectableNodes={items}
                    attr={value}
                    setter={(selectedValue) => {
                      onSelect(selectedValue);
                      setOpen(false);
                    }}
                    rootDisplayName={rootDisplayName}
                  />
                ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SelectionCommand;
