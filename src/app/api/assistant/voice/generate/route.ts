import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  getApiKeyFromRequest,
  unauthorized,
  badRequest,
  internalError,
} from '../../../_utils/auth';
import { camelToSnakeObject } from '@/utils/casing';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export const runtime = 'nodejs';

const localElevenLabsPreviewFiles: Record<string, string> = {
  cgSgspJ2msm6clMCkdW9: '01-sales-jessica-cute.mp3',
  FGY2WhTYpPnrIDTdsKH5: '02-sales-laura-sassy.mp3',
  ThT5KcBeYPX3keUQqHPh: '03-accounts-dorothy-pleasant.mp3',
  MF3mGyEYCl7XYWbV9V6O: '04-accounts-elli-soft.mp3',
  AZnzlk1XvdvUeBnXmlld: '05-operations-domi-childish.mp3',
  zrHiDhphv9ZnVXBqCLjz: '06-operations-mimi-childish.mp3',
  CYw3kZ02Hs0563khs1Fj: 'male-options/08-male-dave-conversational.mp3',
  IKne3meq5aSn9XLyUdCD: 'male-options/10-male-charlie-energetic.mp3',
  TX3LPaxmHKxFdv7VOQHJ: 'male-options/11-male-liam-warm.mp3',
  bVMeCyTHy58xNoL34h3p: 'male-options/12-male-jeremy-excited.mp3',
  iP95p4xoKVk53GoZ742B: 'male-options/13-male-chris-casual.mp3',
  cjVigY5qzO86Huf0OWal: 'male-options/14-male-eric-tenor.mp3',
};

function getLocalElevenLabsSamplePath(voiceId: string): string | null {
  const sampleFile = localElevenLabsPreviewFiles[voiceId];
  if (!sampleFile) return null;

  const sampleDir =
    process.env.LOCAL_ELEVENLABS_SAMPLE_DIR ||
    path.join(os.homedir(), 'Desktop', 'elevenlabs-character-samples');
  return path.join(sampleDir, sampleFile);
}

async function createLocalElevenLabsPreviewResponse(
  requestBody: any
): Promise<NextResponse | null> {
  if (process.env.NODE_ENV !== 'development') return null;

  const provider = requestBody.provider;
  const voiceId = requestBody.voiceId || requestBody.voice_id;
  if (provider !== 'elevenlabs' || !voiceId) return null;

  const samplePath = getLocalElevenLabsSamplePath(voiceId);
  if (!samplePath) return null;

  try {
    const audio = await readFile(samplePath);
    return new NextResponse(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-Local-Voice-Preview': 'true',
      },
    });
  } catch (error) {
    console.error('[API /api/assistant/voice/generate] Local voice preview sample missing:', error);
    return null;
  }
}

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

  const localPreviewResponse = await createLocalElevenLabsPreviewResponse(requestBody);
  if (localPreviewResponse) return localPreviewResponse;

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
