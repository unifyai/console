import * as React from 'react';
import { useDebounce } from 'react-use';
import { Status as TaskStatusEnum } from '@/types/assistants/task';

// Helper to get UTC midnight of a date
const getUTCMidnight = (date: Date): Date => {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
};

// Helper to get UTC end of day
const getUTCEndOfDay = (date: Date): Date => {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}

const buildFilterExpression = (
    searchTerm: string, 
    statusFilter: string,
    priorityFilter: string,
    deadlineFilter: string 
): string | null => {
    const filters: string[] = [];
    if (searchTerm) {
        const safeSearchTerm = searchTerm.replace(/["']/g, ''); 
        filters.push(`("${safeSearchTerm}" in str(name) or "${safeSearchTerm}" in str(description))`); 
    }
    if (statusFilter !== 'all') {
        filters.push(`status == '${statusFilter}'`);
    }
    if (priorityFilter !== 'all') {
        filters.push(`priority == '${priorityFilter}'`);
    }

    // Deadline filter logic
    const now = new Date();
    const todayStart = getUTCMidnight(now);
    const todayEnd = getUTCEndOfDay(now);

    switch (deadlineFilter) {
        case 'overdue':
            filters.push(`deadline < '${now.toISOString()}' and status != '${TaskStatusEnum.completed}'`);
            break;
        case 'today':
            filters.push(`deadline >= '${todayStart.toISOString()}' and deadline <= '${todayEnd.toISOString()}'`);
            break;
        case 'tomorrow':
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            const tomorrowStart = getUTCMidnight(tomorrow);
            const tomorrowEnd = getUTCEndOfDay(tomorrow);
            filters.push(`deadline >= '${tomorrowStart.toISOString()}' and deadline <= '${tomorrowEnd.toISOString()}'`);
            break;
        case 'this_week':
            const currentDay = now.getUTCDay(); // Sunday - Saturday : 0 - 6
            const firstDayOfWeek = new Date(now);
            firstDayOfWeek.setUTCDate(now.getUTCDate() - currentDay + (currentDay === 0 ? -6 : 1)); // Adjust to Monday as start of week
            const weekStart = getUTCMidnight(firstDayOfWeek);

            const lastDayOfWeek = new Date(weekStart);
            lastDayOfWeek.setUTCDate(weekStart.getUTCDate() + 6);
            const weekEnd = getUTCEndOfDay(lastDayOfWeek);
            filters.push(`deadline >= '${weekStart.toISOString()}' and deadline <= '${weekEnd.toISOString()}'`);
            break;
        case 'no_deadline':
            filters.push(`deadline == None`); // Assuming backend handles null for no deadline
            break;
        // 'all' case needs no filter for deadline
    }

    return filters.length > 0 ? filters.join(" and ") : null;
};


export function useTaskFilters(
    initialSearchTerm = '', 
    initialStatus = 'all',
    initialPriority = 'all',
    initialDeadline = 'all',
    initialAssistant = 'all'
) {
    const [searchTermInput, setSearchTermInput] = React.useState(initialSearchTerm);
    const [statusFilter, setStatusFilter] = React.useState<string>(initialStatus);
    const [priorityFilter, setPriorityFilter] = React.useState<string>(initialPriority);
    const [deadlineFilter, setDeadlineFilter] = React.useState<string>(initialDeadline);
    const [assistantFilter, setAssistantFilter] = React.useState<string>(initialAssistant);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState(initialSearchTerm);

    useDebounce(() => setDebouncedSearchTerm(searchTermInput), 300, [searchTermInput]);

    const filterExpression = React.useMemo(() =>
        buildFilterExpression(debouncedSearchTerm, statusFilter, priorityFilter, deadlineFilter),
    [debouncedSearchTerm, statusFilter, priorityFilter, deadlineFilter]);

    return {
        searchTermInput,
        setSearchTermInput,
        statusFilter,
        setStatusFilter,
        priorityFilter,
        setPriorityFilter,
        deadlineFilter,
        setDeadlineFilter,
        assistantFilter,
        setAssistantFilter,
        filterExpression, 
        debouncedSearchTerm 
    };
}