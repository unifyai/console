import * as React from 'react';
import { Input } from "@/components/UI/input";
import { ScrollArea } from "@/components/UI/scroll-area";
import { Filter, Search, MoreVertical, Copy, Users, Calendar, EllipsisVertical
} from "lucide-react";
import type { Assistant } from "@/types/team/assistant";
import type { Task } from "@/types/team/task";
import { TaskListItem } from "./TaskListItem";
import ActionButton from '../Common/Buttons/Action';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/UI/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/UI/dropdown-menu";
import { Accordion } from "@/components/UI/accordion";
import { TaskAssignedFilter } from './TaskAssignedFilter'; // Import TaskAssignedFilter

interface TaskListProps {
    // No longer receives single assistant
    allTasks: Task[];
    allAssistants: Assistant[];
}

export function TaskList({ allTasks, allAssistants }: TaskListProps) {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<string>('all');
    const [assignedFilter, setAssignedFilter] = React.useState<string[]>([]); // State for multi-select

    // Filter tasks based on all criteria
    const filteredTasks = React.useMemo(() => {
        let tasks = allTasks;

        // Filter by Status
        if (statusFilter !== 'all') {
            tasks = tasks.filter(task => task.status === statusFilter);
        }

        // Filter by Assigned Assistants (if any selected)
        if (assignedFilter.length > 0) {
            tasks = tasks.filter(task =>
                assignedFilter.every(selectedId =>
                    task.assignedAssistantIds.includes(selectedId)
                )
                // Use .some if you want tasks assigned to ANY of the selected assistants
                // task.assignedAssistantIds.some(assignedId => assignedFilter.includes(assignedId))
            );
        }

        // Filter by Search Term
        if (searchTerm) {
            tasks = tasks.filter(task =>
                task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Optional: Sort tasks (e.g., by due date)
        tasks.sort((a, b) => {
            const dateA = a.dueDate?.getTime() ?? Infinity; // Tasks without due date last
            const dateB = b.dueDate?.getTime() ?? Infinity;
            return dateA - dateB;
        });

        return tasks;
    }, [allTasks, searchTerm, statusFilter, assignedFilter]);

    // Create unique list of statuses present in the *original* task list for the filter
    const taskStatuses = ['all', ...Array.from(new Set(allTasks.map(t => t.status)))];

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header Area */}
            <div className="px-4 py-3 border-b">
                {/* Filters Row */}
                <div className='flex flex-wrap gap-2 items-center justify-start'> {/* Changed layout */}
                    {/* Search */}
                    <div className="relative flex-grow sm:flex-grow-0 sm:max-w-xs"> {/* Control width */}
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search tasks..."
                            className="pl-8 w-full h-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                         />
                    </div>
                    {/* Status Filter */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[160px] flex-shrink-0 h-8">
                            <Filter className="h-4 w-4 mr-2"/>
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            {taskStatuses.map(status => (
                                <SelectItem key={status} value={status}>
                                    {status === 'all' ? 'All Statuses' : status}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     {/* Assigned Assistant Filter */}
                    <TaskAssignedFilter
                        options={allAssistants}
                        selected={assignedFilter}
                        onChange={setAssignedFilter}
                        placeholder="Assigned"
                        triggerIcon={<Users className="mr-2 h-4 w-4" />} // Specific icon
                        className="w-[180px] h-8" // Adjust width
                    />
                </div>
            </div>

            {/* Task Rendering Area */}
            <ScrollArea className="flex-1">
                {filteredTasks.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full">
                         {filteredTasks.map((task) => (
                            <TaskListItem
                                key={task.id}
                                task={task}
                                allAssistants={allAssistants} // Pass assistants for avatar lookup
                            />
                        ))}
                    </Accordion>
                ) : (
                    <p className="p-6 text-sm text-muted-foreground text-center">No tasks found matching criteria.</p>
                )}
            </ScrollArea>
        </div>
    );
}