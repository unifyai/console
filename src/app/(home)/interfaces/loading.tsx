import React from 'react';
import { Loader } from '@/components/Common/Loader';

/**
 * Route-level loading UI for /interfaces.
 * Renders inside the main content area (below the navbar) while the
 * server component builds and before the client Interface mounts.
 */
export default function Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader size={32} />
        <p className="text-body-muted">Loading interface...</p>
      </div>
    </div>
  );
}
