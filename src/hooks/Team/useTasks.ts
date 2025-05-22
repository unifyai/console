import * as React from 'react';
import { Task, TaskActions } from '@/types/team/task';
import { LogProps, LogsResponseProps } from '@/types/evals/logs';
import { toast } from 'sonner';

const TASK_PAGE_LIMIT = 20;

// Helper function (can be in a lib file)
const mapLogToTask = (log: LogProps): Task | null => {
    const id = log?.id;
    const title = log?.entries?.title as string | undefined;
    const description = log?.entries?.description as string | undefined;
    const status = log?.entries?.status as string | undefined;
    const assigned = log?.entries?.assignedAssistantIds as string[] | string | undefined;

    if (!id || typeof title !== 'string') {
        console.warn("Skipping log due to missing id or title:", log);
        return null;
    }
    let assignedIds: string[] = [];
    if (Array.isArray(assigned)) {
        assignedIds = assigned.map(String).filter(id => id);
    } else if (typeof assigned === 'string' && assigned.trim()) {
        assignedIds = [assigned.trim()];
    }

    return { id, title, description, status, assignedAssistantIds: assignedIds };
};

export function useTasks(
    taskActions: TaskActions,
    filterExpression: string | null,
    initialFetchTriggered: boolean // To prevent fetching on initial mount if filters aren't ready
) {
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [offset, setOffset] = React.useState(0);
    const [totalCount, setTotalCount] = React.useState(0);
    const [hasMoreTasks, setHasMoreTasks] = React.useState(true);
    const [isLoadingInitial, setIsLoadingInitial] = React.useState(false); // Changed: only true when actively fetching initial
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const [taskError, setTaskError] = React.useState<string | null>(null);
    const [currentFilterExprForFetch, setCurrentFilterExprForFetch] = React.useState<string | null>(null);


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
            const logsResponse = response as LogsResponseProps; // Cast after check
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
                setHasMoreTasks(false); // Stop further loading attempts on error
            }
        } finally {
            if (isInitialLoad) setIsLoadingInitial(false);
            setIsLoadingMore(false);
        }
    }, [taskActions, offset, isLoadingMore, hasMoreTasks, tasks.length]); // tasks.length for totalCount fallback

    // Effect to trigger initial load or reload when filterExpression changes
    React.useEffect(() => {
        if (initialFetchTriggered) { 
            // Only fetch if the consuming component signals it's ready
            // Check if filterExpression has actually changed from the last one used for fetching
            if (filterExpression !== currentFilterExprForFetch) {
                 fetchTasksInternal(filterExpression, true);
            }
        }
    }, [filterExpression, initialFetchTriggered, fetchTasksInternal, currentFilterExprForFetch]);

    const fetchMoreTasksCallback = React.useCallback(() => {
        if (!isLoadingInitial && !isLoadingMore && hasMoreTasks && !taskError) { // also check taskError to prevent load if previous failed
            fetchTasksInternal(currentFilterExprForFetch, false);
        }
    }, [isLoadingInitial, isLoadingMore, hasMoreTasks, taskError, fetchTasksInternal, currentFilterExprForFetch]);

    const refreshTasks = React.useCallback(() => {
        fetchTasksInternal(currentFilterExprForFetch, true);
    }, [fetchTasksInternal, currentFilterExprForFetch]);


    // Callback for optimistic updates
    const updateLocalTask = React.useCallback((taskId: string, updatedFields: Partial<Task>) => {
        setTasks(prevTasks =>
            prevTasks.map(task =>
                task.id === taskId
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
        isLoadingInitial: isLoadingInitial && tasks.length === 0, // More accurate initial loading
        initialLoadError: taskError, // Renamed for clarity
        refreshTasks,
        updateLocalTask,
        totalCount
    };
}