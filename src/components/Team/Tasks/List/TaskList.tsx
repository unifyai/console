import * as React from 'react';
import { Input } from "@/components/UI/input";
import { Filter, Search, Users, Loader2, AlertCircle, WifiOff } from "lucide-react"; // Added WifiOff
import type { Assistant } from "@/types/team/assistant";
import type { Task, TaskActions } from "@/types/team/task";
import { TaskListItem } from "./TaskListItem";
import { TaskListItemSkeleton } from './TaskListItemSkeleton';
import { TaskAssignedFilter } from '../Filters/TaskFilterAssigned';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/UI/select";
import { Accordion } from "@/components/UI/accordion";
import { Virtuoso } from 'react-virtuoso';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../UI/tooltip';
import { TaskStatusFilter } from '../Filters/TaskFilterStatus';

interface TaskListProps {
    tasks: Task[];
    allAssistants: Assistant[];
    fetchMoreTasks: () => void;
    hasMoreTasks: boolean;
    isLoadingMore: boolean;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    statusFilter: string;
    setStatusFilter: (status: string) => void;
    assignedFilter: string[];
    setAssignedFilter: (ids: string[]) => void;
    isLoadingInitial: boolean;
    initialLoadError: string | null;
    updateTask: TaskActions['update'];
    onTaskUpdate: (taskId: string, updatedFields: Partial<Task>) => void;
    availableStatuses: string[];
    isLoadingStatuses: boolean;
    statusFetchError: string | null;
}

// Footer component for Virtuoso to show loading indicator
const ListFooter = React.memo(({ isLoadingMore }: { isLoadingMore: boolean }) => {
    if (!isLoadingMore) return null;
    return (
        <div className="flex justify-center items-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading more tasks...</span>
        </div>
    );
});
ListFooter.displayName = 'ListFooter';

// Memoize TaskListItem to prevent re-renders if props haven't changed
// This is important for Virtuoso performance
const MemoizedTaskListItem = React.memo(TaskListItem);

export function TaskList({
    tasks,
    allAssistants,
    fetchMoreTasks,
    hasMoreTasks,
    isLoadingMore,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    assignedFilter,
    setAssignedFilter,
    isLoadingInitial,
    initialLoadError,
    updateTask,
    onTaskUpdate,
    availableStatuses,
    isLoadingStatuses,
    statusFetchError
}: TaskListProps) {

    // Create Assistant Map for efficient lookup in TaskListItem
    // This map will be empty if assistants failed to load, which is handled gracefully by TaskListItem
    const assistantMap = React.useMemo(() => {
        const map = new Map<string, Assistant>();
        allAssistants.forEach(assistant => {
            const assistantId = assistant.agent_id;
            map.set(assistantId, assistant);
        });
        return map;
    }, [allAssistants]);

    const virtuosoRef = React.useRef(null);

    // Callback for Virtuoso's endReached, memoized
    const handleEndReached = React.useCallback(() => {
        if (!isLoadingMore && hasMoreTasks) {
            fetchMoreTasks();
        }
    }, [isLoadingMore, hasMoreTasks, fetchMoreTasks]);

    // Render function for Virtuoso items, memoized
    const renderTaskItem = React.useCallback((index: number, task: Task) => {
        return (
            <MemoizedTaskListItem
                key={task.id}
                task={task}
                assistantMap={assistantMap} // Pass potentially empty map
                updateTask={updateTask}
                onTaskUpdate={onTaskUpdate}
            />
        );
    }, [assistantMap, updateTask, onTaskUpdate]);

    const sortedStatuses = React.useMemo(() => {
        return ['all', ...availableStatuses].sort((a, b) => {
             if (a === 'all') return -1;
             if (b === 'all') return 1;
             return a.localeCompare(b);
         });
    }, [availableStatuses]);

    // Determine if filters should be disabled
    // Disable if initial data is loading OR if the initial task load specifically failed
    const disableFilters = isLoadingInitial || !!initialLoadError;
    // Disable assistant filter specifically if assistants aren't loaded/available
    const disableAssistantFilter = disableFilters || allAssistants.length === 0;

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header Area - Filter Controls */}
            <div className="px-4 py-3 border-b">
                <div className='flex flex-wrap gap-2 items-center justify-start'>
                    {/* Search */}
                    <div className="relative flex-grow sm:flex-grow-0 sm:max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search tasks..."
                            className="pl-8 w-full h-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={disableFilters}
                         />
                    </div>
                    {/* Status Filter */}
                    <TaskStatusFilter
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        disableFilters={disableFilters}
                        isLoadingStatuses={isLoadingStatuses}
                        statusFetchError={statusFetchError}
                        sortedStatuses={sortedStatuses}
                    />
                    {/* Assigned Assistant Filter */}
                    <TaskAssignedFilter
                        options={allAssistants}
                        selected={assignedFilter}
                        onChange={setAssignedFilter}
                        placeholder="Assigned"
                        triggerIcon={<Users className="mr-2 h-4 w-4" />}
                        className="w-[180px] h-8"
                        disabled={disableAssistantFilter}
                    />
                </div>
            </div>

            {/* Task Rendering Area - Accordion contains Virtuoso or Skeletons */}
            <Accordion type="multiple" className="flex-1 h-full min-h-0 overflow-y-hidden">
                {isLoadingInitial ? (
                    // Render skeletons within a ScrollArea when initially loading (either assistants or tasks)
                    <ScrollArea className="h-full p-2">
                        <div className="space-y-1">
                            {[...Array(15)].map((_, i) => (
                                <TaskListItemSkeleton key={`task-skeleton-${i}`} />
                            ))}
                        </div>
                    </ScrollArea>
                ) : initialLoadError ? (
                    // Render specific error message if initial *task* load failed
                     <div className="flex flex-col items-center justify-center pt-10 text-center h-full">
                         <WifiOff className="h-8 w-8 text-muted-foreground mb-3" />
                         <p className="text-base font-medium text-muted-foreground">Could not load tasks</p>
                     </div>
                ) : tasks.length > 0 ? (
                    // Render Virtuoso list when not loading and tasks exist
                    // Virtuoso needs a defined height container to work correctly.
                    // The parent div and Accordion provide this via flex-1 and h-full.
                    <Virtuoso
                        ref={virtuosoRef}
                        style={{ height: '100%' }} // Takes full height of the Accordion container
                        data={tasks}
                        endReached={handleEndReached}
                        overscan={200}
                        itemContent={renderTaskItem}
                        components={{
                            Footer: () => <ListFooter isLoadingMore={isLoadingMore} />,
                        }}
                        className="scrollbar-thin scrollbar-thumb-muted-foreground/50 scrollbar-track-transparent"
                     />
                ) : (
                    // Render "No tasks found" message
                    <p className="p-6 text-sm text-muted-foreground text-center">
                        No tasks found matching criteria.
                    </p>
                )}
            </Accordion>
        </div>
    );
}