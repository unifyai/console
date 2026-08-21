'use client';

import * as React from 'react';
import { Plus, SmilePlus } from 'lucide-react';
import { EmojiPicker } from '@/components/UI/emoji-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { cn } from '@/lib/utils';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

const PICKER_WIDTH = 280;
const PICKER_MAX_HEIGHT = 288;
const PICKER_MIN_HEIGHT = 200;
const VIEWPORT_PADDING = 16;
const COMPOSER_RESERVE = 96;
const POPOVER_SIDE_OFFSET = 6;

function measureExpandedPickerHeight(trigger: HTMLElement): number {
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - POPOVER_SIDE_OFFSET - COMPOSER_RESERVE;
  const spaceAbove = rect.top - POPOVER_SIDE_OFFSET - VIEWPORT_PADDING;
  const available = Math.max(spaceBelow, spaceAbove);

  return Math.max(PICKER_MIN_HEIGHT, Math.min(PICKER_MAX_HEIGHT, Math.floor(available)));
}

interface EmojiReactionPickerProps {
  disabled?: boolean;
  onSelect: (emoji: string) => void;
  className?: string;
  iconClassName?: string;
}

export function EmojiReactionPicker({
  disabled = false,
  onSelect,
  className,
  iconClassName,
}: EmojiReactionPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [pickerHeight, setPickerHeight] = React.useState(PICKER_MAX_HEIGHT);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useLayoutEffect(() => {
    if (!open || !expanded) {
      return;
    }

    const updatePickerHeight = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }
      setPickerHeight(measureExpandedPickerHeight(trigger));
    };

    updatePickerHeight();
    window.addEventListener('resize', updatePickerHeight);
    window.addEventListener('scroll', updatePickerHeight, true);

    return () => {
      window.removeEventListener('resize', updatePickerHeight);
      window.removeEventListener('scroll', updatePickerHeight, true);
    };
  }, [open, expanded]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setExpanded(false);
    }
  };

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
    setExpanded(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          data-testid="chat-reaction-picker"
          aria-label="Add reaction"
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        >
          <SmilePlus className={cn('h-3.5 w-3.5', iconClassName)} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={POPOVER_SIDE_OFFSET}
        avoidCollisions
        collisionPadding={{
          top: VIEWPORT_PADDING,
          bottom: COMPOSER_RESERVE,
          left: VIEWPORT_PADDING,
          right: VIEWPORT_PADDING,
        }}
        className={cn('w-auto', expanded ? 'overflow-hidden p-0' : 'p-2')}
      >
        {expanded ? (
          <EmojiPicker width={PICKER_WIDTH} height={pickerHeight} onSelect={handleSelect} />
        ) : (
          <div className="flex items-center gap-1">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                data-testid={`chat-reaction-${emoji}`}
                className="flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-muted"
                onClick={() => handleSelect(emoji)}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              data-testid="chat-reaction-expand"
              aria-label="More reactions"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setExpanded(true)}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
