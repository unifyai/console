import { ResponseProps } from "@/types/common";
import { getCurrentUser } from "@/lib/user/user";
import { AssistantHiringApprovalResponse, HiringProfileData } from "@/types/user";

// Server Action to fetch current user's hiring profile
export const fetchCurrentUserHiringProfile = async () => {
    return async (): Promise<HiringProfileData | ResponseProps> => {
        "use server";

        try {
            const user = await getCurrentUser();
            if (!user) {
                return { detail: "User not authenticated or not found." };
            }
            return {
                assistantHiringApproval: user.assistantHiringApproval || null,
                hasClaimedApprovalLink: user.hasClaimedApprovalLink || false,
            };
        } catch (error) {
            console.error("[Server Action fetchCurrentUserHiringProfile] Error:", error);
            const message = error instanceof Error ? error.message : "Unknown error fetching hiring profile.";
            return { detail: message };
        }
    };
}

export const requestAssistantHiringAccess = async(apiKey: string) => {
    return async (): Promise<AssistantHiringApprovalResponse> => {
        "use server";

        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/user/assistant-hiring-approval`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apiKey },
            });
            const data = await response.json();
            if (!response.ok) {
                return { message: data.detail || `Failed to request access: ${response.statusText}`, detail: data.detail };
            }
            return data as AssistantHiringApprovalResponse;
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error requesting access.";
            return { message, detail: message };
        }
    }
};

export const claimAssistantHiringToken = async (apiKey: string) => {
    return async (token: string): Promise<AssistantHiringApprovalResponse> => { 
        "use server";

        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/user/claim-assistant-hiring-one-time-link`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apiKey },
                body: JSON.stringify({ token })
            });
            const data = await response.json();
            if (!response.ok) {
                return { message: data.detail || `Failed to claim token: ${response.statusText}`, detail: data.detail };
            }
            return data as AssistantHiringApprovalResponse;
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error claiming token.";
            return { message, detail: message };
        }
    }
};