import * as React from 'react';
import { Assistant } from '@/types/team/assistant';
import { MessageLog, ActivityLogActions, MessageLogEntry, MessageMedium } from '@/types/team/activity';
import { LogProps, LogsResponseProps } from '@/types/evals/logs';
import { showErrorToast } from '@/components/notifications';

const MESSAGE_PAGE_LIMIT = 20;
const USER_IDENTIFIER = "user"; // Special identifier for the user

// Helper function to map backend log entry to frontend MessageLog type
const mapLogToMessageLog = (log: LogProps, assistants: Assistant[], currentUserId: string | null = "user"): MessageLog | null => {
    const entries = log?.entries as MessageLogEntry | undefined;
    const log_id = log?.id;

    if (!entries || typeof log_id !== 'number') {
        console.warn("Skipping log due to missing or invalid core message fields:", log);
        return null;
    }
    
    const getParticipantName = (id: string): string => {
        if (id === USER_IDENTIFIER || id === currentUserId || !assistants.map(assistant => assistant.agent_id).includes(id) ) return "User"; // Fallback to "User"
        const assistant = assistants.find(a => a.agent_id === id);
        return assistant ? `${assistant.first_name} ${assistant.surname}` : id; // Fallback to ID if not found
    };

    return {
        log_id,
        medium: entries.medium,
        sender_id: entries.sender_id, // Keep original IDs from log
        receiver_id: entries.receiver_id, // Keep original IDs from log
        timestamp: entries.timestamp,
        content: entries.content || "",
        exchange_id: entries.exchange_id,
        senderName: getParticipantName(entries.sender_id),
        receiverName: getParticipantName(entries.receiver_id),
    };
};


export function useActivityLogs(
    activityLogActions: ActivityLogActions,
    targetAssistantId: string | null, // The agent_id of the assistant whose logs we want
    allAssistants: Assistant[], // Full list of assistants for name resolution
    currentUserId: string | null = "user" // Identifier for the current user
) {
    const [messages, setMessages] = React.useState<MessageLog[]>([]);
    const [offset, setOffset] = React.useState(0);
    const [totalCount, setTotalCount] = React.useState(0);
    const [hasMoreMessages, setHasMoreMessages] = React.useState(true);
    const [isLoadingInitial, setIsLoadingInitial] = React.useState(false);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const [logError, setLogError] = React.useState<string | null>(null);
    
    const initialLoadAttemptedForAssistant = React.useRef<string | null>(null);

    const fetchMessagesInternal = React.useCallback(async (assistantId: string, isInitialLoad = true) => {
        if (!isInitialLoad && isLoadingMore) return;

        const fetchOffset = isInitialLoad ? 0 : offset;

        if (isInitialLoad) {
            setIsLoadingInitial(true);
            setMessages([]);
            setOffset(0);
            setHasMoreMessages(true);
            setLogError(null);
            initialLoadAttemptedForAssistant.current = assistantId;
        } else {
            if (!hasMoreMessages) return;
            setIsLoadingMore(true);
            setLogError(null);
        }
        
        // Assuming sender_id/receiver_id in logs are string agent_ids or "user"
        const filterExpression = `(sender_id == "${assistantId}" or receiver_id == "${assistantId}")`;

        try {
            const response = await activityLogActions.get(filterExpression, MESSAGE_PAGE_LIMIT, fetchOffset);
            if ('detail' in response && response.detail) {
                throw new Error(response.detail);
            }
            const logsResponse = response as LogsResponseProps;
            const fetchedLogs = Array.isArray(logsResponse.logs) ? logsResponse.logs : [];
            const mappedMessages: MessageLog[] = fetchedLogs
                .map(log => mapLogToMessageLog(log, allAssistants, currentUserId))
                .filter((msg): msg is MessageLog => msg !== null);

            // Sort messages by timestamp descending (newest first)
            mappedMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            setMessages(prevMessages => isInitialLoad ? mappedMessages : [...prevMessages, ...mappedMessages]);

            const newTotalCount = logsResponse.count ?? (isInitialLoad ? mappedMessages.length : messages.length + mappedMessages.length);
            setTotalCount(newTotalCount);

            const newLoadedCount = fetchOffset + mappedMessages.length;
            setOffset(newLoadedCount);
            setHasMoreMessages(newLoadedCount < newTotalCount && mappedMessages.length > 0);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred while fetching messages.";
            setLogError(errorMsg);
            console.error("Message fetch error in hook:", errorMsg);
            showErrorToast(`Failed to load activity logs`);

            if (isInitialLoad) {
                setMessages([]);
                setHasMoreMessages(false);
            }
        } finally {
            if (isInitialLoad) setIsLoadingInitial(false);
            setIsLoadingMore(false);
        }
    }, [activityLogActions, offset, isLoadingMore, hasMoreMessages, messages.length, allAssistants, currentUserId]);

    React.useEffect(() => {
        if (targetAssistantId) {
            if (initialLoadAttemptedForAssistant.current !== targetAssistantId) {
                 fetchMessagesInternal(targetAssistantId, true);
            }
        } else {
            // Clear messages if no assistant is selected
            setMessages([]);
            setOffset(0);
            setTotalCount(0);
            setHasMoreMessages(true);
            setIsLoadingInitial(false);
            setIsLoadingMore(false);
            setLogError(null);
            initialLoadAttemptedForAssistant.current = null;
        }
    }, [targetAssistantId, fetchMessagesInternal]);

    const fetchMoreMessagesCallback = React.useCallback(() => {
        if (targetAssistantId && !isLoadingInitial && !isLoadingMore && hasMoreMessages && !logError) {
            fetchMessagesInternal(targetAssistantId, false);
        }
    }, [targetAssistantId, isLoadingInitial, isLoadingMore, hasMoreMessages, logError, fetchMessagesInternal]);


    return {
        messages,
        fetchMoreMessages: fetchMoreMessagesCallback,
        hasMoreMessages,
        isLoadingMore,
        isLoadingInitial: isLoadingInitial && messages.length === 0,
        logError,
        totalCount,
    };
}