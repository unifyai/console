import * as React from 'react';
import { toast } from 'sonner';
import { ResponseProps } from '@/types/common';
import { ApprovalStatus } from '@/types/user';
import { AssistantHiringApprovalResponse, HiringProfileData } from '@/types/user';
import { AssistantActions } from '@/types/team/assistant';

interface UseAssistantHiringApprovalProps {
    approvalActions: AssistantActions["approval"]
	tokenToClaimOnLoad?: string | null;
}

export function useAssistantHiringApproval({
    approvalActions,
    tokenToClaimOnLoad,
}: UseAssistantHiringApprovalProps) {
    const [approvalStatus, setApprovalStatus] = React.useState<ApprovalStatus | 'loading'>('loading');
    const [hasClaimedLink, setHasClaimedLink] = React.useState<boolean | 'loading'>('loading');
    const [isProcessingAction, setIsProcessingAction] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    
    const loadHiringProfile = React.useCallback(async () => {
        setApprovalStatus('loading');
        setHasClaimedLink('loading');
        setError(null);
        // Call the Server Action directly
        const response = await approvalActions.getProfile(); 
        if ('detail' in response) {
            const errorMsg = (response as ResponseProps).detail || "Failed to load hiring status.";
            setError(errorMsg);
            toast.error(errorMsg);
            setApprovalStatus(null); 
            setHasClaimedLink(false); 
        } else {
            const profile = response as HiringProfileData;
            setApprovalStatus(profile.assistant_hiring_approval as ApprovalStatus);
            setHasClaimedLink(profile.has_claimed_approval_link);
        }
    }, []);

    React.useEffect(() => {
        loadHiringProfile();
    }, [loadHiringProfile]);
    

    const processApiResponse = (response: AssistantHiringApprovalResponse, successMessage: string, operation: "request" | "claim") => {
        if (response.assistant_hiring_approval !== undefined) {
            setApprovalStatus(response.assistant_hiring_approval as ApprovalStatus);
            toast.success(response.message || successMessage);
            if (operation === "claim") {
                setHasClaimedLink(true); 
            }
            setError(null);
            return true;
        } else {
            const errorMessage = response.message || response.detail || "An unknown error occurred.";
            setError(errorMessage);
            toast.error(errorMessage);
            return false;
        }
    };

    const requestAccess = async () => {
        setIsProcessingAction(true);
        setError(null);
        const response = await approvalActions.requestAccess();
        setIsProcessingAction(false);
        const success = processApiResponse(response, "Access request submitted.", "request");
        if (success && response.assistant_hiring_approval === "pending"){
        } else if (success) {
            await loadHiringProfile(); // Re-fetch if status change isn't just to pending
        }
        return success;
    };

    const claimToken = React.useCallback(async (token: string) => {
        setIsProcessingAction(true);
        setError(null);
        const response = await approvalActions.claimToken(token);
        setIsProcessingAction(false);
        const success = processApiResponse(response, "Token claimed successfully.", "claim");
        if (success) {
            await loadHiringProfile(); // Re-fetch profile to get the absolute latest state after claim
            if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.delete('token');
                window.history.replaceState({}, document.title, url.toString());
            }
        }
        return success;
    }, [loadHiringProfile]);

    React.useEffect(() => {
        if (tokenToClaimOnLoad && hasClaimedLink === false && approvalStatus !== 'loading' && approvalStatus !== "approved") {
            claimToken(tokenToClaimOnLoad);
        }
    }, [tokenToClaimOnLoad, hasClaimedLink, approvalStatus, claimToken]);


    return {
        approvalStatus,
        hasClaimedLink,
        isLoading: approvalStatus === 'loading' || hasClaimedLink === 'loading',
        isProcessingAction, 
        error,
        requestAccess,
        claimToken,
        refreshHiringProfile: loadHiringProfile,
    };
}