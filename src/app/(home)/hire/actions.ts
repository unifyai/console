"use server";

import { CreateAssistantImageResponse, CreateAssistantResponse } from "@/types/assistants/hire";
import { ResponseProps } from "@/types/common";
import { Storage } from '@google-cloud/storage'; // Import Storage here
import { v4 as uuidv4 } from 'uuid';          // Import uuid here
import { getCurrentUser } from '@/lib/user/user'; // Import your user function

// Initialize storage client
let storage: Storage;
try {
   storage = new Storage();
   console.log("Storage client initialized successfully in actions.ts");
} catch (error: any) {
   console.error("FATAL: Failed to initialize Storage client in actions.ts:", error);
}

const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME;

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
    ): Promise<CreateAssistantResponse | ResponseProps> => {
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
                return responseData as CreateAssistantResponse;
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
export const createAssistantImage = async (userId: string) => { 
    return async (contentType: string, fileSize: number): Promise<CreateAssistantImageResponse | ResponseProps> => {
        "use server"

        if (!bucketName) {
            console.error("Configuration Error: ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME missing.");
            // Return an error object instead of throwing, can be handled client-side
            return { success: "false", message: "Server configuration error: Bucket name missing" };
        }
        if (!storage) {
            console.error("Storage client is not available in createAssistantImage action.");
            return { success: "false", message: "Server configuration error: Storage unavailable" };
        }

        try {
            // 1. Check user Id
            if (!userId) {
                console.warn("[Action:createAssistantImage] Unauthorized attempt: No valid user found via getCurrentUser.");
                // Return an error object
                return { success: "false", message: "Unauthorized: Authentication required." };
            }
            console.log(`[Action:createAssistantImage] User ID found: ${userId}`);

            // 2. Validate content type (add size validation if needed)
            if (!contentType || !contentType.startsWith('image/')) {
                console.warn(`[Action:createAssistantImage] Invalid content type: ${contentType}`);
                return { success: "false", message: "Invalid content type. Only images allowed." };
            }
            console.log(`[Action:createAssistantImage] Content type validated: ${contentType}`);

            // 3. Generate path
            const extension = contentType.split('/')[1] || 'jpg';
            const fileId = uuidv4();
            const filePath = `${userId}/${fileId}.${extension}`;
            console.log(`[Action:createAssistantImage] Generated GCS path: gs://${bucketName}/${filePath}`);

            // 4. Configure options
            const options = {
                version: 'v4' as const,
                action: 'write' as const,
                expires: Date.now() + 15 * 60 * 1000, // 15 minutes
                contentType: contentType,
            };
            console.log("[Action:createAssistantImage] Requesting signed URL with options:", options);

            // 5. Get Signed URL directly using storage client
            const [signedUrl] = await storage
                .bucket(bucketName)
                .file(filePath)
                .getSignedUrl(options);

            console.log(`[Action:createAssistantImage] Successfully generated signed URL for ${filePath}`);

            // 6. Return success data (compatible with CreateAssistantImageResponse)
            return { signedUrl, filePath, bucketName }; // Implicitly successful

        } catch (error: any) {
            // Log the specific error from GCS or getCurrentUser
            console.error('[Action:createAssistantImage] Error during signed URL generation or auth:', {
                message: error.message,
                code: error.code, // Include GCS error code if available
                stack: error.stack, // Log stack for better debugging
                details: error.errors
            });
            // Return a structured error object
            return {
                success: "false",
                message: 'Failed to prepare image upload',
                detail: error.message // Include the underlying error message
            };
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