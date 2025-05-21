import { ResponseProps } from "@/types/common";
import { LogItemProps, LogsResponseProps, GroupedLogPropsRaw } from "@/types/evals/logs";
import { Task } from "@/types/team/task";
import { Storage } from "@google-cloud/storage";
import { v4 as uuidv4 } from 'uuid';
import { Assistant, Voice } from "@/types/team/assistant";
import { SupportedLanguage, Gender as CartesiaGender, LocalizeTargetLanguage } from "@cartesia/cartesia-js/api";

// --- GCS Setup  ---
// Initializing storage bucket
let storage: Storage;
try {
   storage = new Storage();
} catch (error: any) {
   console.error("FATAL: Failed to initialize Storage client in actions.ts:", error);
}
const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME;

// Helper function to extract object path from GCS URL
const getObjectPathFromUrl = (gcsUrl: string): string | null => {
    const gcsUrlPrefix = 'https://storage.googleapis.com/';
    if (!gcsUrl.startsWith(gcsUrlPrefix)) {
        console.warn(`[actions.ts helper] URL "${gcsUrl}" is not a standard GCS URL.`);
        return !gcsUrl.startsWith('http') ? gcsUrl : null;
    }
    try {
        const url = new URL(gcsUrl);
        const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME;
        if (!bucketName) {
            console.error("[actions.ts helper] Bucket name env var missing for path extraction.");
            return null;
        }
        const expectedPathPrefix = `/${bucketName}/`;
        if (url.pathname.startsWith(expectedPathPrefix)) {
            return url.pathname.substring(expectedPathPrefix.length);
        } else {
            console.warn(`[actions.ts helper] URL Pathname "${url.pathname}" did not start with expected prefix "${expectedPathPrefix}". Assuming path without bucket.`);
             // Fallback: Remove just the leading slash, assuming the rest is the path.
             return url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
        }
    } catch (e) {
        console.error(`[actions.ts helper] Failed to parse URL to extract object path: ${gcsUrl}`, e);
        return null;
    }
};

// --- Assistant List/CRUD Actions  ---
export const listAssistants = async (apiKey: string) => {
    return async (): Promise<Assistant[] | ResponseProps> => {
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
                const errorMessage = data.detail || `Failed to list assistants: ${response.statusText}`;
                return { detail: errorMessage };
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

export const deleteAssistant = async (apiKey: string) => {
    return async (assistantId: string): Promise<ResponseProps> => {
        "use server";

        try {
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}`,
                { method: "DELETE", headers: { apiKey: apiKey } }
            );

            if (!response.ok) {
                // Handle actual errors (4xx, 5xx)
                let errorData;
                let errorMessage = `Failed to delete assistant: ${response.statusText} (Status: ${response.status})`;
                try {
                    // Try to parse error details if response is JSON
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        errorData = await response.json();
                        errorMessage = errorData?.detail || errorMessage;
                    } else {
                        // Log non-JSON error body if needed for debugging
                        // const errorText = await response.text();
                        // console.error("Non-JSON error response body:", errorText);
                    }
                } catch (parseError) {
                    console.error(`[actions.ts deleteAssistant] Failed to parse error JSON response: ${parseError}`);
                }
                return { detail: errorMessage };
            }

            return { info: `Assistant ${assistantId} deleted successfully.` };
    
        } catch (error) {
            console.error(`[actions.ts deleteAssistant] Error deleting assistant ${assistantId}:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred.";
            return { detail: errorMessage };
        }
    };
};

export const updateAssistant = async (apiKey: string) => {
    return async (assistantId: string, about: string | null, phone: string | null, email: string | null, voice_id: string | null): Promise<ResponseProps> => {
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
                    body: JSON.stringify({about, email, phone, voice_id})
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
    return async ( first_name: string, surname: string, age: number | null, region: string | null, profile_photo: string | null, about: string | null, voice_id: string | null ): Promise<ResponseProps> => {
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
                    body: JSON.stringify({ first_name, surname, age, region, profile_photo, about, voice_id, max_parallel: 10, weekly_limit: 40 })
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

// --- Profile photo actions ---
export const uploadPhoto = async (userId: string) => {
    return async (contentType: string, fileSize: number): Promise<{ signedUrl: string, filePath: string, bucketName: string } | ResponseProps> => {
        "use server"

        if (!bucketName) {
            console.error("Configuration Error: ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME missing.");
            return { detail: "Server configuration error: Bucket name missing" };
        }
        if (!storage) {
            console.error("Storage client is not available in uploadPhoto action.");
            return { detail: "Server configuration error: Storage unavailable" };
        }

        try {
            // 1. Check user Id - Already passed as arg, ensuring it's valid
            if (!userId) {
                console.warn("[Action:uploadPhoto] Invalid userId provided.");
                return { detail: "User identification failed." };
            }

            // 2. Validate content type
            if (!contentType || !contentType.startsWith('image/')) {
                console.warn(`[Action:uploadPhoto] Invalid content type: ${contentType}`);
                return { detail: "Invalid content type. Only images allowed." };
            }
            
            // Add size validation if needed (example: max 5MB)
            const MAX_SIZE_MB = 5;
            if (fileSize > MAX_SIZE_MB * 1024 * 1024) {
                console.warn(`[Action:uploadPhoto] File size too large: ${fileSize} bytes`);
                return { detail: `Image size cannot exceed ${MAX_SIZE_MB}MB.` };
            }

            // 3. Generate path
            const extension = contentType.split('/')[1] || 'jpg'; // Ensure extension is derived safely
            const fileId = uuidv4();
            const filePath = `${userId}/${fileId}.${extension}`;

            // 4. Configure options
            const options = {
                version: 'v4' as const,
                action: 'write' as const,
                expires: Date.now() + 15 * 60 * 1000, // 15 minutes
                contentType: contentType,
            };

            // 5. Get Signed URL directly using storage client
            const [signedUrl] = await storage
                .bucket(bucketName)
                .file(filePath)
                .getSignedUrl(options);


            // 6. Return success data (compatible with UploadPhotoResponse)
            // Ensure all expected fields are returned
            return { signedUrl, filePath, bucketName }; 

        } catch (error) {
            console.error('[Action:uploadPhoto] Error during signed URL generation or validation:', error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred.";
            return { detail: errorMessage };
        }
    };
}

export const downloadPhoto = async () => {
    // filePathOrUrl can be a full GCS URL or just the object path
    return async (filePathOrUrl: string): Promise<{ signedUrl?: string; detail?: string }> => {
        "use server";

        let objectPath = filePathOrUrl;

        // Use helper to extract path if it's a full URL
        if (filePathOrUrl.startsWith('https://storage.googleapis.com/')) {
            const extractedPath = getObjectPathFromUrl(filePathOrUrl);
            if (!extractedPath) {
                 return { detail: "Could not extract file path from GCS URL." };
            }
            objectPath = extractedPath;
        }

        if (!objectPath) {
             return { detail: "File path is missing or could not be determined." };
        }

        const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME;
        if (!bucketName) {
            console.error("[actions.ts downloadPhoto] GCS Bucket name environment variable is not set.");
            return { detail: "Server configuration error: Bucket name missing." };
        }
        if (!storage) {
            console.error("Storage client is not available in uploadPhoto action.");
            return { detail: "Server configuration error: Storage unavailable" };
        }

        try {
            const options = {
                version: 'v4' as const,
                action: 'read' as const,
                expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            };

            const [url] = await storage
                .bucket(bucketName)
                .file(objectPath)
                .getSignedUrl(options);

            return { signedUrl: url };

        } catch (error) {
            console.error(`[actions.ts downloadPhoto] FAILED to generate signed URL for object path "${objectPath}" in bucket "${bucketName}":`, error);
            const errorMsg = error instanceof Error ? error.message : "Unknown error generating download URL.";
            if (errorMsg.includes("No such object")) {
                 return { detail: `Photo not found at path: ${objectPath}` };
            } else if (errorMsg.includes("does not have serviceusage.services.use access") || errorMsg.includes("caller does not have storage.objects.get access") || errorMsg.includes("permission denied") || errorMsg.includes("signBlob")) {
                 return { detail: "Permission denied accessing photo." };
            }
            return { detail: "Could not retrieve photo URL." };
        }
    };
};

export const deletePhoto = async () => {
     // Takes the full GCS URL or just the object path
    return async (filePathOrUrl: string): Promise<ResponseProps> => {
        "use server";

        let objectPath = filePathOrUrl;

        // Use helper to extract path if it's a full URL
        if (filePathOrUrl.startsWith('https://storage.googleapis.com/')) {
             const extractedPath = getObjectPathFromUrl(filePathOrUrl);
             if (!extractedPath) {
                  console.error(`[actions.ts deletePhoto] Could not extract GCS object path from URL: ${filePathOrUrl}`);
                  return { detail: "Invalid GCS file URL provided." };
             }
             objectPath = extractedPath;
        }

        if (!objectPath) {
             console.error("[actions.ts deletePhoto] GCS object path is missing.");
             return { detail: "File path is missing." };
        }

        const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME;
        if (!bucketName) {
            console.error("[actions.ts deletePhoto] GCS Bucket name environment variable is not set.");
            return { detail: "Server configuration error: Bucket name missing." };
        }
        if (!storage) {
            console.error("Storage client is not available in uploadPhoto action.");
            return { detail: "Server configuration error: Storage unavailable" };
        }
        try {
            await storage.bucket(bucketName).file(objectPath).delete();
            return { info: "Assistant photo deleted successfully" };
        } catch (error: any) {
            console.error(`[actions.ts deletePhoto] FAILED to delete object "${objectPath}" from bucket "${bucketName}":`, error);
             // Check for specific GCS errors (e.g., not found, permission denied)
             if (error.code === 404 || (error.message && error.message.includes("No such object"))) {
                console.warn(`[actions.ts deletePhoto] Object "${objectPath}" not found in bucket "${bucketName}". Assuming already deleted or path incorrect.`);
                return { detail: "Photo not found (might be already deleted)." };
             } else if (error.code === 403 || (error.message && (error.message.includes("permission denied") || error.message.includes("does not have storage.objects.delete access")))) {
                 return { detail: "Permission denied to delete photo." };
             }
             const errorMsg = error instanceof Error ? error.message : "Unknown error deleting photo from storage.";
             return { detail: errorMsg };
        }
    };
};


// --- Task Actions ---
export const getTasks = async (apiKey: string) => {
    return async (filterExpression: string | null, limit: number | null, offset: number | null): Promise<LogsResponseProps | ResponseProps> => {
        "use server";

        try {

            let url = `${process.env.NEXTAUTH_URL}/api/logs?project=Unity&context=Tasks`;
            if (filterExpression) {
                url += `&filter_expr=${encodeURIComponent(filterExpression)}`;
            }
            if (limit !== null) {
                url += `&limit=${limit}`;
            }
            if (offset !== null) { // Add offset to the URL query
                url += `&offset=${offset}`;
            }
            const response = await fetch(
                url,
                { method: "GET", headers: { apiKey: apiKey } },
            );

            let data;
            try {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    data = await response.json();
                } else {
                    console.error(`[actions.ts getTasks] Received non-JSON response with status ${response.status}`);
                    return { detail: "Received an invalid response from the server." };
                }
            } catch (parseError) {
                console.error(`[actions.ts getTasks] Failed to parse JSON response ${parseError}`);
                return { detail: "Received an invalid response from the server." };
            }


            if (!response.ok) {
                const errorMessage = data.detail || `Failed to get tasks: ${response.statusText}`;
                return { detail: errorMessage };
            }

            return data as LogsResponseProps

        } catch (error) {
            console.error(`[actions.ts getTasks] Error fetching tasks:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred.";
            return { detail: errorMessage };
        }

    };
};

export const getUniqueFieldValues = async (apiKey: string) => {
    return async (groupByField: string): Promise<string[] | ResponseProps> => {
        "use server";

        try {
            let url = `${process.env.NEXTAUTH_URL}/api/logs?project=Unity&context=Tasks`;
            url += `&group_by=${encodeURIComponent(groupByField)}`;
            url += `&group_depth=0`;

            const response = await fetch(
                url,
                { method: "GET", headers: { apiKey: apiKey } },
            );

            let data: LogsResponseProps | ResponseProps;
            try {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    data = await response.json();
                } else {
                    console.error(`[actions.ts getTaskGroups] Received non-JSON response with status ${response.status}`);
                    return { detail: "Received an invalid response from the server." };
                }
            } catch (parseError) {
                console.error(`[actions.ts getTaskGroups] Failed to parse JSON response: ${parseError}`);
                return { detail: "Received an invalid response from the server." };
            }

            if (!response.ok) {
                const errorMessage = (data as ResponseProps).detail || `Failed to get task groups for ${groupByField}: ${response.statusText}`;
                return { detail: errorMessage };
            }

            const groupData = ((
                (data as LogsResponseProps)
                    .logs as GroupedLogPropsRaw
                        )?.[groupByField] as {group: {key: string, value: number}[], group_count: number, count: number}
                            )?.group;

            if (groupData && Array.isArray(groupData)) {
                // Filter out null/undefined keys and ensure uniqueness
                const uniqueKeys = Array.from(new Set(groupData.flatMap(item => item.key).filter(key => key != null)));
                return uniqueKeys;
            } else {
                console.warn(`[actions.ts getTaskGroups] Response format unexpected or missing group data for field '${groupByField}'. Data:`, data);
                // Return empty array if structure is not as expected but response was OK
                return [];
            }

        } catch (error) {
            console.error(`[actions.ts getTaskGroups] Error fetching task groups for ${groupByField}:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred.";
            return { detail: errorMessage };
        }
    };
};


export const updateTask = async (apiKey: string) => {
    return async (logs: number[], entries: LogItemProps): Promise<ResponseProps> => {
        "use server";

        try {
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/logs`,
                {
                    method: "PUT",
                    headers: { 
                        apiKey: apiKey,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        logs: logs,
                        project: "Unity",
                        context: "Tasks",
                        params: {},
                        entries: entries,
                        overwrite: true
                    })
                }
            );

            let data;
            try {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    data = await response.json();
                } else {
                    console.error(`[actions.ts updateTask] Received non-JSON response with status ${response.status}`);
                    return { detail: "Received an invalid response from the server." };
                }
            } catch (parseError) {
                console.error(`[actions.ts updateTask] Failed to parse JSON response ${parseError}`);
                return { detail: "Received an invalid response from the server." };
            }

            if (!response.ok) {
                const errorMessage = data.detail || `Failed to update tasks ${logs}: ${response.statusText}`;
                return { detail: errorMessage };
            }

            const successMessage = data.info || `Tasks ${logs} successfully updated.`;
            return { info: successMessage }

        } catch (error) {
            console.error(`[actions.ts updateTask] Error updating task ${logs}:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred.";
            return { detail: errorMessage };
        }

    }
}

// --- Voice Actions (Orchestra DB ) ---
export const listVoicesFromOrchestra = async (apiKey: string) => {
    return async (): Promise<Voice[] | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice`, { method: "GET", headers: { apiKey: apiKey }});
            const data = await response.json();
            if (!response.ok) return { detail: data.detail || `Failed: ${response.statusText}` };
            return (data.info || data) as Voice[]; // Orchestra returns { info: VoiceRead[] }
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};

export const createVoiceInOrchestra = async (apiKey: string) => {
    return async (voice_id: string, name: string, description: string, gender: CartesiaGender | 'other', language: SupportedLanguage): Promise<(Voice & {info?: string}) | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice`, {
                method: "POST", headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ voice_id, name, description, gender, language })
            });
            const data = await response.json();
            if (!response.ok) return { detail: data.detail || `Failed: ${response.statusText}` };
             // Orchestra returns { info: VoiceRead }
            return { ...(data.info as Voice), info: `Voice ${name} registered.` };
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};

export const deleteVoiceFromOrchestra = async (apiKey: string) => {
    return async (voice_id: string): Promise<ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice/${voice_id}`, { method: "DELETE", headers: { apiKey: apiKey }});
            if (!response.ok && response.status !== 404) { // Allow 404 as "already deleted"
                 const data = await response.json().catch(() => ({}));
                return { detail: data.detail || `Failed: ${response.statusText}` };
            }
            return { info: `Voice record ${voice_id} deleted from DB.` };
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};

export const cloneVoiceOnCartesia = async (apiKey: string) => { // apiKey might be used by proxy route for its own auth
    return async (formData: FormData): Promise<Voice | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/voices/user/clone`, { 
                method: "POST", 
                headers: { apiKey: apiKey }, // Auth for your proxy route
                body: formData 
            });
            const data = await response.json();
            if (!response.ok) return { detail: data.detail || `Cartesia clone failed: ${response.statusText}` };
            return data as Voice; // Proxy returns Voice structure
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};

export const localizeVoiceOnCartesia = async (apiKey: string) => {
    return async (baseCartesiaVoiceId: string, name: string, description: string | null, targetLanguage: LocalizeTargetLanguage, originalSpeakerGender: CartesiaGender): Promise<Voice | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/voices/user/localize`, {
                method: "POST", headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ baseCartesiaVoiceId, name, description, targetLanguage, originalSpeakerGender })
            });
            const data = await response.json();
            if (!response.ok) return { detail: data.detail || `Cartesia localization failed: ${response.statusText}` };
            return data as Voice;
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};

export const deleteVoiceFromCartesia = async (apiKey: string) => {
    return async (cartesiaVoiceId: string): Promise<ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/voices/user/${cartesiaVoiceId}`, { // Path based on user's file structure
                method: "DELETE", headers: { apiKey: apiKey }
            });
             if (!response.ok && response.status !== 404 && response.status !== 204 && response.status !== 200) { // Allow 404, 204, 200 as success/already done
                const data = await response.json().catch(() => ({}));
                return { detail: data.detail || `Cartesia delete failed: ${response.statusText}` };
            }
            return { info: `Voice ${cartesiaVoiceId} deleted from Cartesia.` };
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};