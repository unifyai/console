import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { getObjectPathFromUrl, isGcsPhoto } from '@/utils/assistants/gcs-utils';

let storage: Storage;
try {
  storage = new Storage();
} catch (error: any) {
  console.error('FATAL: Failed to initialize Storage client in batch-urls route:', error);
}

const MAX_BATCH_SIZE = 50;
const SIGNED_URL_EXPIRY_MS = 15 * 60 * 1000;

function resolveBucket(objectPath: string): string | undefined {
  const isPresetPath = objectPath.startsWith('preset_assistants/');
  return isPresetPath
    ? process.env.ORCHESTRA_GCP_ASSISTANT_MEDIA_PRESETS_BUCKET_NAME ||
        process.env.ORCHESTRA_GCP_ASSISTANT_MEDIA_BUCKET_NAME ||
        process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME
    : process.env.ORCHESTRA_GCP_ASSISTANT_MEDIA_BUCKET_NAME ||
        process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME;
}

/**
 * Batch-generates signed GCS URLs for a list of media paths.
 * Accepts GCS URLs (gs://…, https://storage.googleapis.com/…) or raw object paths.
 * Automatically routes preset paths to the presets bucket.
 */
export async function POST(request: NextRequest) {
  if (!storage) {
    return NextResponse.json(
      { detail: 'Server configuration error: Storage unavailable' },
      { status: 500 }
    );
  }

  let body: { paths?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid request body' }, { status: 400 });
  }

  const paths = body.paths;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { detail: `paths must be an array of 1-${MAX_BATCH_SIZE} items` },
      { status: 400 }
    );
  }

  const results: Record<string, string> = {};

  await Promise.all(
    paths.map(async (filePathOrUrl) => {
      let objectPath = filePathOrUrl;

      if (isGcsPhoto(filePathOrUrl)) {
        const extracted = getObjectPathFromUrl(filePathOrUrl);
        if (!extracted) return;
        objectPath = extracted;
      }

      if (!objectPath) return;

      const bucketName = resolveBucket(objectPath);
      if (!bucketName) return;

      try {
        const [url] = await storage
          .bucket(bucketName)
          .file(objectPath)
          .getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + SIGNED_URL_EXPIRY_MS,
          });
        results[filePathOrUrl] = url;
      } catch {
        // Skip failed entries — the client will show a fallback
      }
    })
  );

  return NextResponse.json({ urls: results });
}
