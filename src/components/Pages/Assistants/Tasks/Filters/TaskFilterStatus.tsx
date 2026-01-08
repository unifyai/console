import * as React from 'react';
import { Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';

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
      <Select value={statusFilter} onValueChange={setStatusFilter} disabled={disableFilters}>
        <SelectTrigger className="h-8 w-[150px] flex-shrink-0">
          <Filter className="h-4 w-4" />
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          {availableStatuses.length > 0 ? (
            availableStatuses.map((status) => (
              <SelectItem key={status} value={status} className="capitalize">
                {status === 'all' ? 'All Statuses' : status}
              </SelectItem>
            ))
          ) : (
            <div className="text-body p-2 text-center text-muted-foreground">
              No statuses to show
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
