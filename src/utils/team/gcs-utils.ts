import { toast } from "sonner";

const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME;

export const isGcsPhoto = (photoPath: string | null | undefined): boolean => {
    if (!photoPath) return false;
    return photoPath.includes('storage.googleapis.com/');
};

export async function uploadImageToGCS (file: File, signedUrl: string): Promise<boolean> { /* ... as before ... */
    try {
        const response = await fetch(signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error("[gcs-utils.ts ]GCS Upload Failed:", response.status, errorText);
            return false;
        }
        return true;
    } catch (error: any) {
       console.error("[gcs-utils.ts ] Error during GCS fetch:", error);
       return false;
    }
};

export const getObjectPathFromUrl = (gcsUrl: string): string | null => {
    const gcsUrlPrefix = 'https://storage.googleapis.com/';
    if (!gcsUrl.startsWith(gcsUrlPrefix)) {
        console.warn(`[actions.ts helper] URL "${gcsUrl}" is not a standard GCS URL.`);
        return !gcsUrl.startsWith('http') ? gcsUrl : null;
    }
    try {
        const url = new URL(gcsUrl);
        const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME;
        if (!bucketName) {
            console.error("[gcs-utils.ts] Bucket name env var missing for path extraction.");
            return null;
        }
        const expectedPathPrefix = `/${bucketName}/`;
        if (url.pathname.startsWith(expectedPathPrefix)) {
            return url.pathname.substring(expectedPathPrefix.length);
        } else {
            console.warn(`[gcs-utils.ts] URL Pathname "${url.pathname}" did not start with expected prefix "${expectedPathPrefix}". Assuming path without bucket.`);
             // Fallback: Remove just the leading slash, assuming the rest is the path.
             return url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
        }
    } catch (e) {
        console.error(`[gcs-utils.ts] Failed to parse URL to extract object path: ${gcsUrl}`, e);
        return null;
    }
};