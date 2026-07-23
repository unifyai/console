import { Storage } from '@google-cloud/storage';
import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';

const storage = new Storage();

const ALLOWED_BUCKETS = new Set([
  'assistant-call-recordings-production',
  'assistant-call-recordings-staging',
  'unity-call-recordings',
  'assistant-media-production',
  'assistant-media-staging',
  'assistant-media-presets',
  'assistant-message-attachments-production',
  'assistant-message-attachments-staging',
  'console-app-profile-images',
  'hub-provider-images',
  'interface-file-system',
  'interface-file-system-staging',
  'log-images-bucket',
  'test-log-images-bucket',
  'unify-generated-plots',
]);

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const { searchParams } = new URL(request.url);
    const bucketName = searchParams.get('bucket');
    const filePath = searchParams.get('path');

    if (!bucketName || !filePath) {
      return NextResponse.json({ error: 'Missing bucket or path parameter' }, { status: 400 });
    }

    if (!ALLOWED_BUCKETS.has(bucketName)) {
      return NextResponse.json({ error: 'Bucket not allowed' }, { status: 403 });
    }

    if (filePath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const file = storage.bucket(bucketName).file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const options = {
      action: 'read' as const,
      expires: Date.now() + 60 * 60 * 1000,
    };

    const [signedUrl] = await file.getSignedUrl(options);
    return NextResponse.json({ url: signedUrl });
  } catch (error: any) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 });
  }
}
