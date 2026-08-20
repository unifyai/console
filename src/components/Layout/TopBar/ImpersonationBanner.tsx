'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { stopImpersonating } from '@/lib/admin/impersonation';

/**
 * Persistent banner shown while a Unify staff member is viewing the platform as
 * another user. Offers a one-click return to the original admin session.
 */
export default function ImpersonationBanner() {
  const { data: session } = useSession();
  const [isReturning, setIsReturning] = useState(false);

  if (!session?.impersonating) return null;

  const viewingAs = session.user?.name || session.user?.email || 'user';

  const handleReturn = async () => {
    setIsReturning(true);
    try {
      await stopImpersonating();
    } finally {
      window.location.assign('/');
    }
  };

  return (
    <div
      className="flex shrink-0 items-center justify-center gap-3 border-t border-[color:var(--status-warning)] bg-[color:var(--status-warning-bg)] px-4 py-1.5 text-foreground"
      data-testid="impersonation-banner"
    >
      <Eye className="h-4 w-4 shrink-0 text-[color:var(--status-warning)]" />
      <span className="text-body truncate">
        Viewing as <span className="font-semibold">{viewingAs}</span>
      </span>
      <Button
        variant="outline"
        className="h-6 px-2"
        onClick={handleReturn}
        disabled={isReturning}
        data-testid="impersonation-return"
      >
        {isReturning ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Returning…
          </>
        ) : (
          'Return to your account'
        )}
      </Button>
    </div>
  );
}
