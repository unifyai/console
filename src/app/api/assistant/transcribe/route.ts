import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest, internalError } from '../../_utils/auth';

const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramKey) {
    return internalError('Speech-to-text is not configured');
  }

  const contentType = request.headers.get('content-type');
  if (!contentType?.startsWith('audio/')) {
    return badRequest('Request must contain audio data');
  }

  const audioBuffer = await request.arrayBuffer();
  if (audioBuffer.byteLength === 0) {
    return badRequest('Empty audio data');
  }

  const params = new URLSearchParams({
    model: 'nova-3',
    language: 'en-GB',
    smart_format: 'true',
    punctuate: 'true',
  });

  const resp = await fetch(`${DEEPGRAM_API_URL}?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${deepgramKey}`,
      'Content-Type': contentType,
    },
    body: audioBuffer,
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => 'Deepgram transcription failed');
    console.error(`[API /transcribe] Deepgram error (${resp.status}): ${detail}`);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 502 });
  }

  const data = await resp.json();
  const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';

  return NextResponse.json({ transcript });
}
