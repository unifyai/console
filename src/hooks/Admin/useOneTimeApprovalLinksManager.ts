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

    // Ref to track the latest fetch operation
    const fetchIdRef = React.useRef(0);

    const fetchLinksInternal = React.useCallback(async (currentFetchId: number, currentOffset: number, isLoadMore: boolean) => {
        if (isLoadMore) {
            setIsLoadingMore(true);
        } else {
            setIsLoading(true);
            // Only reset links if it's not a loadMore operation for the current fetchId
            if (fetchIdRef.current === currentFetchId) {
                setLinks([]);
            }
        }
        setError(null);

        const result = await adminApprovalActions.listOneTimeLinks(pageSize, currentOffset);
        
        // If this fetch operation is no longer the latest, ignore its result
        if (fetchIdRef.current !== currentFetchId) {
            if (isLoadMore) setIsLoadingMore(false); else setIsLoading(false);
            return;
        }

        if ('detail' in result) {
            const errorMsg = (result as ResponseProps).detail;
            setError(errorMsg);
            if (!isLoadMore) setLinks([]);
            toast.error(`Failed to load links: ${errorMsg}`);
            setHasMore(false);
        } else {
            const newLinks = result as OneTimeLinkEntry[];
            setLinks(prev => {
                if (isLoadMore) {
                    // Ensure not to add duplicates
                    const existingIds = new Set(prev.map(l => l.id));
                    const uniqueNewLinks = newLinks.filter(l => !existingIds.has(l.id));
                    return [...prev, ...uniqueNewLinks];
                }
                return newLinks;
            });
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
        fetchIdRef.current += 1; // Increment for new fetch operation
        const currentFetchId = fetchIdRef.current;
        setOffset(0);
        setHasMore(true);
        fetchLinksInternal(currentFetchId, 0, false);
    }, [fetchLinksInternal]);
    
    const loadMoreLinks = React.useCallback(() => {
        if (!isLoadingMore && hasMore) {
            fetchIdRef.current += 1; // Increment for new fetch operation
            const currentFetchId = fetchIdRef.current;
            fetchLinksInternal(currentFetchId, offset, true);
        }
    }, [isLoadingMore, hasMore, offset, fetchLinksInternal]);

    React.useEffect(() => {
        // The initial fetch is handled by refreshLinks, which already increments fetchIdRef
        refreshLinks();
    }, [refreshLinks]); // refreshLinks is memoized, so this runs once on mount

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