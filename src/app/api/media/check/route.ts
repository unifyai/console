import { Storage } from '@google-cloud/storage';
import { NextResponse } from 'next/server';

const storage = new Storage();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ isImage: false, message: 'Missing URL' }, { status: 400 });
    }

    const gcsUrl = new URL(url);

    const pathParts = gcsUrl.pathname.split('/').filter(Boolean);

    if (pathParts.length < 2) {
      return NextResponse.json({ isImage: false }, { status: 400 });
    }

    const bucketName = pathParts[0];
    const objectName = pathParts.slice(1).join('/');

    const file = storage.bucket(bucketName).file(objectName);
    const [metadata] = await file.getMetadata();

    const contentType = metadata.contentType || '';

    const isImage = contentType.startsWith('image/');

    return NextResponse.json({
      isImage,
      contentType,
      metadata: {
        size: metadata.size,
        timeCreated: metadata.timeCreated,
        updated: metadata.updated,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }
    return NextResponse.json(
      {
        isImage: false,
        error: String(error),
        errorType: error instanceof Error ? error.name : 'Unknown',
      },
      { status: 500 }
    );
  }
}
