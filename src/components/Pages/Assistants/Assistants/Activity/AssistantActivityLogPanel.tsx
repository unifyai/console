import * as React from 'react';
import { Assistant } from '@/types/assistants/assistant';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { X, WifiOff, Inbox } from 'lucide-react';
import { Skeleton } from '@/components/UI/skeleton';
import Markdown from 'react-markdown';

interface AssistantActivityLogPanelProps {
    assistant: Assistant | null;
    summary: string | null;
    isLoading: boolean;
    error: string | null;
    onClose: () => void;
}

const SummarySkeleton = () => (
    <div className="p-4 sm:p-6 space-y-4">
        <Skeleton className="h-4 w-1/3 bg-muted" />
        <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-full bg-muted" />
            <Skeleton className="h-4 w-2/3 bg-muted" />
        </div>
    </div>
);

export function AssistantActivityLogPanel({
    assistant,
    summary,
    isLoading,
    error,
    onClose,
}: AssistantActivityLogPanelProps) {
    if (!assistant) return null;

    const displayName = `${assistant.first_name} ${assistant.surname}`;

    const renderContent = () => {
        if (isLoading) {
            return <SummarySkeleton />;
        }
        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <WifiOff className="h-7 w-7 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">Could not load activity.</p>
                </div>
            );
        }
        if (summary) {
            return (
                <ScrollArea className="h-full">
                    <div className="p-4 sm:p-6 space-y-2">
                        <Markdown>{summary}</Markdown>
                    </div>
                </ScrollArea>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <Inbox className="h-7 w-7 text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-muted-foreground">No activity summary found.</p>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col w-full bg-background">
            {/* Header */}
            <div className="px-4 py-3.5 sm:px-6 sm:py-3.5 border-b flex-shrink-0">
                <div className='flex items-start justify-between'>
                    <h2 className="text-lg font-semibold truncate pr-2">
                        {`${displayName}'s Activity Summary`}
                    </h2>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onClose}>
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close Activity Log</span>
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0">
                {renderContent()}
            </div>
        </div>
    );
}