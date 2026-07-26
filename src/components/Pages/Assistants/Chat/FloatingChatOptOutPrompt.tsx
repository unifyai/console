'use client';

import { createPortal } from 'react-dom';
import { Button } from '@/components/UI/button';

interface FloatingChatOptOutPromptProps {
  onKeep: () => void;
  onDisable: () => void;
}

/**
 * Soft follow-up after the first floating-chat dismiss. Session hide already
 * happened; this only asks whether the floater should keep auto-appearing.
 */
export function FloatingChatOptOutPrompt({ onKeep, onDisable }: FloatingChatOptOutPromptProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed bottom-14 right-5 z-[46] w-72 rounded-lg border border-border bg-background p-3 text-foreground shadow-2xl"
      data-testid="floating-chat-opt-out-prompt"
      role="dialog"
      aria-labelledby="floating-chat-opt-out-title"
    >
      <p id="floating-chat-opt-out-title" className="text-body font-medium">
        Appear again when you leave chat?
      </p>
      <p className="text-caption mt-1 text-muted-foreground">
        You can change this anytime in Preferences on the assistant profile panel.
      </p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          data-testid="floating-chat-opt-out-disable"
          onClick={onDisable}
        >
          Don&apos;t show again
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8"
          data-testid="floating-chat-opt-out-keep"
          onClick={onKeep}
        >
          Just this time
        </Button>
      </div>
    </div>,
    document.body
  );
}
