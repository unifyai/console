'use client';

import * as React from 'react';
import { PhoneOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/UI/button';

interface OrgCallErrorBoundaryProps {
  children: React.ReactNode;
  /** Hang up the call entirely (media teardown + leave API). */
  onLeave: () => void;
}

interface OrgCallErrorBoundaryState {
  hasError: boolean;
}

/**
 * Render-error containment for the call surfaces. LiveKit hooks can throw at
 * render time (e.g. a participant disappearing between frames); without a
 * boundary that unmounts the entire page while the media session keeps
 * running. Degrade to a small recovery card instead: retry re-renders the
 * stage against fresh room state, leave tears the call down.
 */
export class OrgCallErrorBoundary extends React.Component<
  OrgCallErrorBoundaryProps,
  OrgCallErrorBoundaryState
> {
  state: OrgCallErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): OrgCallErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[OrgCallErrorBoundary]', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        role="alert"
        data-testid="org-call-error-boundary"
        className="fixed bottom-6 right-6 z-50 flex w-[280px] flex-col items-center gap-3 rounded-xl border bg-background p-4 shadow-lg"
      >
        <p className="text-body text-center text-foreground">
          The call display hit an error. Your call is still connected.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => this.setState({ hasError: false })}
            data-testid="org-call-error-retry"
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            Reload view
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onLeave();
            }}
            data-testid="org-call-error-leave"
          >
            <PhoneOff className="mr-1 h-4 w-4" />
            Leave
          </Button>
        </div>
      </div>
    );
  }
}
