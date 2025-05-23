import { Storage } from "@google-cloud/storage";
import { ResponseProps } from "@/types/common";
import { getObjectPathFromUrl } from "@/utils/team/gcs-utils";
import { v4 as uuidv4 } from 'uuid';

let storage: Storage;
try {
   storage = new Storage();
} catch (error: any) {
   console.error("FATAL: Failed to initialize Storage client in photo.ts:", error);
}
const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME;

export const uploadPhoto = async (userId: string) => {
    return async (contentType: string, fileSize: number): Promise<{ signedUrl: string, filePath: string, bucketName: string } | ResponseProps> => {
        "use server"

        if (!bucketName) {
            console.error("[photo.ts uploadPhoto] Configuration Error: ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME missing.");
            return { detail: "Server configuration error: Bucket name missing" };
        }
        if (!storage) {
            console.error("[photo.ts uploadPhoto] Storage client is not available in uploadPhoto action.");
            return { detail: "Server configuration error: Storage unavailable" };
        }

        try {
            // 1. Check user Id - Already passed as arg, ensuring it's valid
            if (!userId) {
                console.warn("[photo.ts uploadPhoto] Invalid userId provided.");
                return { detail: "User identification failed." };
            }

            // 2. Validate content type
            if (!contentType || !contentType.startsWith('image/')) {
                console.warn(`[photo.ts uploadPhoto] Invalid content type: ${contentType}`);
                return { detail: "Invalid content type. Only images allowed." };
            }
            
            // Add size validation if needed (example: max 5MB)
            const MAX_SIZE_MB = 5;
            if (fileSize > MAX_SIZE_MB * 1024 * 1024) {
                console.warn(`[photo.ts] File size too large: ${fileSize} bytes`);
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
            console.error('[photo.ts uploadPhoto] Error during signed URL generation or validation:', error);
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

export const deletePhoto = async () => {
     // Takes the full GCS URL or just the object path
    return async (filePathOrUrl: string): Promise<ResponseProps> => {
        "use server";

        let objectPath = filePathOrUrl;

        // Use helper to extract path if it's a full URL
        if (filePathOrUrl.startsWith('https://storage.googleapis.com/')) {
             const extractedPath = getObjectPathFromUrl(filePathOrUrl);
             if (!extractedPath) {
                  console.error(`[photo.ts deletePhoto] Could not extract GCS object path from URL: ${filePathOrUrl}`);
                  return { detail: "Invalid GCS file URL provided." };
             }
             objectPath = extractedPath;
        }

        if (!objectPath) {
             console.error("[photo.ts deletePhoto] GCS object path is missing.");
             return { detail: "File path is missing." };
        }

        const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME;
        if (!bucketName) {
            console.error("[photo.ts deletePhoto] GCS Bucket name environment variable is not set.");
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
            console.error(`[photo.ts deletePhoto] FAILED to delete object "${objectPath}" from bucket "${bucketName}":`, error);
             // Check for specific GCS errors (e.g., not found, permission denied)
             if (error.code === 404 || (error.message && error.message.includes("No such object"))) {
                console.warn(`[photo.ts deletePhoto] Object "${objectPath}" not found in bucket "${bucketName}". Assuming already deleted or path incorrect.`);
                return { detail: "Photo not found (might be already deleted)." };
             } else if (error.code === 403 || (error.message && (error.message.includes("permission denied") || error.message.includes("does not have storage.objects.delete access")))) {
                 return { detail: "Permission denied to delete photo." };
             }
             const errorMsg = error instanceof Error ? error.message : "Unknown error deleting photo from storage.";
             return { detail: errorMsg };
        }
    };
};
