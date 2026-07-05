'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Plus, SmilePlus } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Theme as EmojiTheme, EmojiStyle, type EmojiClickData } from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { cn } from '@/lib/utils';

const FullEmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

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
  const [expanded, setExpanded] = React.useState(false);
  const { resolvedTheme } = useTheme();

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

  const emojiPickerTheme =
    resolvedTheme === 'dark'
      ? EmojiTheme.DARK
      : resolvedTheme === 'light'
        ? EmojiTheme.LIGHT
        : EmojiTheme.AUTO;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
      <PopoverContent
        align="start"
        className={cn(
          expanded
            ? 'w-auto border-0 bg-transparent p-0 shadow-none backdrop-blur-none'
            : 'w-auto p-2'
        )}
      >
        {expanded ? (
          <FullEmojiPicker
            open
            theme={emojiPickerTheme}
            emojiStyle={EmojiStyle.NATIVE}
            width={320}
            height={380}
            lazyLoadEmojis
            previewConfig={{ showPreview: false }}
            onEmojiClick={(data: EmojiClickData) => handleSelect(data.emoji)}
          />
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
