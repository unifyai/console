import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Route-level loading UI for /interfaces.
 * Renders inside the main content area (below the navbar) while the
 * server component builds and before the client Interface mounts.
 */
export default function Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading interface...</p>
      </div>
    </div>
  );
}
