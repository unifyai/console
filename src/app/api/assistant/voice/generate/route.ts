import { NextRequest, NextResponse } from 'next/server';
import {
  getApiKeyFromRequest,
  unauthorized,
  badRequest,
  internalError,
} from '../../../_utils/auth';
import { camelToSnakeObject } from '@/utils/casing';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    console.error('Failed to parse JSON body in POST /api/assistant/voice/generate:', error);
    return badRequest('Invalid request body');
  }

  // Transform camelCase keys to snake_case for Orchestra API
  const snakeCaseBody = camelToSnakeObject(requestBody);

  try {
    const orchestraResponse = await fetch(`${ORCHESTRA_BASE_URL}/assistant/voice/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        accept: 'application/octet-stream, application/json',
      },
      body: JSON.stringify(snakeCaseBody),
    });

    if (!orchestraResponse.ok) {
      let errorDetailMessage = 'Failed to generate speech via backend service.';
      try {
        const errorData = await orchestraResponse.json();
        if (errorData.detail) {
          if (typeof errorData.detail === 'string') {
            errorDetailMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            // Format FastAPI validation errors
            errorDetailMessage = errorData.detail
              .map((err: any) => {
                const field =
                  err.loc && err.loc.length > 1
                    ? err.loc.slice(1).join('.')
                    : (err.loc && err.loc[0]) || 'body';
                return `${field}: ${err.msg}`;
              })
              .join('; ');
          } else if (typeof errorData.detail === 'object') {
            errorDetailMessage = JSON.stringify(errorData.detail);
          }
        }
        console.error(
          `[API PROXY /api/assistant/voice/generate] Backend Error (${orchestraResponse.status}):`,
          errorData
        );
      } catch (e) {
        const textError = await orchestraResponse.text();
        errorDetailMessage = textError || errorDetailMessage;
        console.error(
          `[API PROXY /api/assistant/voice/generate] Backend Error (${orchestraResponse.status}): Non-JSON response: ${textError}`
        );
      }
      return NextResponse.json(
        { detail: errorDetailMessage },
        { status: orchestraResponse.status }
      );
    }

    const audioBlob = await orchestraResponse.blob();
    const contentType = orchestraResponse.headers.get('content-type') || 'application/octet-stream';

    return new NextResponse(audioBlob, {
      status: 200,
      headers: { 'Content-Type': contentType },
    });
  } catch (error: any) {
    console.error('[API PROXY /api/assistant/voice/generate] Error proxying to backend:', error);
    return internalError('Failed to connect to speech generation service');
  }
}
