'use client';

import * as React from 'react';
import { PhoneOff } from 'lucide-react';
import { Button } from '@/components/UI/button';

/** Compact end-call control while a human↔human LiveKit call is connected. */
export function ActiveHumanCallCard({ peerName, onEnd }: { peerName: string; onEnd: () => void }) {
  return (
    <div
      role="status"
      data-testid="active-human-call-card"
      className="fixed bottom-6 right-6 z-50 w-72 rounded-xl border bg-background p-3 shadow-lg"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-caption text-muted-foreground">In call with</p>
          <p className="text-body truncate text-foreground">{peerName}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onEnd}
          data-testid="active-human-call-end"
          aria-label="End call"
        >
          <PhoneOff className="mr-1.5 h-4 w-4" />
          End
        </Button>
      </div>
    </div>
  );
}
