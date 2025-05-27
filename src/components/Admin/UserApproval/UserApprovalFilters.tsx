import * as React from 'react';
import { Input } from "@/components/UI/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/UI/select";
import { Search, Filter } from "lucide-react";
import { ASSISTANT_HIRING_APPROVAL_DISPLAY, ASSISTANT_HIRING_APPROVAL_ACTIONS } from '@/types/admin';

interface UserApprovalFiltersProps {
    statusFilter: string;
    setStatusFilter: (status: string) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    disabled?: boolean;
}

// const availableStatuses = ["all", "none", ...Object.values(ASSISTANT_HIRING_APPROVAL_ACTIONS)];
const availableStatuses = [...Object.values(ASSISTANT_HIRING_APPROVAL_ACTIONS)];

export function UserApprovalFilters({
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    disabled = false,
}: UserApprovalFiltersProps) {
    return (
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b">
            <div className="relative flex-grow sm:flex-grow-0 sm:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search by email or name..."
                    className="pl-8 w-full h-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={disabled}
                />
            </div>
            <div className="w-full sm:w-auto">
                <Select
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                    disabled={disabled}
                >
                    <SelectTrigger className="w-full sm:w-[200px] h-9">
                        <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableStatuses.map(statusKey => (
                            <SelectItem key={statusKey} value={statusKey} className="capitalize">
                                {ASSISTANT_HIRING_APPROVAL_DISPLAY[statusKey as keyof typeof ASSISTANT_HIRING_APPROVAL_DISPLAY] || statusKey}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
