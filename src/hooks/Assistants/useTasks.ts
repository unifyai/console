import * as React from 'react';
import { Task, TaskActions, Status, Priority, Schedule, RepeatPattern } from '@/types/assistants/task';
import { LogProps, LogsResponseProps } from '@/types/interfaces/logs';
import { toast } from 'sonner';
import { Assistant } from '@/types/assistants/assistant';

const TASK_PAGE_LIMIT = 20;

// Helper function to map backend log entry to frontend Task type
// assistant_id is optional - if not provided, it will be extracted from entries._assistant_id (used for "All" context)
const mapLogToTask = (log: LogProps, assistant_id?: string): Task | null => {
    const log_id = log?.id;
    const entries = log?.entries || {};
    
    // Extract assistant_id from entries if not provided (used for "All" context)
    const resolvedAssistantId = assistant_id ?? (entries?._assistant_id as string | undefined);
    
    const task_id = entries?.task_id as string | undefined;
    const name = entries?.name as string | undefined;
    const description = entries?.description as string | undefined;
    const status = entries?.status as Status | undefined;
    const priority = entries?.priority as Priority | undefined;
    const deadline = entries?.deadline as string | undefined;
    
    // Basic validation for core fields (including resolved assistant_id)
    if (!entries || typeof log_id !== 'number' || typeof task_id !== 'number' || typeof name !== 'string' || !resolvedAssistantId) {
        return null;
    }

    // Safely parse schedule, repeatPattern from entries
    // It's crucial that the backend sends these as structured objects if they exist
    const scheduleData = entries?.schedule;
    const schedule: Schedule = {
        next_task: typeof scheduleData?.next_task === 'number' ? scheduleData.next_task : undefined,
        prev_task: typeof scheduleData?.prev_task === 'number' ? scheduleData.prev_task : undefined,
        start_time: typeof scheduleData?.start_time === 'string' ? scheduleData.start_time : undefined,
    };

    const repeatData = entries?.repeat;
    let repeat: RepeatPattern | undefined = undefined;
    if (repeatData && typeof repeatData.frequency === 'string' && typeof repeatData.interval === 'number') {
        repeat = {
            frequency: repeatData.frequency as RepeatPattern['frequency'],
            interval: repeatData.interval,
            weekdays: Array.isArray(repeatData.weekdays) ? repeatData.weekdays as RepeatPattern['weekdays'] : undefined,
            count: typeof repeatData.count === 'number' ? repeatData.count : undefined,
            until: typeof repeatData.until === 'string' ? repeatData.until : undefined,
        };
    }
    
    return {
        log_id,
        task_id,
        name,
        description: description || "",
        status: status || Status.queued,
        schedule,
        deadline,
        repeat,
        priority: priority || Priority.normal,
        assistant_id: resolvedAssistantId,
    };
};

interface PerAssistantData {
    offset: number;
    hasMore: boolean;
    total: number;
}

export function useTasks(
    taskActions: TaskActions,
    assistants: Assistant[],
    assistantFilter: string,
    filterExpression: string | null,
    initialFetchTriggered: boolean 
) {
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [isLoadingInitial, setIsLoadingInitial] = React.useState(false); 
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const [taskError, setTaskError] = React.useState<string | null>(null);
    const [currentFilterState, setCurrentFilterState] = React.useState({
        expr: filterExpression,
        assistant: assistantFilter
    });
    const initialLoadAttemptedRef = React.useRef(false);

    // State for per-assistant pagination (used when filtering by specific assistant)
    const [perAssistantData, setPerAssistantData] = React.useState<Map<string, PerAssistantData>>(new Map());
    
    // Pagination state for "All" context (single unified pagination when fetching all tasks)
    const [allContextPagination, setAllContextPagination] = React.useState<PerAssistantData>({ offset: 0, hasMore: true, total: 0 });

    // Helper to sort tasks by deadline
    const sortTasks = React.useCallback((taskList: Task[]) => 
        taskList.sort((a, b) => (a.deadline && b.deadline) 
            ? new Date(b.deadline).getTime() - new Date(a.deadline).getTime() 
            : a.deadline ? -1 : 1
        ), []);

    const fetchTasksInternal = React.useCallback(async (
        assistantsToFetch: Assistant[], 
        expr: string | null, 
        isInitialLoad: boolean,
        useAllContext: boolean  // When true, use single "All" context API call
    ) => {
        if (isInitialLoad) {
            setIsLoadingInitial(true);
            setTasks([]);
            if (useAllContext) {
                setAllContextPagination({ offset: 0, hasMore: true, total: 0 });
            } else {
                setPerAssistantData(new Map());
            }
        } else {
            if (isLoadingMore) return; // Prevent concurrent "load more" fetches
            setIsLoadingMore(true);
        }
        setTaskError(null);

        try {
            if (useAllContext) {
                // === "All" context: Single API call for all tasks ===
                const offset = isInitialLoad ? 0 : allContextPagination.offset;
                if (!isInitialLoad && !allContextPagination.hasMore) {
                    setIsLoadingMore(false);
                    return;
                }
                
                const response = await taskActions.get("All", expr, TASK_PAGE_LIMIT, offset);
                
                if ('detail' in response && response.detail) {
                    setTaskError(response.detail);
                    toast.error("Failed to load tasks.");
                    if (isInitialLoad) setTasks([]);
                    setAllContextPagination(prev => ({ ...prev, hasMore: false }));
                } else {
                    const logsResponse = response as LogsResponseProps;
                    const fetchedLogs = Array.isArray(logsResponse.logs) ? logsResponse.logs : [];
                    // Pass undefined for assistant_id - will be extracted from entries._assistant_id
                    const mappedTasks = fetchedLogs.map(log => mapLogToTask(log)).filter(Boolean) as Task[];
                    
                    const newTotalCount = logsResponse.count ?? 0;
                    const newOffset = offset + mappedTasks.length;
                    
                    setAllContextPagination({
                        offset: newOffset,
                        hasMore: newOffset < newTotalCount,
                        total: newTotalCount,
                    });
                    
                    if (isInitialLoad) {
                        setTasks(sortTasks(mappedTasks));
                    } else {
                        setTasks(prevTasks => sortTasks([...prevTasks, ...mappedTasks]));
                    }
                }
            } else {
                // === Per-assistant fetching (for single assistant filter) ===
                if (assistantsToFetch.length === 0) {
                    if (isInitialLoad) setIsLoadingInitial(false);
                    setIsLoadingMore(false);
                    return;
                }

                const promises = assistantsToFetch.map(assistant => {
                    const context = `${assistant.first_name}${assistant.surname}`;
                    const offset = isInitialLoad ? 0 : (perAssistantData.get(assistant.agent_id)?.offset || 0);
                    // Don't fetch more for an assistant that already has no more tasks
                    if (!isInitialLoad && !perAssistantData.get(assistant.agent_id)?.hasMore) {
                        return Promise.resolve(null);
                    }
                    return taskActions.get(context, expr, TASK_PAGE_LIMIT, offset);
                });

                const responses = await Promise.all(promises);
                const newTasks: Task[] = [];
                const newPerAssistantData = new Map<string, PerAssistantData>(perAssistantData);
                let hadError = false;

                responses.forEach((response, index) => {
                    if (response === null) return;

                    const assistant = assistantsToFetch[index];
                    const assistantId = assistant.agent_id;

                    if ('detail' in response && response.detail) {
                        hadError = true;
                        newPerAssistantData.set(assistantId, {
                            ...(newPerAssistantData.get(assistantId) || { offset: 0, total: 0 }),
                            hasMore: false, 
                        });
                    } else {
                        const logsResponse = response as LogsResponseProps;
                        const fetchedLogs = Array.isArray(logsResponse.logs) ? logsResponse.logs : [];
                        const mappedTasks = fetchedLogs.map(log => mapLogToTask(log, assistantId)).filter(Boolean) as Task[];
                        
                        newTasks.push(...mappedTasks);

                        const newTotalCount = logsResponse.count ?? 0;
                        const prevOffset = isInitialLoad ? 0 : (perAssistantData.get(assistantId)?.offset || 0);
                        const newOffset = prevOffset + mappedTasks.length;

                        newPerAssistantData.set(assistantId, {
                            offset: newOffset,
                            hasMore: newOffset < newTotalCount,
                            total: newTotalCount,
                        });
                    }
                });
                
                if (hadError) {
                    toast.error("Failed to load tasks for one or more assistants.");
                }

                if (isInitialLoad) {
                    setTasks(sortTasks(newTasks));
                } else {
                    setTasks(prevTasks => sortTasks([...prevTasks, ...newTasks]));
                }
                
                setPerAssistantData(newPerAssistantData);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred while fetching tasks.";
            setTaskError(errorMsg);
            toast.error(`Failed to load tasks`);
            if (isInitialLoad) setTasks([]);
        } finally {
            if (isInitialLoad) setIsLoadingInitial(false);
            setIsLoadingMore(false);
        }
    }, [taskActions, isLoadingMore, perAssistantData, allContextPagination, sortTasks]);

    React.useEffect(() => {
        if (initialFetchTriggered) {
            const filterChanged = filterExpression !== currentFilterState.expr || assistantFilter !== currentFilterState.assistant;
            if (!initialLoadAttemptedRef.current || filterChanged) {
                
                const useAllContext = assistantFilter === 'all';
                const assistantsToQuery = useAllContext 
                    ? []  // Not needed when using "All" context
                    : assistants.filter(a => a.agent_id === assistantFilter);

                // Fetch if using "All" context OR if we have specific assistants to query
                if (useAllContext || assistantsToQuery.length > 0) { 
                   fetchTasksInternal(assistantsToQuery, filterExpression, true, useAllContext);
                }
                
                setCurrentFilterState({ expr: filterExpression, assistant: assistantFilter });
                initialLoadAttemptedRef.current = true;
            }
        } else {
            initialLoadAttemptedRef.current = false;
        }
    }, [
        assistants, 
        assistantFilter, 
        filterExpression, 
        initialFetchTriggered, 
        fetchTasksInternal, 
        currentFilterState
    ]);
    
    const fetchMoreTasksCallback = React.useCallback(() => {
        if (isLoadingInitial || isLoadingMore) return;

        const useAllContext = assistantFilter === 'all';
        
        if (useAllContext) {
            // "All" context: check unified pagination
            if (allContextPagination.hasMore) {
                fetchTasksInternal([], filterExpression, false, true);
            }
        } else {
            // Per-assistant: check individual assistant pagination
            const assistantsToQuery = assistants.filter(a => a.agent_id === assistantFilter);
            const assistantsWithMore = assistantsToQuery.filter(
                a => perAssistantData.get(a.agent_id)?.hasMore
            );
            if (assistantsWithMore.length > 0) {
                fetchTasksInternal(assistantsWithMore, filterExpression, false, false);
            }
        }
    }, [isLoadingInitial, isLoadingMore, assistantFilter, assistants, perAssistantData, allContextPagination, fetchTasksInternal, filterExpression]);

    const hasMoreTasks = React.useMemo(() => {
        if (assistantFilter === 'all') {
            // "All" context: check unified pagination
            return allContextPagination.hasMore;
        }
        
        // Per-assistant: check individual assistant pagination
        const assistantsToCheck = assistants.filter(a => a.agent_id === assistantFilter);
        return assistantsToCheck.some(a => perAssistantData.get(a.agent_id)?.hasMore);
    }, [perAssistantData, allContextPagination, assistantFilter, assistants]);


    const updateLocalTask = React.useCallback((taskId: number, updatedFields: Partial<Task>) => {
        setTasks(prevTasks =>
            prevTasks.map(task =>
                task.task_id === taskId
                    ? { ...task, ...updatedFields }
                    : task
            )
        );
    }, []);

    return {
        tasks,
        fetchMoreTasks: fetchMoreTasksCallback,
        hasMoreTasks,
        isLoadingMore,
        isLoadingInitial,
        initialLoadError: taskError,
        updateLocalTask,
    };
}