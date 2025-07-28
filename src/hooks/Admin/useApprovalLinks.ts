import * as React from 'react';
import { AdminApprovalActions, OneTimeLinkResponse, OneTimeLinkEntry, ADMIN_TABLE_PAGE_SIZE } from '@/types/admin';
import { ResponseProps } from '@/types/common';
import { showLoadingToast, showErrorToast, showSuccessToast } from '@/components/Common/Toasts/notifications';

export function useApprovalLinks (adminApprovalActions: AdminApprovalActions) {
    // --- State and logic for generating a single link ---
    const [generatedLinkData, setGeneratedLinkData] = React.useState<OneTimeLinkResponse | null>(null);
    const [isGeneratingLink, setIsGeneratingLink] = React.useState(false);
    const [generationError, setGenerationError] = React.useState<string | null>(null);

    // --- State and logic for managing the list of links ---
    const [links, setLinks] = React.useState<OneTimeLinkEntry[]>([]);
    const [isLoadingLinks, setIsLoadingLinks] = React.useState(true);
    const [isLoadingMoreLinks, setIsLoadingMoreLinks] = React.useState(false);
    const [linksError, setLinksError] = React.useState<string | null>(null);
    const [offset, setOffset] = React.useState(0);
    const [hasMoreLinks, setHasMoreLinks] = React.useState(true);
    const pageSize = ADMIN_TABLE_PAGE_SIZE;
    const fetchIdRef = React.useRef(0); // For managing list fetch race conditions


    // Internal function to fetch the list of links
    const fetchLinksInternal = React.useCallback(async (currentFetchId: number, currentOffset: number, isLoadMore: boolean) => {
        if (isLoadMore) {
            setIsLoadingMoreLinks(true);
        } else {
            setIsLoadingLinks(true);
            if (fetchIdRef.current === currentFetchId) { // Guard against old fetch clearing new data
                setLinks([]);
            }
        }
        setLinksError(null);

        const result = await adminApprovalActions.listOneTimeLinks(pageSize, currentOffset);
        
        if (fetchIdRef.current !== currentFetchId) { // Check if this is still the latest fetch
            if (isLoadMore) setIsLoadingMoreLinks(false); else setIsLoadingLinks(false);
            return;
        }

        if ('detail' in result) {
            const errorMsg = (result as ResponseProps).detail;
            setLinksError(errorMsg);
            if (!isLoadMore) setLinks([]);
            showErrorToast(`Failed to load links: ${errorMsg}`);
            setHasMoreLinks(false);
        } else {
            const newLinks = result as OneTimeLinkEntry[];
            setLinks(prev => {
                if (isLoadMore) {
                    const existingIds = new Set(prev.map(l => l.id));
                    const uniqueNewLinks = newLinks.filter(l => !existingIds.has(l.id));
                    return [...prev, ...uniqueNewLinks];
                }
                return newLinks;
            });
            setOffset(currentOffset + newLinks.length);
            setHasMoreLinks(newLinks.length === pageSize);
        }

        if (isLoadMore) {
            setIsLoadingMoreLinks(false);
        } else {
            setIsLoadingLinks(false);
        }
    }, [adminApprovalActions, pageSize]);

    const refreshLinksList = React.useCallback(() => {
        fetchIdRef.current += 1;
        const currentFetchId = fetchIdRef.current;
        setOffset(0);
        setHasMoreLinks(true);
        fetchLinksInternal(currentFetchId, 0, false);
    }, [fetchLinksInternal]);
    
    const loadMoreLinksToList = React.useCallback(() => {
        if (!isLoadingMoreLinks && hasMoreLinks) {
            fetchIdRef.current += 1;
            const currentFetchId = fetchIdRef.current;
            fetchLinksInternal(currentFetchId, offset, true);
        }
    }, [isLoadingMoreLinks, hasMoreLinks, offset, fetchLinksInternal]);

    // Initial fetch for the list
    React.useEffect(() => {
        refreshLinksList();
    }, [refreshLinksList]); // refreshLinksList is memoized


    // Function to generate a new link
    const generateNewLink = async (expiresInDays: number = 1): Promise<string | null> => {
        setIsGeneratingLink(true);
        setGenerationError(null);
        setGeneratedLinkData(null); // Clear previous specific generation data
        const toastId = showLoadingToast("Generating approval link...");

        const result = await adminApprovalActions.generateOneTimeLink(expiresInDays);

        if ('detail' in result) {
            const errorMsg = (result as ResponseProps).detail;
            setGenerationError(errorMsg);
            showErrorToast(`Failed to generate link: ${errorMsg}`, `Failed to generate link: ${errorMsg}`, toastId);
            setIsGeneratingLink(false);
            return null;
        } else {
            const linkData = result as OneTimeLinkResponse;
            setGeneratedLinkData(linkData); // Store the raw backend response for the new link
            showSuccessToast("One-time approval link generated!", undefined, toastId);
            setIsGeneratingLink(false);
            
            // Refresh the list to ensure the new link appears
            refreshLinksList(); 

            if (typeof window !== "undefined") {
                return `${window.location.origin}/assistants?token=${linkData.token}`;
            }
            return null; // Should not happen if called from button, but good practice
        }
    };

    const clearGeneratedLink = () => setGeneratedLinkData(null);

    // Function to delete a link from the list
    const deleteLink = async (linkId: string): Promise<boolean> => {
        const toastId = showLoadingToast(`Deleting link...`);
        const result = await adminApprovalActions.deleteOneTimeLink(linkId);
        if ('detail' in result) {
            showErrorToast(`Failed: ${(result as ResponseProps).detail}`, `Failed: ${(result as ResponseProps).detail}`, toastId);
            return false;
        } else {
            showSuccessToast((result as ResponseProps).info || "Link deleted!", undefined, toastId);
            // Optimistic update: remove from local state
            setLinks(prev => prev.filter(link => link.id !== linkId));
            // Note: This might cause a slight desync with total count if not refreshing,
            // but for display purposes, it's often acceptable.
            // If the deleted item was on the current page and affects pagination,
            // a full refresh might be desired by some, but refreshLinksList() would reset to page 1.
            return true;
        }
    };

    return {
        // For generating a single link
        generatedLinkData,    // Data of the most recently generated link
        isGeneratingLink,
        generationError,
        generateNewLink,      // Function to trigger generation
        clearGeneratedLink,   // Function to clear generatedLinkData

        // For managing the list of links
        links,                // The list of all fetched links
        isLoadingLinks,
        isLoadingMoreLinks,
        hasMoreLinks,
        linksError,
        refreshLinksList,
        deleteLink,
        loadMoreLinksToList,
    };
}