import * as React from 'react';
import { Filter, Search, Users, Loader2, AlertCircle, WifiOff } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/UI/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../UI/tooltip';

interface TaskStatusFilterProps {
    statusFilter: string,
    setStatusFilter: (status: string) => void,
    disableFilters: boolean,
    isLoadingStatuses: boolean,
    statusFetchError: string | null,
    sortedStatuses: string[],

}

export function TaskStatusFilter({
    statusFilter,
    setStatusFilter,
    disableFilters,
    isLoadingStatuses,
    statusFetchError,
    sortedStatuses
}: TaskStatusFilterProps) {

    return (
        <div className="relative">
            <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
                disabled={disableFilters || isLoadingStatuses || !!statusFetchError}
            >
                <SelectTrigger className="w-[160px] flex-shrink-0 h-8">
                    <Filter className="h-4 w-4 mr-2"/>
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    {isLoadingStatuses ? (
                        <div className="flex items-center justify-center p-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading statuses...
                        </div>
                    ) : statusFetchError ? (
                        // Show error within dropdown if status fetch failed
                        <div className="flex items-center p-2 text-sm text-destructive justify-center">
                            <AlertCircle className="h-4 w-4 mr-1" /> Error loading
                        </div>
                    ) : sortedStatuses.length > 1 ? ( // Check length > 1 because 'all' is always present
                        sortedStatuses.map(status => (
                            <SelectItem key={status} value={status ?? "all"}>
                                {status === 'all' ? 'All Statuses' : status}
                            </SelectItem>
                        ))
                    ) : (
                        <div className="p-2 text-sm text-muted-foreground text-center">No statuses found</div>
                    )}
                </SelectContent>
            </Select>
            {/* Error Tooltip for Status Filter */}
            {statusFetchError && !isLoadingStatuses && (
                    <TooltipProvider delayDuration={100}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center">
                                <AlertCircle className="h-full w-full text-destructive" />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p className="text-xs max-w-xs">{statusFetchError}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>

    )
}
