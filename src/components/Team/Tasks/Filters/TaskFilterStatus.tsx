import * as React from 'react';
import { Filter, Loader2, AlertCircle } from "lucide-react"; // Removed unused icons like Search, Users, WifiOff
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/UI/select";
import { Status as TaskStatusEnum } from '@/types/team/task';

interface TaskStatusFilterProps {
    statusFilter: string;
    setStatusFilter: (status: string) => void;
    disableFilters: boolean;
    availableStatuses: string[];
}

export function TaskStatusFilter({
    statusFilter,
    setStatusFilter,
    disableFilters,
    availableStatuses,
}: TaskStatusFilterProps) {

    return (
        <div className="relative">
            <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
                disabled={disableFilters}
            >
                <SelectTrigger className="w-[160px] flex-shrink-0 h-8">
                    <Filter className="h-4 w-4 mr-2"/>
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    {availableStatuses.length > 0 ? ( 
                        availableStatuses.map(status => (
                            <SelectItem key={status} value={status} className="capitalize">
                                {status === 'all' ? 'All Statuses' : status}
                            </SelectItem>
                        ))
                    ) : (
                        <div className="p-2 text-sm text-muted-foreground text-center">No statuses to show</div>
                    )}
                </SelectContent>
            </Select>
        </div>
    );
}