import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/UI/input";
import { Button } from "@/components/UI/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { Skeleton } from "@/components/UI/skeleton";
import { cn } from "@/utils/misc/cn";
import Fuse from "fuse.js";
import { Icon, IconName } from "@/components/UI/icon-picker";
import { iconsData } from "@/components/UI/icons-data";
import { useDebounceValue } from "usehooks-ts";

interface IconSelectorProps {
  value?: IconName;
  onValueChange?: (val: IconName) => void;
  searchable?: boolean;
}

const IconsColumnSkeleton = () => (
  <div className="flex flex-col gap-2 w-full">
    <Skeleton className="h-4 w-1/2 rounded-md" />
    <div className="grid grid-cols-5 gap-2 w-full">
      {Array.from({ length: 40 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-10 rounded-md" />
      ))}
    </div>
  </div>
);

export const IconSelector: React.FC<IconSelectorProps> = ({
  value,
  onValueChange,
  searchable = true,
}) => {
  const [rawSearch, setRawSearch] = useState("");
  const [search] = useDebounceValue(rawSearch, 150);
  const [isLoading, setIsLoading] = useState(false);

  // In real use we could lazy-load, but iconsData is already static import
  const iconsToUse = useMemo(() => iconsData, []);

  const fuseInstance = useMemo(() => {
    return new Fuse(iconsToUse, {
      keys: ["name", "tags", "categories"],
      threshold: 0.3,
      ignoreLocation: true,
      includeScore: true,
    });
  }, [iconsToUse]);

  const filteredIcons = useMemo(() => {
    if (search.trim() === "") return iconsToUse;
    return fuseInstance.search(search.trim().toLowerCase()).map((r) => r.item);
  }, [search, fuseInstance, iconsToUse]);

  const parentRef = useRef<HTMLDivElement>(null);

  // Grouping ----------------------------------------------------
  const categorizedIcons = useMemo(() => {
    if (search.trim() !== "") {
      return [{ name: "Search Results", icons: filteredIcons }];
    }

    const categories = new Map<string, typeof iconsData>();
    filteredIcons.forEach((icon) => {
      const cats = icon.categories && icon.categories.length ? icon.categories : ["Other"];
      cats.forEach((cat) => {
        if (!categories.has(cat)) categories.set(cat, [] as any);
        (categories.get(cat) as any).push(icon);
      });
    });
    return Array.from(categories.entries())
      .map(([name, icons]) => ({ name, icons }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredIcons, search]);

  // Render helpers
  const renderIconButton = useCallback(
    (iconName: IconName) => (
      <TooltipProvider key={iconName}>
        <Tooltip>
          <TooltipTrigger
            className={cn(
              "p-2 rounded-md border flex items-center justify-center transition cursor-pointer",
              value === iconName ? "bg-accent border-primary" : "hover:bg-foreground/10"
            )}
            data-icon={iconName}
            onClick={() => onValueChange?.(iconName)}
          >
            <Icon name={iconName} />
          </TooltipTrigger>
          <TooltipContent>
            <span>{iconName}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
    [onValueChange, value]
  );

  useEffect(() => {
    // Small artificial delay so the skeleton flashes only briefly
    setIsLoading(true);
    const t = setTimeout(() => setIsLoading(false), 150);
    return () => clearTimeout(t);
  }, []);

  // Scroll to selected icon on mount / value change
  useEffect(() => {
    if (!parentRef.current || !value) return;
    const el = parentRef.current.querySelector(`[data-icon="${value}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: "center" });
    }
  }, [value, isLoading, categorizedIcons]);

  return (
    <div className="w-full space-y-2">
      {searchable && (
        <Input
          placeholder="Search for an icon…"
          value={rawSearch}
          onChange={(e) => setRawSearch(e.target.value)}
        />
      )}
      <div
        ref={parentRef}
        className="max-h-60 overflow-auto command-scrollbar pr-1 space-y-4"
      >
        {isLoading ? (
          <IconsColumnSkeleton />
        ) : (
          categorizedIcons.map((cat) => (
            <div key={cat.name} id={`cat-${cat.name}`} className="space-y-2">
              <h3 className="text-caption text-strong capitalize pl-1 select-none">{cat.name}</h3>
              <div className="grid grid-cols-5 gap-2">
                {cat.icons.map((ic) => renderIconButton(ic.name as IconName))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}; 