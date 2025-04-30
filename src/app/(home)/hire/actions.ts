"use server";

import { CreateAssistantImageResponse, CreateAssistantResponse, SuccessfulAssistantCreationResponse } from "@/types/assistants/hire";
import { ResponseProps } from "@/types/common";

// list assistants
export const listAssistants = async (apiKey: string) => {
    return async () => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/assistant`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
            }
        );
        return await response.json();
    };
};

// create assistant
export const createAssistant = async (apiKey: string) => {
    return async (
        first_name: string,
        surname: string,
        age: number,
        region: string,
        profile_photo: string,
        about: string
    ): Promise<CreateAssistantResponse> => {
        "use server";

        const body = {
            first_name, surname, age, region, profile_photo, about,
            max_parallel: 10, weekly_limit: 40
        };

        try {
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/assistant`,
                {
                    method: "POST",
                    headers: {
                        apiKey: apiKey,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(body)
                }
            );
            const responseData = await response.json();

            if (!response.ok) {
                 console.error(`/api/assistant Error (${response.status}):`, responseData);
                 return {
                     success: false,
                     message: responseData?.detail || responseData?.error || `API Error: ${response.status}`,
                     ...responseData
                 } as ResponseProps;
            }
             // Explicitly check if agent_id exists before casting to success type
             if (responseData && responseData.agent_id) {
                return responseData as SuccessfulAssistantCreationResponse;
             } else {
                // If agent_id is missing even on OK response, treat as error/unexpected
                return {
                    success: false,
                    message: "Assistant created but response format unexpected.",
                     ...responseData
                } as ResponseProps;
             }

        } catch (error: any) {
             console.error("Network/parsing error in createAssistant action:", error);
             return { detail: error.message || "Network error" } as ResponseProps;
        }
    };
};

// create image
export const createAssistantImage = async () => {
    return async (contentType: string, fileSize: number): Promise<CreateAssistantImageResponse> => {
        "use server";
        let response: Response | null = null; // Keep track of response
        try {
            console.log(`[Action:createAssistantImage] Fetching signed URL from /api/assistant/image/upload for type: ${contentType}, size: ${fileSize}`);
            response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/assistant/image/upload`,
                {
                    method: "POST",
                    headers: {"Content-Type": "application/json",},
                    body: JSON.stringify({ contentType, fileSize }),
                }
            );
            console.log(`[Action:createAssistantImage] Received response status: ${response.status}`);

            if (!response.ok) {
                let errorData: any = {};
                const responseText = await response.text(); // Read body as text first
                console.log(`[Action:createAssistantImage] Raw error response body: ${responseText}`);
                try {
                     // Try to parse as JSON if possible
                     errorData = JSON.parse(responseText);
                } catch (parseError) {
                    console.warn("[Action:createAssistantImage] Failed to parse error response body as JSON.");
                    errorData = { error: responseText }; // Use raw text if not JSON
                }

                // Log detailed info before throwing
                console.error("[Action:createAssistantImage] API route /api/assistant/image/upload fetch failed:", {
                    status: response.status,
                    statusText: response.statusText,
                    responseData: errorData, // Log the parsed/text error data
                });

                // Construct a more informative error
                throw new Error(`Failed to get signed upload URL from API. Status: ${response.status}. Error: ${errorData?.error || errorData?.details || response.statusText}`);
            }

            const responseData = await response.json();
            console.log("[Action:createAssistantImage] Successfully received signed URL data.");
            return responseData;

         } catch (error: any) {
             // This catch block handles network errors *or* the re-thrown error from !response.ok
             console.error("[Action:createAssistantImage] Error during fetch or processing:", error);
             // Re-throw the error so Server Components Render catches it
             throw error;
         }
    };
}

// delete assistant
export const deleteAssistant = async (apiKey: string) => {
    return async (assistantId: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}`,
            { method: "DELETE", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};

// update assistant
export const updateAssistant = async (apiKey: string) => {
    return async (
        assistantId: string, 
        about: string | null,
        phone: string | null,
        email: string | null
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}`,
            {
                method: "PATCH",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ about, phone, email })
            }
        );
        return await response.json();
    };
};