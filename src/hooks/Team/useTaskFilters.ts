import * as React from 'react';
import { useDebounce } from 'react-use';

// Helper function (can be in a lib file)
const buildFilterExpression = (searchTerm: string, statusFilter: string, assignedFilter: string[]): string | null => {
    const filters: string[] = [];
    if (searchTerm) {
        const safeSearchTerm = searchTerm.replace(/["']/g, ''); // Basic sanitization
        filters.push(`"${safeSearchTerm}" in str(title)`); // Adapt if title is not always string
    }
    if (statusFilter !== 'all') {
        filters.push(`status == '${statusFilter}'`);
    }
    if (assignedFilter.length > 0) {
        const assignedClauses = assignedFilter.map(id => `'${id}' in assignedAssistantIds`);
        filters.push(`(${assignedClauses.join(" or ")})`);
    }
    return filters.length > 0 ? filters.join(" and ") : null;
};


export function useTaskFilters(initialSearchTerm = '', initialStatus = 'all', initialAssigned: string[] = []) {
    const [searchTermInput, setSearchTermInput] = React.useState(initialSearchTerm);
    const [statusFilter, setStatusFilter] = React.useState<string>(initialStatus);
    const [assignedFilter, setAssignedFilter] = React.useState<string[]>(initialAssigned);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState(initialSearchTerm);

    useDebounce(() => setDebouncedSearchTerm(searchTermInput), 300, [searchTermInput]);

    const filterExpression = React.useMemo(() =>
        buildFilterExpression(debouncedSearchTerm, statusFilter, assignedFilter),
    [debouncedSearchTerm, statusFilter, assignedFilter]);

    return {
        searchTermInput,
        setSearchTermInput,
        statusFilter,
        setStatusFilter,
        assignedFilter,
        setAssignedFilter,
        filterExpression, // This is the combined expression
        debouncedSearchTerm // If needed separately
    };
}