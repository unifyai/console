'use client';

import * as React from 'react';
import { SmilePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { cn } from '@/lib/utils';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

interface EmojiReactionPickerProps {
  disabled?: boolean;
  onSelect: (emoji: string) => void;
  className?: string;
}

export function EmojiReactionPicker({
  disabled = false,
  onSelect,
  className,
}: EmojiReactionPickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          data-testid="chat-reaction-picker"
          aria-label="Add reaction"
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        >
          <SmilePlus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="flex items-center gap-1">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              data-testid={`chat-reaction-${emoji}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-muted"
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
