import * as React from 'react';
import { Assistant } from '@/types/team/assistant';
import { MessageLog } from '@/types/team/activity';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { X, Loader2, WifiOff, Inbox } from 'lucide-react';
import { ActivityLogItem } from './ActivityLogItem';
import { ActivityLogItemSkeleton } from './ActivityLogItemSkeleton';
import { Virtuoso } from 'react-virtuoso';

interface AssistantActivityLogPanelProps {
    assistant: Assistant | null;
    messages: MessageLog[];
    fetchMoreMessages: () => void;
    hasMoreMessages: boolean;
    isLoadingInitial: boolean;
    isLoadingMore: boolean;
    logError: string | null;
    onClose: () => void;
}

const ActivityListFooter = React.memo(({ isLoadingMore }: { isLoadingMore: boolean }) => {
    if (!isLoadingMore) return null;
    return (
        <div className="flex justify-center items-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
        </div>
    );
});
ActivityListFooter.displayName = 'ActivityListFooter';

const MemoizedActivityLogItem = React.memo(ActivityLogItem);

export function AssistantActivityLogPanel({
    assistant,
    messages,
    fetchMoreMessages,
    hasMoreMessages,
    isLoadingInitial,
    isLoadingMore,
    logError,
    onClose,
}: AssistantActivityLogPanelProps) {
    const virtuosoRef = React.useRef(null);

    const handleEndReached = React.useCallback(() => {
        if (!isLoadingMore && hasMoreMessages && !isLoadingInitial && !logError) {
            fetchMoreMessages();
        }
    }, [isLoadingMore, hasMoreMessages, isLoadingInitial, logError, fetchMoreMessages]);

    const renderMessageItem = React.useCallback((index: number, message: MessageLog) => {
        return (
            // Adding a key to the div wrapper if Virtuoso doesn't handle item keys well itself for re-renders
            <div key={message.log_id} className="border-b border-border/60 last:border-b-0">
                 <MemoizedActivityLogItem item={message} />
            </div>
        );
    }, []);

    if (!assistant) return null;

    const displayName = `${assistant.first_name} ${assistant.surname}`;

    return (
        <div className="h-full flex flex-col w-full bg-background">
            {/* Header */}
            <div className="px-4 py-3.5 sm:px-6 sm:py-3.5 border-b flex-shrink-0">
                <div className='flex items-center justify-between'>
                    <h2 className="text-lg font-semibold truncate pr-2">
                        {`${displayName}'s Activity`}
                    </h2>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close Activity Log</span>
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 relative"> {/* Added relative for absolute positioning of messages if needed */}
                {isLoadingInitial ? (
                    <ScrollArea className="h-full p-2">
                        <div className="space-y-0"> {/* No space for skeletons, borders will separate */}
                            {[...Array(10)].map((_, i) => (
                                <div key={`activity-skeleton-${i}`} className="border-b border-border/60 last:border-b-0">
                                    <ActivityLogItemSkeleton />
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                ) : logError ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <WifiOff className="h-7 w-7 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">Could not load activity.</p>
                    </div>
                ) : messages.length > 0 ? (
                    <Virtuoso
                        ref={virtuosoRef}
                        style={{ height: '100%' }}
                        data={messages}
                        endReached={handleEndReached}
                        overscan={200} // Adjust as needed
                        itemContent={renderMessageItem}
                        components={{
                            Footer: () => <ActivityListFooter isLoadingMore={isLoadingMore} />,
                        }}
                        className="scrollbar-thin scrollbar-thumb-muted-foreground/50 scrollbar-track-transparent px-3 pt-1"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <Inbox className="h-7 w-7 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">No activity found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}