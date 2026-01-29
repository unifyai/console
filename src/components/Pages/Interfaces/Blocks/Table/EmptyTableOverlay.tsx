'use client';

import React from 'react';
import { AlertTriangle, FolderTree, X } from 'lucide-react';

interface EmptyTableOverlayProps {
  tileName?: string;
  mode: 'context' | 'new' | 'contextNotFound';
  onDismiss: () => void;
  actionButton?: React.ReactNode;
  withPulse?: boolean;
  contextName?: string; // Used for contextNotFound mode
}

const EmptyTableOverlay: React.FC<EmptyTableOverlayProps> = ({
  tileName,
  mode,
  onDismiss,
  actionButton,
  withPulse = true,
  contextName,
}) => {
  console.log('[ContextSwitch] EmptyTableOverlay rendered', {
    tileName,
    mode,
    hasActionButton: !!actionButton,
    withPulse,
    contextName,
  });
  // Content for contextNotFound mode
  if (mode === 'contextNotFound') {
    return (
      <div className="bg-background/80 absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm">
        <div className="border-destructive/30 relative mx-4 max-w-sm rounded-lg border bg-background p-6 text-center shadow-lg">
          <button
            onClick={onDismiss}
            className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-col items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div className="text-title">Context Not Found</div>
            <p className="text-caption">
              {contextName
                ? `The context "${contextName}" no longer exists.`
                : 'The selected context no longer exists.'}
            </p>
            <p className="text-caption">Select a different context or create a new one.</p>
            {actionButton && <div className="mt-2">{actionButton}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background/80 absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm">
      <div
        className={`relative mx-4 max-w-sm rounded-lg border bg-background p-6 text-center shadow-lg`}
      >
        <button
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        {actionButton && (
          <div className="flex justify-center">
            <div className="relative inline-block">
              {actionButton}
              {withPulse && (
                <span className="absolute -left-1 -top-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-primary"></span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyTableOverlay;
