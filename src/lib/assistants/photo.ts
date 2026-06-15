'use server';

import { requireUserApiKey } from '@/lib/server-action-session';

import { ResponseProps } from '@/types/common';
import {
  PhotoCreationResponse,
  PhotoGenerateRequest,
  PhotoUploadResponse,
  ReplicatePredictionResponse,
} from '@/types/assistants/assistant';
import { getObjectPathFromUrl, isGcsPhoto } from '@/utils/assistants/gcs-utils';
import { Storage } from '@google-cloud/storage';
import { snakeToCamelObject, camelToSnakeObject } from '@/utils/casing';
import { getInternalApiBaseUrl } from '@/utils/assistants/api-utils';

let storage: Storage;
try {
  storage = new Storage();
} catch (error: any) {
  console.error('FATAL: Failed to initialize Storage client in photo.ts:', error);
}

export async function uploadPhoto(
  formData: FormData
): Promise<PhotoUploadResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();

  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/photo/upload`, {
      method: 'POST',
      headers: {
        apiKey: apiKey,
      },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
      const errorMessage = data.detail || `Failed to upload photo: ${response.statusText}`;
      return { detail: errorMessage };
    }
    if (data.info && data.info.gcsUrl) {
      return snakeToCamelObject<PhotoUploadResponse>(data.info);
    }
    return { detail: 'Photo uploaded but GCS URL not received.' };
  } catch (error) {
    console.error('[photo.ts uploadPhoto] Error during photo upload to backend:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown server error during photo upload.';
    return { detail: errorMessage };
  }
}
export async function uploadVideo(
  formData: FormData
): Promise<PhotoUploadResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();

  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/video/upload`, {
      method: 'POST',
      headers: {
        apiKey: apiKey,
      },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
      const errorMessage = data.detail || `Failed to upload video: ${response.statusText}`;
      return { detail: errorMessage };
    }
    if (data.info && data.info.gcsUrl) {
      return snakeToCamelObject<PhotoUploadResponse>(data.info); // Same response shape as photo
    }
    return { detail: 'Video uploaded but GCS URL not received.' };
  } catch (error) {
    console.error('[photo.ts uploadVideo] Error during video upload:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown server error during video upload.';
    return { detail: errorMessage };
  }
}
export async function listMediaFiles(prefix: string = ''): Promise<{
  files?: {
    name: string;
    url: string;
    contentType: string;
    size: string | number;
    updated: string;
  }[];
  detail?: string;
}> {
  const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_MEDIA_BUCKET_NAME;
  if (!bucketName) {
    console.error('[photo.ts listMediaFiles] GCS Bucket name environment variable is not set.');
    return { detail: 'Server configuration error: Bucket name missing.' };
  }
  if (!storage) {
    console.error('[photo.ts listMediaFiles] Storage client is not available.');
    return { detail: 'Server configuration error: Storage unavailable' };
  }

  try {
    const [files] = await storage.bucket(bucketName).getFiles({ prefix });

    const signedUrlPromises = files.map(async (file) => {
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000,
      });

      return {
        name: file.name,
        url: url,
        contentType: file.metadata.contentType || 'application/octet-stream',
        size: file.metadata.size || '0',
        updated: file.metadata.updated || new Date().toISOString(),
      };
    });

    const fileList = await Promise.all(signedUrlPromises);

    return { files: fileList };
  } catch (error) {
    console.error(
      `[photo.ts listMediaFiles] Failed to list files in bucket "${bucketName}":`,
      error
    );
    const errorMsg = error instanceof Error ? error.message : 'Unknown error listing media files.';
    return { detail: errorMsg };
  }
}
export async function downloadMedia(
  filePathOrUrl: string
): Promise<{ signedUrl?: string; detail?: string }> {
  let objectPath = filePathOrUrl;

  // Use helper to extract path if it's a full URL
  if (isGcsPhoto(filePathOrUrl)) {
    const extractedPath = getObjectPathFromUrl(filePathOrUrl);
    if (!extractedPath) {
      return { detail: 'Could not extract file path from GCS URL.' };
    }
    objectPath = extractedPath;
  }

  if (!objectPath) {
    return { detail: 'File path is missing or could not be determined.' };
  }

  // Preset media (paths starting with preset_assistants/) live in the
  // presets bucket, not the regular media bucket.
  const isPresetPath = objectPath.startsWith('preset_assistants/');
  const bucketName = isPresetPath
    ? process.env.ORCHESTRA_GCP_ASSISTANT_MEDIA_PRESETS_BUCKET_NAME
    : process.env.ORCHESTRA_GCP_ASSISTANT_MEDIA_BUCKET_NAME;

  if (!bucketName) {
    console.error('[photo.ts downloadMedia] GCS Bucket name environment variable is not set.');
    return { detail: 'Server configuration error: Bucket name missing.' };
  }
  if (!storage) {
    console.error('[photo.ts downloadMedia] Storage client is not available.');
    return { detail: 'Server configuration error: Storage unavailable' };
  }

  try {
    const options = {
      version: 'v4' as const,
      action: 'read' as const,
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    };

    const [url] = await storage.bucket(bucketName).file(objectPath).getSignedUrl(options);

    return { signedUrl: url };
  } catch (error) {
    console.error(
      `[photo.ts downloadMedia] FAILED to generate signed URL for object path "${objectPath}" in bucket "${bucketName}":`,
      error
    );
    const errorMsg =
      error instanceof Error ? error.message : 'Unknown error generating download URL.';
    if (errorMsg.includes('No such object')) {
      return { detail: `Photo not found at path: ${objectPath}` };
    } else if (
      errorMsg.includes('does not have serviceusage.services.use access') ||
      errorMsg.includes('caller does not have storage.objects.get access') ||
      errorMsg.includes('permission denied') ||
      errorMsg.includes('signBlob')
    ) {
      return { detail: 'Permission denied accessing photo.' };
    }
    return { detail: 'Could not retrieve photo URL.' };
  }
}
export async function downloadPresetPhoto(
  firstName: string,
  lastName: string
): Promise<{ signedUrl?: string; gcsUrl?: string; detail?: string }> {
  // Construct object path for preset photos stored under photos/ subfolder
  const objectPath = `preset_assistants/photos/${firstName}_${lastName}.jpg`;

  const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_MEDIA_PRESETS_BUCKET_NAME;
  if (!bucketName) {
    console.error(
      '[photo.ts downloadPresetPhoto] GCS Presets Bucket name environment variable is not set.'
    );
    return { detail: 'Server configuration error: Presets Bucket name missing.' };
  }
  if (!storage) {
    console.error('[photo.ts downloadPresetPhoto] Storage client is not available.');
    return { detail: 'Server configuration error: Storage unavailable' };
  }

  try {
    const options = {
      version: 'v4' as const,
      action: 'read' as const,
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    };

    const [url] = await storage.bucket(bucketName).file(objectPath).getSignedUrl(options);

    return { signedUrl: url, gcsUrl: `gs://${bucketName}/${objectPath}` };
  } catch (error) {
    console.error(
      `[photo.ts downloadPresetPhoto] FAILED to generate signed URL for object path "${objectPath}" in bucket "${bucketName}":`,
      error
    );
    const errorMsg =
      error instanceof Error ? error.message : 'Unknown error generating download URL.';
    if (errorMsg.includes('No such object')) {
      return { detail: `Preset photo not found at path: ${objectPath}` };
    } else if (
      errorMsg.includes('does not have serviceusage.services.use access') ||
      errorMsg.includes('caller does not have storage.objects.get access') ||
      errorMsg.includes('permission denied') ||
      errorMsg.includes('signBlob')
    ) {
      return { detail: 'Permission denied accessing preset photo.' };
    }
    return { detail: 'Could not retrieve preset photo URL.' };
  }
}
export async function downloadPresetVideo(
  firstName: string,
  lastName: string,
  provider: string
): Promise<{ signedUrl?: string; gcsUrl?: string; detail?: string }> {
  // Construct object path using firstName, lastName, and provider
  const objectPath = `preset_assistants/videos/${firstName}_${lastName}_${provider.toLowerCase()}.mp4`;

  const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_MEDIA_PRESETS_BUCKET_NAME;
  if (!bucketName) {
    console.error(
      '[photo.ts downloadPresetVideo] GCS Presets Bucket name environment variable is not set.'
    );
    return { detail: 'Server configuration error: Presets Bucket name missing.' };
  }
  if (!storage) {
    console.error('[photo.ts downloadPresetVideo] Storage client is not available.');
    return { detail: 'Server configuration error: Storage unavailable' };
  }

  try {
    const options = {
      version: 'v4' as const,
      action: 'read' as const,
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    };

    const [url] = await storage.bucket(bucketName).file(objectPath).getSignedUrl(options);

    return { signedUrl: url, gcsUrl: `gs://${bucketName}/${objectPath}` };
  } catch (error) {
    console.error(
      `[photo.ts downloadPresetVideo] FAILED to generate signed URL for object path "${objectPath}" in bucket "${bucketName}":`,
      error
    );
    const errorMsg =
      error instanceof Error ? error.message : 'Unknown error generating download URL.';
    if (errorMsg.includes('No such object')) {
      return { detail: `Preset video not found at path: ${objectPath}` };
    } else if (
      errorMsg.includes('does not have serviceusage.services.use access') ||
      errorMsg.includes('caller does not have storage.objects.get access') ||
      errorMsg.includes('permission denied') ||
      errorMsg.includes('signBlob')
    ) {
      return { detail: 'Permission denied accessing preset video.' };
    }
    return { detail: 'Could not retrieve preset video URL.' };
  }
}
export async function generatePhoto(
  payload: PhotoGenerateRequest
): Promise<PhotoCreationResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();

  try {
    // Convert camelCase payload to snake_case for API
    const snakeCasePayload = camelToSnakeObject(payload);

    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/photo/generate`, {
      method: 'POST',
      headers: { apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(snakeCasePayload),
    });
    const data = await response.json();
    if (!response.ok) {
      return { detail: data.detail || `Failed to generate photo: ${response.statusText}` };
    }
    if (data.info && typeof data.info === 'string') {
      return { url: data.info };
    }
    return { detail: 'Photo generation succeeded but response format was unexpected.' };
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Unknown error generating photo.' };
  }
}
export async function editPhoto(
  formData: FormData
): Promise<PhotoCreationResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();

  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/photo/edit`, {
      method: 'POST',
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
    if (data.info && typeof data.info === 'string') {
      return { url: data.info };
    }
    return { detail: 'Photo edit succeeded but response format was unexpected.' };
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Unknown error editing photo.' };
  }
}
export async function animatePhoto(
  formData: FormData
): Promise<ReplicatePredictionResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();

  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/photo/animate`, {
      method: 'POST',
      headers: {
        apiKey: apiKey,
        // Content-Type is set by browser for FormData
      },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        detail: data.detail || `Failed to start animation: ${response.statusText}`,
        status: response.status,
      };
    }
    if (data.info && data.info.id) {
      return snakeToCamelObject<ReplicatePredictionResponse>(data.info);
    }
    return { detail: 'Animation job started but response format was unexpected.' };
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : 'Unknown error starting animation.',
    };
  }
}
export async function getAnimationPrediction(
  predictionId: string
): Promise<ReplicatePredictionResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();

  try {
    const response = await fetch(
      `${getInternalApiBaseUrl()}/api/assistant/photo/animate/${predictionId}`,
      {
        method: 'GET',
        headers: { apiKey },
      }
    );
    const data = await response.json();
    if (!response.ok) {
      return { detail: data.detail || `Failed to get prediction status: ${response.statusText}` };
    }
    if (data.info && data.info.id) {
      return snakeToCamelObject<ReplicatePredictionResponse>(data.info);
    }
    return { detail: 'Unexpected response structure for prediction status.' };
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : 'Unknown error getting prediction status.',
    };
  }
}
export async function cancelAnimationPrediction(
  predictionId: string
): Promise<ReplicatePredictionResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();

  try {
    const response = await fetch(
      `${getInternalApiBaseUrl()}/api/assistant/photo/animate/${predictionId}/cancel`,
      {
        method: 'POST',
        headers: { apiKey },
      }
    );
    const data = await response.json();
    if (!response.ok) {
      return { detail: data.detail || `Failed to cancel prediction: ${response.statusText}` };
    }
    if (data.info && data.info.id) {
      return snakeToCamelObject<ReplicatePredictionResponse>(data.info);
    }
    return { detail: 'Unexpected response structure for prediction cancellation.' };
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : 'Unknown error canceling prediction.',
    };
  }
}
