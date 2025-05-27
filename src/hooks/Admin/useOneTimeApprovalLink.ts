import * as React from 'react';
import { AdminApprovalActions, OneTimeLinkResponse } from '@/types/admin';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';

export function useOneTimeApprovalLink (adminApprovalActions: AdminApprovalActions) {
    const [generatedLink, setGeneratedLink] = React.useState<OneTimeLinkResponse | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const generateLink = async (expiresInDays: number = 1): Promise<string | null> => {
        setIsLoading(true);
        setError(null);
        setGeneratedLink(null); // Clear previous link data
        const toastId = toast.loading("Generating approval link...");

        const result = await adminApprovalActions.generateOneTimeLink(expiresInDays);

        if ('detail' in result) {
            const errorMsg = (result as ResponseProps).detail;
            setError(errorMsg);
            toast.error(`Failed to generate link: ${errorMsg}`, { id: toastId });
            setIsLoading(false);
            return null;
        } else {
            const linkData = result as OneTimeLinkResponse;
            setGeneratedLink(linkData); // Store the raw backend response
            toast.success("One-time approval link generated!", { id: toastId });
            setIsLoading(false);
            // Construct the full URL for the user to copy/use
            // Ensure window is defined (client-side only)
            if (typeof window !== "undefined") {
                const fullUrl = `${window.location.origin}/team?token=${linkData.token}`;
                return fullUrl;
            }
            return null; // Should not happen if called from button, but good practice
        }
    };

    return {
        generatedLink, // Contains the raw link data from backend
        isLoading,
        error,
        generateLink, // Returns the full user-facing URL or null
        clearGeneratedLink: () => setGeneratedLink(null),
    };
}
