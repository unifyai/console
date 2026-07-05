'use client';

import * as React from 'react';
import type { MessageReaction } from '@/types/assistants/chat';
import { cn } from '@/lib/utils';

interface MessageReactionsBarProps {
  reactions?: MessageReaction[];
  currentContactId?: number | null;
  onToggleReaction?: (emoji: string) => void;
  className?: string;
}

export function MessageReactionsBar({
  reactions = [],
  currentContactId,
  onToggleReaction,
  className,
}: MessageReactionsBarProps) {
  const grouped = React.useMemo(() => {
    const map = new Map<string, { emoji: string; count: number; includesCurrent: boolean }>();
    for (const reaction of reactions) {
      const entry = map.get(reaction.emoji);
      const isCurrent = reaction.contactId === currentContactId;
      if (entry) {
        entry.count += 1;
        entry.includesCurrent = entry.includesCurrent || isCurrent;
      } else {
        map.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          includesCurrent: isCurrent,
        });
      }
    }
    return Array.from(map.values());
  }, [reactions, currentContactId]);

  if (!grouped.length) return null;

  return (
    <div
      data-testid="chat-message-reactions"
      className={cn('mt-1 flex flex-wrap items-center gap-1', className)}
    >
      {grouped.map((group) => (
        <button
          key={group.emoji}
          type="button"
          data-testid={`chat-reaction-chip-${group.emoji}`}
          disabled={!onToggleReaction}
          onClick={() => onToggleReaction?.(group.emoji)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
            group.includesCurrent
              ? 'border-primary-tint-30 bg-accent-soft text-foreground'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
          )}
        >
          <span>{group.emoji}</span>
          {group.count > 1 && <span>{group.count}</span>}
        </button>
      ))}
    </div>
  );
}
