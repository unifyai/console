'use client';

import * as React from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/UI/button';

/** Incoming human↔human call prompt (browser LiveKit). */
export function IncomingHumanCallCard({
  callerName,
  onAnswer,
  onDecline,
}: {
  callerName: string;
  onAnswer: () => void;
  onDecline: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label={`Incoming call from ${callerName}`}
      data-testid="incoming-human-call-card"
      className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border bg-background p-4 shadow-lg"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary-tint-10 text-primary">
          <Phone className="h-5 w-5 animate-pulse" />
        </span>
        <div className="min-w-0">
          <p className="text-body truncate text-foreground">{callerName}</p>
          <p className="text-caption truncate">is calling you…</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={onAnswer} data-testid="incoming-human-call-answer">
          <Phone className="mr-2 h-4 w-4" />
          Answer call
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={onDecline}
          data-testid="incoming-human-call-decline"
        >
          <PhoneOff className="mr-2 h-4 w-4" />
          Decline
        </Button>
      </div>
    </div>
  );
}
