import * as React from 'react';
import { CalendarDays, Filter } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/UI/select";
import { cn } from '@/lib/utils';

interface TaskDeadlineFilterProps {
    deadlineFilter: string; // e.g., 'all', 'overdue', 'today', 'this_week'
    setDeadlineFilter: (deadlineOption: string) => void;
    disableFilters: boolean;
}

const deadlineOptions = [
    { value: 'all', label: "All Deadlines", icon: Filter, iconClassName: "" },
    { value: 'overdue', label: "Overdue", icon: CalendarDays, iconClassName: "text-destructive" },
    { value: 'today', label: "Today", icon: CalendarDays, iconClassName: "text-primary" },
    { value: 'tomorrow', label: "Tomorrow", icon: CalendarDays, iconClassName: "text-primary" },
    { value: 'this_week', label: "This Week", icon: CalendarDays, iconClassName: "text-secondary" },
    { value: 'no_deadline', label: "No Deadline", icon: CalendarDays, iconClassName: "text-muted-foreground" },
];

export function TaskDeadlineFilter({
    deadlineFilter,
    setDeadlineFilter,
    disableFilters,
}: TaskDeadlineFilterProps) {

    const SelectedIcon = deadlineOptions.find(opt => opt.value === deadlineFilter)?.icon || Filter;
    const selectedIconClassName = deadlineOptions.find(opt => opt.value === deadlineFilter)?.iconClassName || "";

    return (
        <div className="relative">
            <Select
                value={deadlineFilter}
                onValueChange={setDeadlineFilter}
                disabled={disableFilters}
            >
                <SelectTrigger className="w-[160px] flex-shrink-0 h-8">
                    <SelectedIcon className={cn("h-3.5 w-3.5", selectedIconClassName)} />
                    <SelectValue placeholder="Filter by deadline" />
                </SelectTrigger>
                <SelectContent>
                    {deadlineOptions.map(opt => {
                        const IconComponent = opt.icon;
                        return (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
        </div>
    );
}