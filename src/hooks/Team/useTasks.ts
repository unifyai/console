import * as React from 'react';
import { Task, TaskActions, Status, Priority, Schedule, RepeatPattern } from '@/types/team/task';
import { LogProps, LogsResponseProps } from '@/types/interfaces/logs';
import { toast } from 'sonner';

const TASK_PAGE_LIMIT = 20;

// Helper function to map backend log entry to frontend Task type
const mapLogToTask = (log: LogProps): Task | null => {
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
        console.warn("Skipping log due to missing or invalid task_id or name:", log);
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
    };
};

export function useTasks(
    taskActions: TaskActions,
    filterExpression: string | null,
    initialFetchTriggered: boolean 
) {
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [offset, setOffset] = React.useState(0);
    const [totalCount, setTotalCount] = React.useState(0);
    const [hasMoreTasks, setHasMoreTasks] = React.useState(true);
    const [isLoadingInitial, setIsLoadingInitial] = React.useState(false); 
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const [taskError, setTaskError] = React.useState<string | null>(null);
    const [currentFilterExprForFetch, setCurrentFilterExprForFetch] = React.useState<string | null>(null);
    const initialLoadAttemptedRef = React.useRef(false);

    const fetchTasksInternal = React.useCallback(async (expr: string | null, isInitialLoad = true) => {
        if (!isInitialLoad && isLoadingMore) return;

        const fetchOffset = isInitialLoad ? 0 : offset;

        if (isInitialLoad) {
            setIsLoadingInitial(true);
            setTasks([]);
            setOffset(0);
            setHasMoreTasks(true);
            setCurrentFilterExprForFetch(expr);
            setTaskError(null);
        } else {
            if (!hasMoreTasks) return;
            setIsLoadingMore(true);
            setTaskError(null);
        }

        try {
            const response = await taskActions.get(expr, TASK_PAGE_LIMIT, fetchOffset);
            if ('detail' in response && response.detail) {
                throw new Error(response.detail);
            }
            const logsResponse = response as LogsResponseProps; 
            const fetchedLogs = Array.isArray(logsResponse.logs) ? logsResponse.logs : [];
            const mappedTasks: Task[] = fetchedLogs.map(mapLogToTask).filter((task): task is Task => task !== null);

            setTasks(prevTasks => isInitialLoad ? mappedTasks : [...prevTasks, ...mappedTasks]);

            const newTotalCount = logsResponse.count ?? (isInitialLoad ? mappedTasks.length : tasks.length + mappedTasks.length);
            setTotalCount(newTotalCount);

            const newLoadedCount = fetchOffset + mappedTasks.length;
            setOffset(newLoadedCount);
            setHasMoreTasks(newLoadedCount < newTotalCount && mappedTasks.length > 0);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred while fetching tasks.";
            setTaskError(errorMsg);
            console.error("Task fetch error in hook:", errorMsg);
            toast.error(`Failed to load tasks`);

            if (isInitialLoad) {
                setTasks([]);
                setHasMoreTasks(false);
            } else {
                setHasMoreTasks(false); 
            }
        } finally {
            if (isInitialLoad) setIsLoadingInitial(false);
            setIsLoadingMore(false);
        }
    }, [taskActions, offset, isLoadingMore, hasMoreTasks, tasks.length]); 

    React.useEffect(() => {
        if (initialFetchTriggered) {
            // Fetch if it's the first time `initialFetchTriggered` is true for this hook instance,
            // OR if the filter expression has changed since the last fetch.
            if (!initialLoadAttemptedRef.current || filterExpression !== currentFilterExprForFetch) {
                fetchTasksInternal(filterExpression, true);
                initialLoadAttemptedRef.current = true; // Mark that an initial load attempt has been made
            }
        } else {
            // If initialFetchTriggered becomes false (e.g., component re-mount or specific parent logic),
            // reset the ref to allow a new "initial" fetch when it becomes true again.
            initialLoadAttemptedRef.current = false;
        }
    }, [filterExpression, initialFetchTriggered, fetchTasksInternal, currentFilterExprForFetch]);

    const fetchMoreTasksCallback = React.useCallback(() => {
        if (!isLoadingInitial && !isLoadingMore && hasMoreTasks && !taskError) { 
            fetchTasksInternal(currentFilterExprForFetch, false);
        }
    }, [isLoadingInitial, isLoadingMore, hasMoreTasks, taskError, fetchTasksInternal, currentFilterExprForFetch]);

    const refreshTasks = React.useCallback(() => {
        fetchTasksInternal(currentFilterExprForFetch, true);
    }, [fetchTasksInternal, currentFilterExprForFetch]);


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
        isLoadingInitial: isLoadingInitial && tasks.length === 0, 
        initialLoadError: taskError, 
        refreshTasks,
        updateLocalTask,
        totalCount
    };
}