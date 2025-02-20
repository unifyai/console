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

    // Check if there's an existing URL in the request
    const existingUrl = searchParams.get('url');
    if (existingUrl) {
      try {
        const urlObj = new URL(existingUrl);
        const expiresParam = urlObj.searchParams.get('Expires');
        
        if (expiresParam) {
          const expiryTime = parseInt(expiresParam) * 1000; // Convert to milliseconds
          // If URL is still valid and not expiring in the next 5 minutes
          if (Date.now() < expiryTime - (5 * 60 * 1000)) {
            // Test the URL with a HEAD request to verify it's still valid
            try {
              const testResponse = await fetch(existingUrl, { method: 'HEAD' });
              if (testResponse.ok) {
                return NextResponse.json({ url: existingUrl });
              }
              // If we get here, the URL is invalid despite not being expired
              console.warn('URL is within expiry time but returns error');
            } catch (fetchError) {
              console.warn('Error testing URL validity:', fetchError);
            }
          }
        }
      } catch (urlError) {
        // If there's any error parsing the URL, generate a new one
        console.warn('Error parsing existing URL:', urlError);
      }
    }

    // Generate a new signed URL
    const [signedUrl] = await file.getSignedUrl(options);
    return NextResponse.json({ url: signedUrl });

  } catch (error: any) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate signed URL',
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}