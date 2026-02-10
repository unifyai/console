/**
 * ActionsHistoryDialog - Full-screen dialog for viewing complete action history.
 *
 * Features:
 * - Shows all historical actions (not just active ones)
 * - Infinite scroll to load more actions
 * - Full action tree with expand/collapse
 * - Uses same ActionTree component for consistency
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/UI/dialog';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Loader2, History } from 'lucide-react';
import { ActionTree } from './ActionTree';
import { useAssistantActions } from '@/hooks/Assistants/useAssistantActions';
import type { AssistantActionActions } from '@/types/assistants/action';

export interface ActionsHistoryDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** The assistant ID to fetch actions for */
  assistantId: string;
  /** Server actions for fetching events */
  actions: AssistantActionActions;
}

export function ActionsHistoryDialog({
  isOpen,
  onClose,
  assistantId,
  actions,
}: ActionsHistoryDialogProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { roots, isLoading, error, loadMore, hasMore } = useAssistantActions(assistantId, actions, {
    enabled: isOpen,
    pollingInterval: 5000, // Slower polling for history view
    initialLookbackMs: 24 * 60 * 60 * 1000, // 24 hours for history
  });

  // Handle scroll to load more
  const handleScroll = React.useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement || isLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollElement;
    const scrollBottom = scrollHeight - scrollTop - clientHeight;

    // Load more when within 100px of bottom
    if (scrollBottom < 100) {
      loadMore();
    }
  }, [isLoading, hasMore, loadMore]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Action History
          </DialogTitle>
          <DialogDescription>View all actions performed by your assistant</DialogDescription>
        </DialogHeader>

        <div className="mt-4 min-h-0 flex-1">
          {/* Loading state */}
          {isLoading && roots.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span className="text-sm">Loading action history...</span>
            </div>
          )}

          {/* Error state */}
          {error && roots.length === 0 && (
            <div className="flex items-center justify-center py-12 text-destructive">
              <span className="text-sm">Failed to load action history</span>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && roots.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <span className="text-sm">No action history found</span>
            </div>
          )}

          {/* Action tree */}
          {roots.length > 0 && (
            <ScrollArea className="h-[70vh]" ref={scrollRef} onScrollCapture={handleScroll}>
              <div className="p-2">
                <ActionTree roots={roots} defaultExpanded={false} />
              </div>

              {/* Load more indicator */}
              {isLoading && roots.length > 0 && (
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="text-xs">Loading more...</span>
                </div>
              )}

              {/* End of history indicator */}
              {!hasMore && roots.length > 0 && (
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <span className="text-xs">End of history</span>
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
