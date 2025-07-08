import * as React from 'react';
import { Input } from "@/components/UI/input";
import { Filter, Search, Users, Loader2, AlertCircle, WifiOff } from "lucide-react"; 
import type { Task, TaskActions } from "@/types/team/task"; 
import { TaskListItem } from "./TaskListItem";
import { TaskListItemSkeleton } from './TaskListItemSkeleton';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../../UI/tooltip';
import { TaskStatusFilter } from '../Filters/TaskFilterStatus';
import { TaskPriorityFilter } from '../Filters/TaskFilterPriority';
import { TaskDeadlineFilter } from '../Filters/TaskFilterDeadline';

interface TaskListProps {
    tasks: Task[];
    fetchMoreTasks: () => void;
    hasMoreTasks: boolean;
    isLoadingMore: boolean;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    statusFilter: string;
    setStatusFilter: (status: string) => void;
    priorityFilter: string; 
    setPriorityFilter: (priority: string) => void;
    deadlineFilter: string; 
    setDeadlineFilter: (deadline: string) => void;
    isLoadingInitial: boolean;
    initialLoadError: string | null;
    updateTask: TaskActions['update'];
    onTaskUpdate: (taskId: number, updatedFields: Partial<Task>) => void;
    availableStatuses: string[];
}

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

const MemoizedTaskListItem = React.memo(TaskListItem);

export function TaskList({
    tasks,
    fetchMoreTasks,
    hasMoreTasks,
    isLoadingMore,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    deadlineFilter,
    setDeadlineFilter,
    isLoadingInitial,
    initialLoadError,
    updateTask,
    onTaskUpdate,
    availableStatuses,
    // isLoadingStatuses, statusFetchError removed
}: TaskListProps) {

    const virtuosoRef = React.useRef(null);

    const handleEndReached = React.useCallback(() => {
        if (!isLoadingMore && hasMoreTasks) {
            fetchMoreTasks();
        }
    }, [isLoadingMore, hasMoreTasks, fetchMoreTasks]);

    const renderTaskItem = React.useCallback((index: number, task: Task) => {
        return (
            <MemoizedTaskListItem
                key={task.task_id} 
                task={task}
                updateTask={updateTask}
                onTaskUpdate={onTaskUpdate}
            />
        );
    }, [updateTask, onTaskUpdate]); 

    const sortedStatuses = React.useMemo(() => {
        return [...availableStatuses].sort((a, b) => {
             if (a === 'all') return -1;
             if (b === 'all') return 1;
             return a.localeCompare(b);
         });
    }, [availableStatuses]);

    const disableFilters = isLoadingInitial || !!initialLoadError;

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
                        availableStatuses={sortedStatuses}
                    />
                    {/* Priority Filter */}
                    <TaskPriorityFilter
                        priorityFilter={priorityFilter}
                        setPriorityFilter={setPriorityFilter}
                        disableFilters={disableFilters}
                    />
                    {/* Deadline Filter */}
                    <TaskDeadlineFilter
                        deadlineFilter={deadlineFilter}
                        setDeadlineFilter={setDeadlineFilter}
                        disableFilters={disableFilters}
                    />
                </div>
            </div>

            {/* Task Rendering Area - Accordion contains Virtuoso or Skeletons */}
            <Accordion type="multiple" className="flex-1 h-full min-h-0 overflow-y-hidden">
                {isLoadingInitial ? (
                    <ScrollArea className="h-full p-2">
                        <div className="space-y-1">
                            {[...Array(15)].map((_, i) => (
                                <TaskListItemSkeleton key={`task-skeleton-${i}`} />
                            ))}
                        </div>
                    </ScrollArea>
                ) : initialLoadError ? (
                     <div className="flex flex-col items-center justify-center pt-10 text-center h-full">
                         <WifiOff className="h-8 w-8 text-muted-foreground mb-3" />
                         <p className="text-base font-medium text-muted-foreground">Could not load tasks</p>
                     </div>
                ) : tasks.length > 0 ? (
                    <Virtuoso
                        ref={virtuosoRef}
                        style={{ height: '100%' }} 
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
                    <p className="p-6 text-sm text-muted-foreground text-center">
                        No tasks found matching criteria.
                    </p>
                )}
            </Accordion>
        </div>
    );
}