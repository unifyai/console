import * as React from 'react';
import { OneTimeLinkEntry, AdminApprovalActions } from '@/types/admin';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';

export function useOneTimeApprovalLinksManager(adminApprovalActions: AdminApprovalActions) {
    const [links, setLinks] = React.useState<OneTimeLinkEntry[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    // Pagination state if needed in the future
    // const [limit, setLimit] = React.useState(100);
    // const [offset, setOffset] = React.useState(0);

    const fetchLinks = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const result = await adminApprovalActions.listOneTimeLinks(); // Add limit/offset if pagination is implemented
        if ('detail' in result) {
            const errorMsg = (result as ResponseProps).detail;
            setError(errorMsg);
            setLinks([]);
            toast.error(`Failed to load links: ${errorMsg}`);
        } else {
            setLinks(result as OneTimeLinkEntry[]);
        }
        setIsLoading(false);
    }, [adminApprovalActions]);

    React.useEffect(() => {
        fetchLinks();
    }, [fetchLinks]);

    const deleteLink = async (linkId: string): Promise<boolean> => {
        const toastId = toast.loading(`Deleting link ${linkId}...`);
        const result = await adminApprovalActions.deleteOneTimeLink(linkId);
        if ('detail' in result) {
            toast.error(`Failed: ${(result as ResponseProps).detail}`, { id: toastId });
            return false;
        } else {
            toast.success((result as ResponseProps).info || "Link deleted!", { id: toastId });
            setLinks(prev => prev.filter(link => link.id !== linkId)); // Optimistic update or re-fetch
            // fetchLinks(); // Or re-fetch for consistency
            return true;
        }
    };

    return {
        links,
        isLoading,
        error,
        fetchLinks,
        deleteLink,
    };
}