import { CustomResponseProps, ResponseProps } from "@/types/common";
import { LogItemProps, LogsResponseProps } from "@/types/evals/logs";
import { Storage } from "@google-cloud/storage";

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

// delete assistant record (API call)
export const deleteAssistant = async (apiKey: string) => {
    return async (assistantId: string): Promise<ResponseProps> => {
        "use server";

        try {
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}`,
                { method: "DELETE", headers: { apiKey: apiKey } }
            );
            // Check if the response is successful, otherwise parse error detail
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); // Try to parse error, default to empty obj
                const message = errorData.detail || `Failed to delete assistant: ${response.statusText}`;
                return { detail: message };
            }
            return await response.json(); // Assuming successful deletion returns { success: true, ... }
        } catch (error) {
             console.error(`[actions.ts deleteAssistant] Error deleting assistant ${assistantId}:`, error);
             const errorMsg = error instanceof Error ? error.message : "Unknown server error occurred.";
             return { detail: errorMsg };
        }
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

// Helper function to extract object path from GCS URL
const getObjectPathFromUrl = (gcsUrl: string): string | null => {
    const gcsUrlPrefix = 'https://storage.googleapis.com/';
    if (!gcsUrl.startsWith(gcsUrlPrefix)) {
        console.warn(`[actions.ts helper] URL "${gcsUrl}" is not a standard GCS URL.`);
        // Attempt fallback if it looks like a path, otherwise return null
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
            console.warn(`[actions.ts helper] URL Pathname "${url.pathname}" did not start with expected prefix "${expectedPathPrefix}".`);
            // Fallback: Remove just the leading slash, assuming the rest is the path.
            return url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
        }
    } catch (e) {
        console.error(`[actions.ts helper] Failed to parse URL to extract object path: ${gcsUrl}`, e);
        return null;
    }
};


// download photo from gcs
export const downloadPhoto = async () => {
    // filePathOrUrl can be a full GCS URL or just the object path
    return async (filePathOrUrl: string): Promise<{ signedUrl?: string; error?: string }> => {
        "use server";

        let objectPath = filePathOrUrl;

        // Use helper to extract path if it's a full URL
        if (filePathOrUrl.startsWith('https://storage.googleapis.com/')) {
            const extractedPath = getObjectPathFromUrl(filePathOrUrl);
            if (!extractedPath) {
                 return { error: "Could not extract file path from GCS URL." };
            }
            objectPath = extractedPath;
        }

        if (!objectPath) {
             return { error: "File path is missing or could not be determined." };
        }

        const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME;
        if (!bucketName) {
            console.error("[actions.ts downloadPhoto] GCS Bucket name environment variable is not set.");
            return { error: "Server configuration error: Bucket name missing." };
        }

        try {
            const storage = new Storage();
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
                 return { error: `Photo not found at path: ${objectPath}` };
            } else if (errorMsg.includes("does not have serviceusage.services.use access") || errorMsg.includes("caller does not have storage.objects.get access") || errorMsg.includes("permission denied") || errorMsg.includes("signBlob")) {
                 return { error: "Permission denied accessing photo." };
            }
            return { error: "Could not retrieve photo URL." };
        }
    };
};

// delete photo from gcs
export const deletePhoto = async () => {
     // Takes the full GCS URL or just the object path
    return async (filePathOrUrl: string): Promise<{ success: boolean; message?: string }> => {
        "use server";

        let objectPath = filePathOrUrl;

        // Use helper to extract path if it's a full URL
        if (filePathOrUrl.startsWith('https://storage.googleapis.com/')) {
             const extractedPath = getObjectPathFromUrl(filePathOrUrl);
             if (!extractedPath) {
                  console.error(`[actions.ts deletePhoto] Could not extract GCS object path from URL: ${filePathOrUrl}`);
                  return { success: false, message: "Invalid GCS file URL provided." };
             }
             objectPath = extractedPath;
        }

        if (!objectPath) {
             console.error("[actions.ts deletePhoto] GCS object path is missing.");
             return { success: false, message: "File path is missing." };
        }

        const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME;
        if (!bucketName) {
            console.error("[actions.ts deletePhoto] GCS Bucket name environment variable is not set.");
            return { success: false, message: "Server configuration error: Bucket name missing." };
        }

        try {
            const storage = new Storage();
            await storage.bucket(bucketName).file(objectPath).delete();
            return { success: true };
        } catch (error: any) {
            console.error(`[actions.ts deletePhoto] FAILED to delete object "${objectPath}" from bucket "${bucketName}":`, error);
             // Check for specific GCS errors (e.g., not found, permission denied)
             if (error.code === 404 || (error.message && error.message.includes("No such object"))) {
                 // If the object is already gone, consider it a success in terms of the desired state
                 console.warn(`[actions.ts deletePhoto] Object "${objectPath}" not found in bucket "${bucketName}". Assuming already deleted or path incorrect.`);
                 return { success: true, message: "Photo not found (might be already deleted)." };
             } else if (error.code === 403 || (error.message && (error.message.includes("permission denied") || error.message.includes("does not have storage.objects.delete access")))) {
                 return { success: false, message: "Permission denied to delete photo." };
             }
             const errorMsg = error instanceof Error ? error.message : "Unknown error deleting photo from storage.";
             return { success: false, message: errorMsg };
        }
    };
};


// get tasks
export const getTasks = async (apiKey: string) => {
    return async (filterExpression: string | null, limit: number | null, offset: number | null): Promise<LogsResponseProps> => {
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
            const json = await response.json();
            if (!response.ok)
                return { params: {}, logs: [], count: 0, groups: [], detail: json.detail };
            // Ensure logs is always an array, even if backend sends something else unexpectedly
            const logs = Array.isArray(json.logs) ? json.logs : [];
            return { ...json, logs: logs }; // Return the parsed response with guaranteed logs array
        } catch (e) {
            console.error(`Failed to get tasks error: ${e}`); // Use console.error for errors
            return {"params":{},"logs":[],"count":0, "groups": [], "detail": e instanceof Error ? e.message : String(e)}
        }
    };
};

// update task
export const updateTask = async (apiKey: string) => {
    return async (ids: number[], entries: LogItemProps): Promise<ResponseProps | CustomResponseProps> => {
        "use server";

        try {
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/logs`,
                {
                    method: "PUT",
                    headers: { apiKey: apiKey },
                    body: JSON.stringify({
                        ids: ids,
                        project: "Unity",
                        context: "Tasks",
                        params: {},
                        entries: entries,
                        overwrite: true
                    })
                }
            )
            return await response.json();
        } catch (e) {
            console.error(`Failed to update task: ${e}`); // Use console.error for errors
            return {success: false, message: e instanceof Error ? e.message : String(e)}
        }
    }
}