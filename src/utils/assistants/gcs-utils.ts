export const isGcsPhoto = (photoPath: string | null | undefined): boolean => {
  if (!photoPath) return false;
  return photoPath.startsWith('gs://') || photoPath.startsWith('https://storage.googleapis.com/');
};

export async function uploadImageToGCS(file: File, signedUrl: string): Promise<boolean> {
  /* ... as before ... */
  try {
    const response = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[gcs-utils.ts ]GCS Upload Failed:', response.status, errorText);
      return false;
    }
    return true;
  } catch (error: any) {
    console.error('[gcs-utils.ts ] Error during GCS fetch:', error);
    return false;
  }
}

export const getObjectPathFromUrl = (gcsUrl: string): string | null => {
  const gcsGsPrefix = 'gs://';
  const gcsHttpPrefix = 'https://storage.googleapis.com/';
  try {
    if (gcsUrl.startsWith(gcsGsPrefix)) {
      const pathWithoutGs = gcsUrl.substring(gcsGsPrefix.length);
      const parts = pathWithoutGs.split('/');
      if (parts.length > 1) {
        return parts.slice(1).join('/'); // Return everything after the bucket name
      }
      return null; // Only bucket name, no object path
    } else if (gcsUrl.startsWith(gcsHttpPrefix)) {
      const url = new URL(gcsUrl);
      // The pathname will be /<bucket-name>/<object-path>
      const pathParts = url.pathname.split('/');
      if (pathParts.length > 2) {
        // Needs at least /bucket/object
        return pathParts.slice(2).join('/'); // Return object path
      }
      return null;
    } else {
      // If it's not a GCS URL, it might be an external URL or already just a path
      // For this function's purpose (extracting GCS object path), return null or the path itself if it's not an HTTP URL
      if (!gcsUrl.startsWith('http://') && !gcsUrl.startsWith('https://')) {
        return gcsUrl; // Assume it's already a relative path
      }
      console.warn(
        `[gcs-utils.ts getObjectPathFromUrl] URL "${gcsUrl}" is not a recognized GCS URL format for path extraction.`
      );
      return null;
    }
  } catch (e) {
    console.error(
      `[gcs-utils.ts getObjectPathFromUrl] Failed to parse URL to extract object path: ${gcsUrl}`,
      e
    );
    return null;
  }
};
