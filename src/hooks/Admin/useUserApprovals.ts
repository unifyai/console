import * as React from 'react';
import { UserApprovalEntry, AssistantHiringApprovalAction, AdminApprovalActions, ADMIN_TABLE_PAGE_SIZE } from '@/types/admin';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';

export function useUserApprovals (adminApprovalActions: AdminApprovalActions) {
    const [users, setUsers] = React.useState<UserApprovalEntry[]>([]);
    const [isLoading, setIsLoading] = React.useState(true); // For initial page load
    const [isLoadingMore, setIsLoadingMore] = React.useState(false); // For loading more items
    const [error, setError] = React.useState<string | null>(null);
    const [offset, setOffset] = React.useState(0);
    const [hasMore, setHasMore] = React.useState(true);
    const pageSize = ADMIN_TABLE_PAGE_SIZE;

    const [statusFilter, setStatusFilter] = React.useState<string>("all"); 

    const fetchUsersInternal = React.useCallback(async (currentStatusFilter: string, currentOffset: number, isLoadMore: boolean) => {
        if (isLoadMore) {
            setIsLoadingMore(true);
        } else {
            setIsLoading(true);
            setUsers([]); // Reset for refresh or filter change
        }
        setError(null);

        const apiStatusFilter = currentStatusFilter === "all" ? null : currentStatusFilter;
        const result = await adminApprovalActions.listUsers(apiStatusFilter, pageSize, currentOffset);

        if ('detail' in result) {
            setError((result as ResponseProps).detail);
            if (!isLoadMore) setUsers([]);
            toast.error(`Failed to load users: ${(result as ResponseProps).detail}`);
            setHasMore(false); // Stop further pagination on error
        } else {
            const newUsers = result as UserApprovalEntry[];
            setUsers(prev => isLoadMore ? [...prev, ...newUsers] : newUsers);
            setOffset(currentOffset + newUsers.length);
            setHasMore(newUsers.length === pageSize);
        }
        
        if (isLoadMore) {
            setIsLoadingMore(false);
        } else {
            setIsLoading(false);
        }
    }, [adminApprovalActions, pageSize]);

    // Effect for status filter changes
    React.useEffect(() => {
        setOffset(0); // Reset offset when filter changes
        setHasMore(true); // Assume there's more with new filter
        fetchUsersInternal(statusFilter, 0, false);
    }, [statusFilter, fetchUsersInternal]);


    const updateUserStatus = async (userId: string, newStatus: AssistantHiringApprovalAction): Promise<boolean> => {
        const toastId = toast.loading(`Updating status for user...`);
        const result = await adminApprovalActions.updateUserStatus(userId, newStatus);
        if ('detail' in result) {
            toast.error(`Failed: ${(result as ResponseProps).detail}`, { id: toastId });
            return false;
        } else {
            toast.success((result as ResponseProps).info || "Status updated!", { id: toastId });
            // Refresh the list for the current filter to get the most up-to-date data
            setOffset(0); // Reset offset to refetch from the beginning
            setHasMore(true);
            fetchUsersInternal(statusFilter, 0, false);
            return true;
        }
    };
    
    const refreshUsers = React.useCallback(() => {
        setOffset(0);
        setHasMore(true);
        fetchUsersInternal(statusFilter, 0, false);
    }, [statusFilter, fetchUsersInternal]);

    const loadMoreUsers = React.useCallback(() => {
        if (!isLoadingMore && hasMore) {
            fetchUsersInternal(statusFilter, offset, true);
        }
    }, [statusFilter, offset, isLoadingMore, hasMore, fetchUsersInternal]);


    return {
        users,
        isLoading,
        isLoadingMore,
        hasMore,
        error,
        statusFilter,
        setStatusFilter,
        updateUserStatus,
        refreshUsers,
        loadMoreUsers,
    };
}
