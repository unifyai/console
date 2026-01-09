import { NextRequest, NextResponse } from 'next/server';
import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest, { params }: { params: { predictionId: string } }) {
  const apiKey = request.headers.get('apiKey');
  if (!apiKey) {
    return NextResponse.json({ detail: 'API key is missing' }, { status: 401 });
  }

  try {
    const response = await fetch(
      `${ORCHESTRA_BASE_URL}/assistant/photo/animate/${params.predictionId}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    const responseData = await response.json();
    const camelCaseData = snakeToCamelObject(responseData) as Record<string, unknown>;

    if (!response.ok) {
      console.error(`Backend Error (photo/animate CANCEL - ${response.status}):`, responseData);
      return NextResponse.json(
        { detail: camelCaseData.detail || 'Failed to cancel animation' },
        { status: response.status }
      );
    }

    return NextResponse.json(camelCaseData, { status: response.status });
  } catch (error: any) {
    console.error('Error proxying to backend (photo/animate CANCEL):', error);
    return NextResponse.json(
      { detail: 'Failed to connect to animation service', errorDetails: error.message },
      { status: 503 }
    );
  }
}
