'use client';

import * as React from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/UI/button';

/**
 * Pinned incoming-call prompt shown when an assistant rings the owner on Unify
 * Meet (the in-app live call). The assistant cannot join the owner's browser for
 * them, so it rings and the owner answers here, which kicks off the normal call
 * connect flow. Generic to any assistant.
 */
export function IncomingMeetCallCard({
  assistantName,
  onAnswer,
  onDecline,
}: {
  assistantName: string;
  onAnswer: () => void;
  onDecline: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label={`Incoming call from ${assistantName}`}
      data-testid="incoming-meet-call-card"
      className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border bg-background p-4 shadow-lg"
    >
      <div className="flex items-center gap-3">
        <span className="bg-primary/10 relative flex h-10 w-10 items-center justify-center rounded-full text-primary">
          <Phone className="h-5 w-5 animate-pulse" />
        </span>
        <div className="min-w-0">
          <p className="text-body truncate text-foreground">{assistantName}</p>
          <p className="text-caption truncate">is calling you on Unify Meet…</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={onAnswer} data-testid="incoming-meet-call-answer">
          <Phone className="mr-2 h-4 w-4" />
          Answer call
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={onDecline}
          data-testid="incoming-meet-call-decline"
        >
          <PhoneOff className="mr-2 h-4 w-4" />
          Decline
        </Button>
      </div>
    </div>
  );
}
