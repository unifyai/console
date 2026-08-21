'use client';

import * as React from 'react';
import { Check, MoreHorizontal } from 'lucide-react';
import { RAIL_TRAILING_GLYPH, RailTrailingButton } from '@/components/Layout/Shell/railGeometry';
import { EmojiPicker } from '@/components/UI/emoji-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { Input } from '@/components/UI/input';
import { cn } from '@/lib/utils';
import type { RosterGroup } from '@/types/orgChat';

const PICKER_WIDTH = 264;
const PICKER_HEIGHT = 260;

export interface GroupPatch {
  name?: string;
  icon?: string | null;
}

interface GroupRowSettingsProps {
  group: RosterGroup;
  onUpdate: (patch: GroupPatch) => Promise<boolean>;
  /**
   * Reported upward because this panel is a layer of its own: the switcher
   * popover it opens from treats any outside layer as a dismissal until it is
   * told one is deliberate.
   */
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * A chat group's whole settings surface: the name it goes by and the emoji it
 * wears. Both live under one hover-revealed "…" on the roster row rather than
 * a page of their own — a group chat is a handful of people and two fields.
 */
export function GroupRowSettings({
  group,
  onUpdate,
  onOpenChange,
  className,
}: GroupRowSettingsProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(group.name);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  React.useEffect(() => {
    if (open) setName(group.name);
  }, [open, group.name]);

  const trimmedName = name.trim();
  const canSaveName = trimmedName.length > 0 && trimmedName !== group.name;

  const submit = async (patch: GroupPatch) => {
    setIsSaving(true);
    const saved = await onUpdate(patch);
    setIsSaving(false);
    if (saved) handleOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <RailTrailingButton
          aria-label={`Settings for ${group.name}`}
          data-testid={`group-row-settings-${group.groupId}`}
          // The row underneath is itself a button; the press stops here.
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          className={cn(
            'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100',
            className
          )}
        >
          <MoreHorizontal className={RAIL_TRAILING_GLYPH} aria-hidden="true" />
        </RailTrailingButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={8}
        className="w-auto p-2"
        data-testid={`group-settings-panel-${group.groupId}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-2" style={{ width: PICKER_WIDTH }}>
          <div className="space-y-1">
            <label htmlFor={`group-name-${group.groupId}`} className="text-overline block">
              Name
            </label>
            <div className="flex items-center gap-1">
              <Input
                id={`group-name-${group.groupId}`}
                value={name}
                disabled={isSaving}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || !canSaveName) return;
                  event.preventDefault();
                  void submit({ name: trimmedName });
                }}
                className="h-8"
                data-testid={`group-settings-name-${group.groupId}`}
              />
              <button
                type="button"
                disabled={!canSaveName || isSaving}
                onClick={() => void submit({ name: trimmedName })}
                aria-label="Save name"
                data-testid={`group-settings-name-save-${group.groupId}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-overline">Icon</span>
              {group.icon ? (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void submit({ icon: null })}
                  data-testid={`group-settings-icon-clear-${group.groupId}`}
                  className="text-caption-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <EmojiPicker
              width={PICKER_WIDTH}
              height={PICKER_HEIGHT}
              skinTonesDisabled
              onSelect={(emoji) => void submit({ icon: emoji })}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
