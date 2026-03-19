import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

let storage: Storage;
try {
  storage = new Storage();
} catch (error: any) {
  console.error('FATAL: Failed to initialize Storage client in preset photos route:', error);
}

const MAX_BATCH_SIZE = 24;
const SIGNED_URL_EXPIRY_MS = 15 * 60 * 1000;
const NAME_PATTERN = /^[A-Za-z\-' ]+$/;

function isValidName(name: string): boolean {
  return name.length > 0 && name.length <= 50 && NAME_PATTERN.test(name);
}

export async function POST(request: NextRequest) {
  const bucketName =
    process.env.ORCHESTRA_GCP_ASSISTANT_MEDIA_PRESETS_BUCKET_NAME ||
    process.env.ORCHESTRA_GCP_ASSISTANT_MEDIA_BUCKET_NAME ||
    process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME;

  if (!bucketName || !storage) {
    return NextResponse.json(
      { detail: 'Server configuration error' },
      { status: 500 }
    );
  }

  let body: { presets?: { firstName: string; surname: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid request body' }, { status: 400 });
  }

  const presets = body.presets;
  if (!Array.isArray(presets) || presets.length === 0 || presets.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { detail: `presets must be an array of 1-${MAX_BATCH_SIZE} items` },
      { status: 400 }
    );
  }

  for (const p of presets) {
    if (!p.firstName || !p.surname || !isValidName(p.firstName) || !isValidName(p.surname)) {
      return NextResponse.json(
        { detail: `Invalid preset name: ${p.firstName} ${p.surname}` },
        { status: 400 }
      );
    }
  }

  const results: Record<string, string> = {};

  await Promise.all(
    presets.map(async ({ firstName, surname }) => {
      const key = `${firstName}_${surname}`;
      const objectPath = `preset_assistants/photos/${key}.jpg`;
      try {
        const [url] = await storage
          .bucket(bucketName)
          .file(objectPath)
          .getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + SIGNED_URL_EXPIRY_MS,
          });
        results[key] = url;
      } catch {
        // Skip failed entries — the client will show a fallback avatar
      }
    })
  );

  return NextResponse.json({ urls: results });
}
