import { ResponseProps } from "@/types/common";
import { ConnectionDetails } from "@/types/assistants/call";

export const getCallConnectionDetails = async (apiKey: string) => {
    return async (assistantId: string, assistantName: string): Promise<ConnectionDetails | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/call`, {
                method: "POST",
                headers: {
                    apiKey: apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ assistantId, assistantName }),
            });

            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to get call connection details: ${response.statusText}` };
            }
            return data as ConnectionDetails;
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error getting call connection details.";
            return { detail: message };
        }
    };
};

export const dispatchAssistantToCall = async (apiKey: string) => {
    return async (assistantId: string, agentName: string, roomName: string): Promise<ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/call/dispatch`, {
                method: "POST",
                headers: {
                    apiKey: apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ assistantId, agentName, roomName }),
            });

            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to dispatch assistant: ${response.statusText}` };
            }
            return data as ResponseProps;
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error dispatching assistant.";
            return { detail: message };
        }
    };
};
