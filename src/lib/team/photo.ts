import { ResponseProps } from "@/types/common";
import { PhotoCreationResponse, PhotoGenerateRequest, PhotoUploadResponse } from "@/types/team/assistant";
import { getObjectPathFromUrl, isGcsPhoto } from "@/utils/team/gcs-utils";
import { Storage } from "@google-cloud/storage";

let storage: Storage;
try {
   storage = new Storage();
} catch (error: any) {
   console.error("FATAL: Failed to initialize Storage client in photo.ts:", error);
}

export const uploadPhoto = async (apiKey: string) => {
    return async (formData: FormData): Promise<PhotoUploadResponse | ResponseProps> => {
        "use server"

        try {            
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/assistant/photo/upload`, // New Next.js API route proxy
                {
                    method: "POST",
                    headers: { 
                        apiKey: apiKey,
                        // Content-Type is set by browser for FormData
                    },
                    body: formData,
                }
            );

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data.detail || `Failed to upload photo: ${response.statusText}`;
                return { detail: errorMessage };
            }
            
            // Expect backend to return { info: { gcs_url: "..." } }
            if (data.info && data.info.gcs_url) {
                return data.info as PhotoUploadResponse;
            }
            return { detail: "Photo uploaded but GCS URL not received in expected format."};

        } catch (error) {
            console.error('[photo.ts uploadAssistantPhoto] Error during photo upload to backend:', error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred during photo upload.";
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
        if (isGcsPhoto(filePathOrUrl)) {
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
            console.error("[photo.ts downloadPhoto] GCS Bucket name environment variable is not set.");
            return { detail: "Server configuration error: Bucket name missing." };
        }
        if (!storage) {
            console.error("[photo.ts downloadPhoto] Storage client is not available in uploadPhoto action.");
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
            console.error(`[photo.ts downloadPhoto] FAILED to generate signed URL for object path "${objectPath}" in bucket "${bucketName}":`, error);
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

export const downloadPresetVideo = async () => {
    return async (firstName: string, lastName: string): Promise<{ signedUrl?: string; detail?: string }> => {
        "use server";

        const objectPath = `preset_assistants/${firstName}_${lastName}.mp4`;

        const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME;
        if (!bucketName) {
            console.error("[photo.ts downloadPresetVideo] GCS Bucket name environment variable is not set.");
            return { detail: "Server configuration error: Bucket name missing." };
        }
        if (!storage) {
            console.error("[photo.ts downloadPresetVideo] Storage client is not available.");
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
            console.error(`[photo.ts downloadPresetVideo] FAILED to generate signed URL for object path "${objectPath}" in bucket "${bucketName}":`, error);
            const errorMsg = error instanceof Error ? error.message : "Unknown error generating download URL.";
            if (errorMsg.includes("No such object")) {
                 return { detail: `Preset video not found at path: ${objectPath}` };
            } else if (errorMsg.includes("does not have serviceusage.services.use access") || errorMsg.includes("caller does not have storage.objects.get access") || errorMsg.includes("permission denied") || errorMsg.includes("signBlob")) {
                 return { detail: "Permission denied accessing preset video." };
            }
            return { detail: "Could not retrieve preset video URL." };
        }
    };
};

export const generatePhoto = async (apiKey: string) => {
    return async (payload: PhotoGenerateRequest): Promise<PhotoCreationResponse | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/photo/generate`, {
                method: "POST",
                headers: { apiKey, "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to generate photo: ${response.statusText}` };
            }
            // Response from Replicate/Orchestra is { info: { url: "..." } }
            if (data.info && data.info.url) {
                return data.info as PhotoCreationResponse;
            }
            return { detail: "Photo generation succeeded but response format was unexpected." };
        } catch (error) {
            return { detail: error instanceof Error ? error.message : "Unknown error generating photo." };
        }
    };
};

export const editPhoto = async (apiKey: string) => {
    return async (formData: FormData): Promise<PhotoCreationResponse | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/photo/edit`, {
                method: "POST",
                headers: { 
                    apiKey: apiKey,
                    // Content-Type is set by browser for FormData
                },
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to edit photo: ${response.statusText}` };
            }
            if (data.info && data.info.url) {
                return data.info as PhotoCreationResponse;
            }
            return { detail: "Photo edit succeeded but response format was unexpected." };
        } catch (error) {
            return { detail: error instanceof Error ? error.message : "Unknown error editing photo." };
        }
    };
};