import * as React from 'react';
import { OneTimeLinkEntry, AdminApprovalActions, ADMIN_TABLE_PAGE_SIZE } from '@/types/admin';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';

export function useOneTimeApprovalLinksManager(adminApprovalActions: AdminApprovalActions) {
    const [links, setLinks] = React.useState<OneTimeLinkEntry[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [offset, setOffset] = React.useState(0);
    const [hasMore, setHasMore] = React.useState(true);
    const pageSize = ADMIN_TABLE_PAGE_SIZE;

    const fetchLinksInternal = React.useCallback(async (currentOffset: number, isLoadMore: boolean) => {
        if (isLoadMore) {
            setIsLoadingMore(true);
        } else {
            setIsLoading(true);
            setLinks([]); // Reset for refresh
        }
        setError(null);

        const result = await adminApprovalActions.listOneTimeLinks(pageSize, currentOffset);
        
        if ('detail' in result) {
            const errorMsg = (result as ResponseProps).detail;
            setError(errorMsg);
            if (!isLoadMore) setLinks([]);
            toast.error(`Failed to load links: ${errorMsg}`);
            setHasMore(false);
        } else {
            const newLinks = result as OneTimeLinkEntry[];
            setLinks(prev => isLoadMore ? [...prev, ...newLinks] : newLinks);
            setOffset(currentOffset + newLinks.length);
            setHasMore(newLinks.length === pageSize);
        }

        if (isLoadMore) {
            setIsLoadingMore(false);
        } else {
            setIsLoading(false);
        }
    }, [adminApprovalActions, pageSize]);

    const refreshLinks = React.useCallback(() => {
        setOffset(0);
        setHasMore(true);
        fetchLinksInternal(0, false);
    }, [fetchLinksInternal]);
    
    const loadMoreLinks = React.useCallback(() => {
        if (!isLoadingMore && hasMore) {
            fetchLinksInternal(offset, true);
        }
    }, [isLoadingMore, hasMore, offset, fetchLinksInternal]);

    React.useEffect(() => {
        refreshLinks(); // Initial fetch
    }, [refreshLinks]);

    const deleteLink = async (linkId: string): Promise<boolean> => {
        const toastId = toast.loading(`Deleting link...`);
        const result = await adminApprovalActions.deleteOneTimeLink(linkId);
        if ('detail' in result) {
            toast.error(`Failed: ${(result as ResponseProps).detail}`, { id: toastId });
            return false;
        } else {
            toast.success((result as ResponseProps).info || "Link deleted!", { id: toastId });
            setLinks(prev => prev.filter(link => link.id !== linkId));
            return true;
        }
    };

    return {
        links,
        isLoading,
        isLoadingMore,
        hasMore,
        error,
        refreshLinks,
        deleteLink,
        loadMoreLinks,
    };
}