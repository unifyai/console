import * as React from 'react';
import { UserApprovalEntry, AssistantHiringApprovalAction, AdminApprovalActions } from '@/types/admin';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { useDebounce } from 'react-use';

export function useUserApprovals (adminApprovalActions: AdminApprovalActions) {
    const [allUsers, setAllUsers] = React.useState<UserApprovalEntry[]>([]);
    const [filteredUsers, setFilteredUsers] = React.useState<UserApprovalEntry[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const [statusFilter, setStatusFilter] = React.useState<string>("pending"); // 'all', 'pending', 'approved', 'rejected', 'revoked', 'none'
    const [searchTerm, setSearchTerm] = React.useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState("");

    useDebounce(() => setDebouncedSearchTerm(searchTerm), 300, [searchTerm]);

    const fetchUsers = React.useCallback(async (currentStatusFilter: string) => {
        setIsLoading(true);
        setError(null);
        const result = await adminApprovalActions.listUsers(currentStatusFilter === "all" ? null : currentStatusFilter);
        if ('detail' in result) {
            setError((result as ResponseProps).detail);
            setAllUsers([]);
            toast.error(`Failed to load users: ${(result as ResponseProps).detail}`);
        } else {
            setAllUsers(result as UserApprovalEntry[]);
        }
        setIsLoading(false);
    }, []);

    React.useEffect(() => {
        fetchUsers(statusFilter);
    }, [fetchUsers, statusFilter]);

    React.useEffect(() => {
        let usersToDisplay = [...allUsers];
        if (debouncedSearchTerm) {
            const lowerSearch = debouncedSearchTerm.toLowerCase();
            usersToDisplay = usersToDisplay.filter(user =>
                user.email.toLowerCase().includes(lowerSearch) ||
                (user.name && user.name.toLowerCase().includes(lowerSearch))
            );
        }
        // Status filtering is now done by the API, but if we wanted combined client/server:
        // if (statusFilter !== "all") {
        //     usersToDisplay = usersToDisplay.filter(user =>
        //         statusFilter === "none" ? user.assistant_hiring_approval === null : user.assistant_hiring_approval === statusFilter
        //     );
        // }
        setFilteredUsers(usersToDisplay);
    }, [allUsers, debouncedSearchTerm, statusFilter]);


    const updateUserStatus = async (userId: string, newStatus: AssistantHiringApprovalAction) => {
        const toastId = toast.loading(`Updating status for user ${userId}...`);
        const result = await adminApprovalActions.updateUserStatus(userId, newStatus);
        if ('detail' in result) {
            toast.error(`Failed: ${(result as ResponseProps).detail}`, { id: toastId });
            return false;
        } else {
            toast.success((result as ResponseProps).info || "Status updated!", { id: toastId });
            // Refresh the list for the current filter to get the most up-to-date data
            fetchUsers(statusFilter);
            return true;
        }
    };

    return {
        users: filteredUsers, // Use filteredUsers for display
        isLoading,
        error,
        statusFilter,
        setStatusFilter,
        searchTerm,
        setSearchTerm,
        updateUserStatus,
        refreshUsers: () => fetchUsers(statusFilter),
    };
}
