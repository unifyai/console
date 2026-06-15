import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../../../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ predictionId: string }> }
) {
  const { predictionId } = await params;
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.POST(
      '/v0/assistant/photo/animate/{prediction_id}/cancel',
      {
        params: {
          path: { prediction_id: predictionId },
        },
      }
    );

    if (error) {
      console.error(`Backend Error (photo/animate CANCEL - ${response.status}):`, error);
      return NextResponse.json(
        { detail: (error as Record<string, unknown>)?.detail || 'Failed to cancel animation' },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (e: unknown) {
    console.error('Error proxying to backend (photo/animate CANCEL):', e);
    return NextResponse.json(
      {
        detail: 'Failed to connect to animation service',
        errorDetails: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
