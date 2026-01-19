import * as React from 'react';
import { Input } from '@/components/UI/input';
import { Search, Loader2, WifiOff } from 'lucide-react';
import type { Task, TaskActions } from '@/types/assistants/task';
import { TaskListItem } from './TaskListItem';
import { TaskListItemSkeleton } from './TaskListItemSkeleton';
import { Accordion } from '@/components/UI/accordion';
import { Virtuoso } from 'react-virtuoso';
import { ScrollArea, ScrollBar } from '@/components/UI/scroll-area';
import { TaskStatusFilter } from '../Filters/TaskFilterStatus';
import { TaskPriorityFilter } from '../Filters/TaskFilterPriority';
import { TaskDeadlineFilter } from '../Filters/TaskFilterDeadline';
import { Assistant } from '@/types/assistants/assistant';
import { TaskAssistantFilter } from '../Filters/TaskFilterAssistant';

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
  assistants: Assistant[];
  assistantFilter: string;
  setAssistantFilter: (value: string) => void;
  /** Function to check if user can write to a specific assistant */
  canWriteAssistant?: (assistant: Assistant) => boolean;
}

const ListFooter = React.memo(({ isLoadingMore }: { isLoadingMore: boolean }) => {
  if (!isLoadingMore) return null;
  return (
    <div className="flex items-center justify-center p-4">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <span className="text-body ml-2 text-muted-foreground">Loading more tasks...</span>
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
  assistants,
  assistantFilter,
  setAssistantFilter,
  canWriteAssistant,
}: TaskListProps) {
  const virtuosoRef = React.useRef(null);

  const handleEndReached = React.useCallback(() => {
    if (!isLoadingMore && hasMoreTasks) {
      fetchMoreTasks();
    }
  }, [isLoadingMore, hasMoreTasks, fetchMoreTasks]);

  const renderTaskItem = React.useCallback(
    (index: number, task: Task) => {
      const assistant = assistants.find((a) => a.agentId === task.assistantId);
      if (!assistant) return null; // Don't render a task if its assistant isn't found
      const canEditTask = canWriteAssistant ? canWriteAssistant(assistant) : true;
      return (
        <MemoizedTaskListItem
          key={task.taskId}
          task={task}
          assistant={assistant}
          updateTask={updateTask}
          onTaskUpdate={onTaskUpdate}
          canEditTask={canEditTask}
        />
      );
    },
    [updateTask, onTaskUpdate, assistants, canWriteAssistant]
  );

  const sortedStatuses = React.useMemo(() => {
    return [...availableStatuses].sort((a, b) => {
      if (a === 'all') return -1;
      if (b === 'all') return 1;
      return a.localeCompare(b);
    });
  }, [availableStatuses]);

  const disableFilters = isLoadingInitial || !!initialLoadError;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header Area - Filter Controls */}
      <div className="border-b px-4 py-3">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex w-max items-center space-x-2">
            {/* Search */}
            <div className="relative flex-grow sm:max-w-xs sm:flex-grow-0">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search tasks..."
                className="h-8 w-full pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={disableFilters}
              />
            </div>
            {/* Assistant Filter */}
            <TaskAssistantFilter
              assistants={assistants}
              assistantFilter={assistantFilter}
              setAssistantFilter={setAssistantFilter}
              disableFilters={disableFilters}
            />
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
          <ScrollBar orientation="horizontal" className="hidden" />
        </ScrollArea>
      </div>

      {/* Task Rendering Area - Accordion contains Virtuoso or Skeletons */}
      <Accordion type="multiple" className="h-full min-h-0 flex-1 overflow-y-hidden">
        {isLoadingInitial ? (
          <ScrollArea className="h-full p-2">
            <div className="space-y-1">
              {[...Array(15)].map((_, i) => (
                <TaskListItemSkeleton key={`task-skeleton-${i}`} />
              ))}
            </div>
          </ScrollArea>
        ) : initialLoadError ? (
          <div className="flex h-full flex-col items-center justify-center pt-10 text-center">
            <WifiOff className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-body text-strong text-muted-foreground">Could not load tasks</p>
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
          <p className="text-body p-6 text-center text-muted-foreground">
            No tasks found matching criteria.
          </p>
        )}
      </Accordion>
    </div>
  );
}
