import * as React from 'react';
import { Input } from "@/components/UI/input";
import { ScrollArea } from "@/components/UI/scroll-area";
import { Filter, Search } from "lucide-react";
import type { Assistant } from "@/types/team/assistant";
import { TaskListItem } from "./TaskListItem";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/UI/select";
import { Accordion } from "@/components/UI/accordion";

interface TaskListProps {
    assistant: Assistant;
}

export function TaskList({ assistant }: TaskListProps) {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<string>('all');

    const filteredTasks = React.useMemo(() => {
        let tasks = assistant.tasks;
        if (statusFilter !== 'all') {
            tasks = tasks.filter(task => task.status === statusFilter);
        }
        if (searchTerm) {
            tasks = tasks.filter(task =>
                task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        return tasks;
    }, [assistant.tasks, searchTerm, statusFilter]);

    const taskStatuses = ['all', ...Array.from(new Set(assistant.tasks.map(t => t.status)))];

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header Area */}
            <div className="px-4 py-3 border-b space-y-3">

                {/* Filter/Search/View Row */}
                <div className='flex gap-2 items-center justify-between'>
                    <div className="flex gap-2 items-center flex-1 min-w-0">
                        <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search tasks..."
                                className="pl-8 w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[160px] flex-shrink-0">
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
                    </div>
                </div>
            </div>

            {/* Task Rendering Area */}
            <ScrollArea className="flex-1">
                {filteredTasks.length > 0 ? (
                    <Accordion
                        type="single"
                        collapsible
                        className="w-full"
                    >
                         {filteredTasks.map((task) => (
                            <TaskListItem
                                key={task.id}
                                task={task}
                            />
                        ))}
                    </Accordion>
                ) : (
                    <p className="p-4 text-sm text-muted-foreground text-center">No tasks found matching criteria.</p>
                )}
            </ScrollArea>
        </div>
    );
}