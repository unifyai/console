import { ResponseProps } from "@/types/common";
import { Assistant, AssistantUpdatePayload, AssistantStatus, PreHireChatMessage } from "@/types/assistants/assistant";

export const listAssistants = async (apiKey: string) => {
    return async (): Promise<Assistant[] | (ResponseProps & { status?: number })> => {
        "use server";

        try {
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/assistant`,
                {
                    method: "GET",
                    headers: { apiKey: apiKey },
                }
            );

            let data;
            try {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                data = await response.json();
                } else {
                    console.error(`[actions.ts listAssistants] Received non-JSON response with status ${response.status}`);
                    return { detail: "Received an invalid response from the server." };
                }
            } catch (parseError) {
                console.error(`[actions.ts listAssistants] Failed to parse JSON response ${parseError}`);
                return { detail: "Received an invalid response from the server." };
            }

            if (!response.ok) {
                const errorMessage = data.detail || `Failed to list assistants: ${response.statusText}`
                return { detail: errorMessage, status: response.status };
            }

            if ("info" in data) {   // In case data is nested inside an info property
                return data.info as Assistant[]
            }
            return data as Assistant[]

        } catch (error) {
            console.error(`[actions.ts listAssistants] Error fetching assistants:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred.";
            return { detail: errorMessage };
        }

    };
};

export const getAssistantStatus = async (apiKey: string) => {
    return async (assistantId: string): Promise<(AssistantStatus & ResponseProps) | ResponseProps> => {
        "use server";

        try {
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}/status`,
                { method: "GET", headers: { apiKey: apiKey } }
            );

            const data = await response.json();

            if (!response.ok) {
                return { detail: data.detail || `Failed to get status for assistant ${assistantId}: ${response.statusText}` };
            }

            if (data.info) {
                return data.info as AssistantStatus;
            }

            if ('running' in data) {
                return data as AssistantStatus;
            }

            return { detail: "Unexpected response format from status endpoint." };

        } catch (error) {
            console.error(`[assistant.ts getAssistantStatus] Error fetching status for assistant ${assistantId}:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred.";
            return { detail: errorMessage };
        }
    };
};

export const deleteAssistant = async (apiKey: string) => {
    return async (assistantId: string): Promise<ResponseProps> => {
        "use server";

        try {
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}`,
                { method: "DELETE", headers: { apiKey: apiKey } }
            );

            if (!response.ok) {
                let errorData;
                let errorMessage = `Failed to delete assistant: ${response.statusText} (Status: ${response.status})`;
                try {
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        errorData = await response.json();
                        errorMessage = errorData?.detail || errorMessage;
                    }
                } catch (parseError) {
                    console.error(`[actions.ts deleteAssistant] Failed to parse error JSON response: ${parseError}`);
                }
                return { detail: errorMessage };
            }
            const data = await response.json();
            return { info: data.info || `Assistant ${assistantId} deleted successfully.` };

        } catch (error) {
            console.error(`[actions.ts deleteAssistant] Error deleting assistant ${assistantId}:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred.";
            return { detail: errorMessage };
        }
    };
};

export const updateAssistant = async (apiKey: string) => {
    return async (assistantId: string, payload: AssistantUpdatePayload): Promise<ResponseProps> => {
        "use server";

        try {
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}`,
                {
                    method: "PATCH",
                    headers: {
                         apiKey: apiKey,
                         "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        ...payload,
                        create_infra: true
                    })
                }
            );

            let data;
            try {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    data = await response.json();
                } else {
                    console.error(`[actions.ts updateAssistant] Received non-JSON response with status ${response.status}`);
                    return { detail: "Received an invalid response from the server." };
                }
            } catch (parseError) {
                console.error(`[actions.ts updateAssistant] Failed to parse JSON response ${parseError}`);
                return { detail: "Received an invalid response from the server." };
            }

            if (!response.ok) {
                const errorMessage = data.detail || `Failed to update assistant: ${response.statusText}`;
                return { detail: errorMessage };
            }

            const successMessage = data.info || `Assistant ${assistantId} updated successfully.`;
            return { info: successMessage }

        } catch (error) {
            console.error(`[actions.ts updateAssistant] Error updating assistant ${assistantId}:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred.";
            return { detail: errorMessage };
        }
    };
};

export const createAssistant = async (apiKey: string) => {
    return async (
        first_name: string, surname: string, age: number | null, region: string | null,
        profile_photo: string | null, profile_video: string | null, about: string | null, voice_id: string | null,
        email: string | null, user_phone: string | null, country: string | null,
        user_whatsapp_number: string | null,
        pre_hire_chat?: PreHireChatMessage[]
    ): Promise<ResponseProps & { assistant?: Assistant }> => {
        "use server";

        try {
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/assistant`,
                {
                    method: "POST",
                    headers: {
                        apiKey: apiKey,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        first_name,
                        surname,
                        age,
                        region,
                        profile_photo,
                        profile_video,
                        about,
                        voice_id,
                        email,
                        user_phone,
                        country,
                        user_whatsapp_number,
                        max_parallel: 10,
                        weekly_limit: 40,
                        create_infra: true,
                        pre_hire_chat
                    })
                }
            );

            let data;
            try {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    data = await response.json();
                } else {
                    console.error(`[actions.ts createAssistant] Received non-JSON response with status ${response.status}`);
                    return { detail: "Received an invalid response from the server." };
                }
            } catch (parseError) {
                console.error(`[actions.ts createAssistant] Failed to parse JSON response ${parseError}`);
                return { detail: "Received an invalid response from the server." };
            }

            if (!response.ok) {
                const errorMessage = data.detail || `Failed to create assistant: ${response.statusText}`;
                return { detail: errorMessage };
            }

            const successMessage = `Assistant created successfully.`;
            const createdAssistant = data.info as Assistant;
            return { info: successMessage, assistant: createdAssistant }

        } catch (error) {
            console.error(`[actions.ts createAssistant] Error creating assistant:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred.";
            return { detail: errorMessage };
        }
    };
};