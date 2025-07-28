import * as React from 'react';
import { Zap, AlertTriangle, Minus, Filter } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/UI/select";
import { Priority } from '@/types/assistants/task';
import { cn } from '@/lib/utils';

interface TaskPriorityFilterProps {
    priorityFilter: string;
    setPriorityFilter: (priority: string) => void;
    disableFilters: boolean;
}

const getPriorityDetails = (priority: Priority | 'all') => {
    switch (priority) {
        case Priority.urgent: return { icon: Zap, label: "Urgent", iconClassName: "text-red-500" };
        case Priority.high: return { icon: AlertTriangle, label: "High", iconClassName: "text-orange-500" };
        case Priority.normal: return { icon: Minus, label: "Normal", iconClassName: "text-blue-500" };
        case Priority.low: return { icon: Minus, label: "Low", iconClassName: "text-green-500" };
        default: return { icon: Filter, label: "All Priorities", iconClassName: "" };
    }
};

export function TaskPriorityFilter({
    priorityFilter,
    setPriorityFilter,
    disableFilters,
}: TaskPriorityFilterProps) {

    const priorityOptions = ['all', ...Object.values(Priority)];
    const currentPriorityDetails = getPriorityDetails(priorityFilter as Priority | 'all');
    const SelectedIcon = currentPriorityDetails.icon;

    return (
        <div className="relative">
            <Select
                value={priorityFilter}
                onValueChange={setPriorityFilter}
                disabled={disableFilters}
            >
                <SelectTrigger className="w-[160px] flex-shrink-0 h-8">
                    <SelectedIcon className={cn("h-3.5 w-3.5 mr-2", currentPriorityDetails.iconClassName)} />
                    <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                    {priorityOptions.map(p => {
                        const details = getPriorityDetails(p as Priority | 'all');
                        const IconComponent = details.icon;
                        return (
                            <SelectItem key={p} value={p} className="capitalize">
                                {details.label}
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
        </div>
    );
}