import { Storage } from '@google-cloud/storage';
import { NextResponse } from 'next/server';

const storage = new Storage();

export async function GET(request: Request) {
  try {
    // Parse URL parameters
    const { searchParams } = new URL(request.url);
    const bucketName = searchParams.get('bucket');
    const filePath = searchParams.get('path');

    
    if (!bucketName || !filePath) {
      return NextResponse.json(
        { error: 'Missing bucket or path parameter' },
        { status: 400 }
      );
    }

    // Create a reference to the file in the specified bucket
    const file = storage.bucket(bucketName).file(filePath);

    // Verify the file exists
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Generate a signed URL valid for 1 hour (3600 seconds)
    const options = {
      action: 'read' as const,
      expires: Date.now() + 60 * 60 * 1000 // 1 hour from now in milliseconds
    };

    const [signedUrl] = await file.getSignedUrl(options);

    // Return the signed url as JSON
    return NextResponse.json({ url: signedUrl });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate signed URL', details: String(error) },
      { status: 500 }
    );
  }
}