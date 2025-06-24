import * as React from 'react';
import { UserApprovalEntry, AssistantHiringApprovalAction, AdminApprovalActions, ADMIN_TABLE_PAGE_SIZE } from '@/types/admin';
import { ResponseProps } from '@/types/common';
import { showLoadingToast, showErrorToast, showSuccessToast } from '@/components/notifications';

export function useUserApprovals (adminApprovalActions: AdminApprovalActions) {
    const [users, setUsers] = React.useState<UserApprovalEntry[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [offset, setOffset] = React.useState(0);
    const [hasMore, setHasMore] = React.useState(true);
    const pageSize = ADMIN_TABLE_PAGE_SIZE;

    const [statusFilter, setStatusFilter] = React.useState<string>("all");
    
    // Ref to track the latest fetch operation
    const fetchIdRef = React.useRef(0);

    const fetchUsersInternal = React.useCallback(async (currentFetchId: number, currentStatusFilter: string, currentOffset: number, isLoadMore: boolean) => {
        if (isLoadMore) {
            setIsLoadingMore(true);
        } else {
            setIsLoading(true);
            // Only reset users if it's not a loadMore operation for the current fetchId
            if (fetchIdRef.current === currentFetchId) {
                setUsers([]);
            }
        }
        setError(null);

        const apiStatusFilter = currentStatusFilter === "all" ? null : currentStatusFilter;
        const result = await adminApprovalActions.listUsers(apiStatusFilter, pageSize, currentOffset);

        // If this fetch operation is no longer the latest, ignore its result
        if (fetchIdRef.current !== currentFetchId) {
            if (isLoadMore) setIsLoadingMore(false); else setIsLoading(false);
            return;
        }

        if ('detail' in result) {
            setError((result as ResponseProps).detail);
            if (!isLoadMore) setUsers([]);
            showErrorToast(`Failed to load users: ${(result as ResponseProps).detail}`);
            setHasMore(false);
        } else {
            const newUsers = result as UserApprovalEntry[];
            setUsers(prev => {
                if (isLoadMore) {
                    // Ensure not to add duplicates if fetches overlap or data is re-requested
                    const existingIds = new Set(prev.map(u => u.id));
                    const uniqueNewUsers = newUsers.filter(u => !existingIds.has(u.id));
                    return [...prev, ...uniqueNewUsers];
                }
                return newUsers;
            });
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
        fetchIdRef.current += 1; // Increment to signify a new fetch operation
        const currentFetchId = fetchIdRef.current;
        setOffset(0);
        setHasMore(true);
        fetchUsersInternal(currentFetchId, statusFilter, 0, false);
    }, [statusFilter, fetchUsersInternal]);


    const updateUserStatus = async (userId: string, newStatus: AssistantHiringApprovalAction): Promise<boolean> => {
        const toastId = showLoadingToast(`Updating status for user...`);
        const result = await adminApprovalActions.updateUserStatus(userId, newStatus);
        if ('detail' in result) {
            showErrorToast(`Failed: ${(result as ResponseProps).detail}`, `Failed: ${(result as ResponseProps).detail}`, toastId);
            return false;
        } else {
            showSuccessToast((result as ResponseProps).info || "Status updated!", undefined, toastId);
            
            fetchIdRef.current += 1; // Increment for the new fetch
            const currentFetchId = fetchIdRef.current;
            setOffset(0); 
            setHasMore(true);
            // Intentionally not awaiting fetchUsersInternal here, as the function handles its own loading states.
            fetchUsersInternal(currentFetchId, statusFilter, 0, false);
            return true;
        }
    };
    
    const refreshUsers = React.useCallback(() => {
        fetchIdRef.current += 1;
        const currentFetchId = fetchIdRef.current;
        setOffset(0);
        setHasMore(true);
        fetchUsersInternal(currentFetchId, statusFilter, 0, false);
    }, [statusFilter, fetchUsersInternal]);

    const loadMoreUsers = React.useCallback(() => {
        if (!isLoadingMore && hasMore) {
            fetchIdRef.current += 1; // A "load more" is also a new conceptual fetch context
            const currentFetchId = fetchIdRef.current;
            // Pass true for isLoadMore
            fetchUsersInternal(currentFetchId, statusFilter, offset, true);
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