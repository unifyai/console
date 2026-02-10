/**
 * ActionsPanel - Container component for the live actions view.
 *
 * Features:
 * - Uses useAssistantActions hook for data fetching
 * - Shows loading/empty/error states
 * - Displays action tree when data is available
 * - Only polls when enabled (accordion is expanded)
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { ActionTree } from './ActionTree';
import { useAssistantActions } from '@/hooks/Assistants/useAssistantActions';
import type { AssistantActionActions } from '@/types/assistants/action';

export interface ActionsPanelProps {
  /** The assistant ID to fetch actions for */
  assistantId: string;
  /** Server actions for fetching events */
  actions: AssistantActionActions;
  /** Whether the panel is currently visible/expanded */
  isExpanded: boolean;
  /** Callback when active action state changes */
  onActiveChange?: (hasActive: boolean) => void;
  /** Additional class names */
  className?: string;
}

export function ActionsPanel({
  assistantId,
  actions,
  isExpanded,
  onActiveChange,
  className,
}: ActionsPanelProps) {
  const { roots, hasActiveAction, isLoading, error, refresh } = useAssistantActions(
    assistantId,
    actions,
    {
      enabled: isExpanded,
      pollingInterval: 2000,
    }
  );

  // Notify parent of active state changes
  React.useEffect(() => {
    onActiveChange?.(hasActiveAction);
  }, [hasActiveAction, onActiveChange]);

  // Loading state
  if (isLoading && roots.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center py-8 text-muted-foreground', className)}
        data-testid="actions-loading"
      >
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm">Loading actions...</span>
      </div>
    );
  }

  // Error state
  if (error && roots.length === 0) {
    return (
      <div
        className={cn('flex flex-col items-center justify-center gap-3 py-8', className)}
        data-testid="actions-error"
      >
        <div className="flex items-center text-destructive">
          <AlertCircle className="mr-2 h-5 w-5" />
          <span className="text-sm">Failed to load actions</span>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  // Empty state
  if (roots.length === 0) {
    return (
      <div
        className={cn('text-body-muted flex items-center justify-center py-8', className)}
        data-testid="actions-empty"
      >
        No recent actions
      </div>
    );
  }

  // Action tree
  return (
    <div className={cn('relative min-w-0 overflow-hidden', className)}>
      {/* Action tree - max-height with overflow for dynamic sizing */}
      <div
        style={{ scrollbarWidth: 'none' }}
        className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/50 max-h-[300px] overflow-y-auto p-2"
      >
        <ActionTree
          roots={roots}
          assistantId={assistantId}
          getToolLoopEvents={actions.getToolLoopEvents}
        />
      </div>

      {/* Loading overlay when refreshing */}
      {isLoading && roots.length > 0 && (
        <div className="absolute right-2 top-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
