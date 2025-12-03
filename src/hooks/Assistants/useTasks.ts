import * as React from 'react';
import { Task, TaskActions, Status, Priority, Schedule, RepeatPattern } from '@/types/assistants/task';
import { LogProps, LogsResponseProps } from '@/types/interfaces/logs';
import { toast } from 'sonner';
import { Assistant } from '@/types/assistants/assistant';

const TASK_PAGE_LIMIT = 20;

// Helper function to map backend log entry to frontend Task type
const mapLogToTask = (log: LogProps, assistant_id: string): Task | null => {
    const log_id = log?.id;
    const entries = log?.entries || {};
    
    const task_id = entries?.task_id as string | undefined;
    const name = entries?.name as string | undefined;
    const description = entries?.description as string | undefined;
    const status = entries?.status as Status | undefined;
    const priority = entries?.priority as Priority | undefined;
    const deadline = entries?.deadline as string | undefined;
    
    // Basic validation for core fields
    if (!entries || typeof log_id !== 'number' || typeof task_id !== 'number' || typeof name !== 'string') {
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
        assistant_id,
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

    // State for per-assistant pagination
    const [perAssistantData, setPerAssistantData] = React.useState<Map<string, PerAssistantData>>(new Map());

    const fetchTasksInternal = React.useCallback(async (assistantsToFetch: Assistant[], expr: string | null, isInitialLoad: boolean) => {
        if (isInitialLoad) {
            setIsLoadingInitial(true);
            setTasks([]);
            setPerAssistantData(new Map()); // Reset pagination data on initial load
        } else {
            if (isLoadingMore) return; // Prevent concurrent "load more" fetches
            setIsLoadingMore(true);
        }
        setTaskError(null);

        try {
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
                    return Promise.resolve(null); // Return a resolved promise to not break Promise.all
                }
                return taskActions.get(context, expr, TASK_PAGE_LIMIT, offset);
            });

            const responses = await Promise.all(promises);
            const newTasks: Task[] = [];
            const newPerAssistantData = new Map<string, PerAssistantData>(perAssistantData); // Copy existing data for updates
            let hadError = false;

            responses.forEach((response, index) => {
                if (response === null) return; // This was an assistant we skipped fetching

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

            const sortTasks = (taskList: Task[]) => taskList.sort((a, b) => (a.deadline && b.deadline) ? new Date(b.deadline).getTime() - new Date(a.deadline).getTime() : a.deadline ? -1 : 1);

            if (isInitialLoad) {
                setTasks(sortTasks(newTasks));
            } else {
                setTasks(prevTasks => sortTasks([...prevTasks, ...newTasks]));
            }
            
            setPerAssistantData(newPerAssistantData);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred while fetching tasks.";
            setTaskError(errorMsg);
            toast.error(`Failed to load tasks`);
            if (isInitialLoad) setTasks([]);
        } finally {
            if (isInitialLoad) setIsLoadingInitial(false);
            setIsLoadingMore(false);
        }
    }, [taskActions, isLoadingMore, perAssistantData]);

    React.useEffect(() => {
        if (initialFetchTriggered) {
            const filterChanged = filterExpression !== currentFilterState.expr || assistantFilter !== currentFilterState.assistant;
            if (!initialLoadAttemptedRef.current || filterChanged) {
                
                const assistantsToQuery = assistantFilter === 'all' 
                    ? assistants 
                    : assistants.filter(a => a.agent_id === assistantFilter);

                if (assistants.length > 0 || assistantFilter !== 'all') { 
                   fetchTasksInternal(assistantsToQuery, filterExpression, true);
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

        const assistantsToQuery = assistantFilter === 'all'
            ? assistants
            : assistants.filter(a => a.agent_id === assistantFilter);

        const assistantsWithMore = assistantsToQuery.filter(
            a => perAssistantData.get(a.agent_id)?.hasMore
        );

        if (assistantsWithMore.length > 0) {
            fetchTasksInternal(assistantsWithMore, filterExpression, false);
        }
    }, [isLoadingInitial, isLoadingMore, assistantFilter, assistants, perAssistantData, fetchTasksInternal, filterExpression]);

    const hasMoreTasks = React.useMemo(() => {
        const assistantsToCheck = assistantFilter === 'all'
            ? assistants
            : assistants.filter(a => a.agent_id === assistantFilter);
        
        return assistantsToCheck.some(a => perAssistantData.get(a.agent_id)?.hasMore);
    }, [perAssistantData, assistantFilter, assistants]);


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