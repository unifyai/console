"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/UI/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/UI/dropdown-menu";
import { Input } from "@/components/UI/input";
import { buildNestedDropdownTree } from "@/utils/interfaces/common";
import RenderMenuItems from "../Dropdowns/RenderMenuItems";
import Tooltip from "../Misc/Tooltip";

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
    const [searchQuery, setSearchQuery] = useState("");

    const handleOpen = (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen && onOpenChange) {
            onOpenChange();
        }
    };

    const filteredItems = useMemo(() => {
        if (!searchQuery) return items;
        return items.filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()));
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
                    className={`h-8 px-3 w-[200px] justify-between truncate backdrop-blur-sm bg-background/90 border border-border/50 shadow-md hover:bg-accent hover:text-accent-foreground transition-all duration-200 ${triggerClassName}`}
                    disabled={loading}
                >
                     <Tooltip content={displayValue}>
                        <span className="truncate">{displayValue}</span>
                    </Tooltip>
                    {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] p-0">
                <div className="flex flex-col gap-2">
                    <div className="p-2 border-b border-border">
                        <Input
                            placeholder={`Search ${type}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8"
                            // Prevent dropdown from closing when clicking input
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    {filteredItems.length === 0 ? (
                        <div className="text-center text-body py-2 px-2">No results found.</div>
                    ) : (
                        <div className="max-h-60 overflow-y-auto">
                           {Object.entries(tree.children).sort((a, b) => a[0].localeCompare(b[0])).map(([name, node], idx) => (
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