import { Storage } from '@google-cloud/storage';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUser } from '@/lib/user/user';

const storage = new Storage();
const bucketName = process.env.ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME;

if (!bucketName) {
  console.error("Configuration Error: ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME environment variable is not set.");
}

export async function POST(request: Request) {
  if (!bucketName) {
    return NextResponse.json({ error: 'Server configuration error: Bucket name missing' }, { status: 500 });
  }

  try {
    // 1. Authentication & User ID retrieval
    const user = await getCurrentUser();
    const userId = user?.id; 

    if (!userId) {
      console.warn("Unauthorized attempt to get upload URL without session/userId.");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get file details from request body
    const { contentType, fileSize } = await request.json();

    if (!contentType || !contentType.startsWith('image/')) {
        return NextResponse.json({ error: 'Invalid content type. Only images are allowed.' }, { status: 400 });
    }
    
    // 3. Generate a unique file path within the user's folder
    const extension = contentType.split('/')[1] || 'jpg'; // e.g., 'jpeg', 'png', default 'jpg'
    const fileId = uuidv4();
    const filePath = `${userId}/${fileId}.${extension}`;

    // 4. Configure signed URL options for upload
    const options = {
      version: 'v4' as const,
      action: 'write' as const,
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes expiry
      contentType: contentType, // Crucial for GCS to accept the upload
    };

    // 5. Get the signed URL from GCS
    const [signedUrl] = await storage
      .bucket(bucketName)
      .file(filePath) // Use the relative path within the bucket
      .getSignedUrl(options);

    // 6. Return the signed URL and the relative file path
    return NextResponse.json({ signedUrl, filePath, bucketName });

  } catch (error: any) {
    console.error('Error generating signed upload URL:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate signed upload URL',
        details: error.message
      },
      { status: 500 }
    );
  }
}