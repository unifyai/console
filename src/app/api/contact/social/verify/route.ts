import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import {
  createCommunicationClient,
  getCommunicationErrorDetail,
  getCommunicationErrorStatus,
} from '@/lib/communication/client';

const isStaging = (process.env.ORCHESTRA_URL ?? '').includes('staging');
const isLocal =
  (process.env.ORCHESTRA_URL ?? '').includes('localhost') ||
  (process.env.ORCHESTRA_URL ?? '').includes('127.0.0.1');

export async function POST(request: NextRequest) {
  if (!isStaging && !isLocal) {
    return NextResponse.json(
      { detail: 'Social account verification is currently unavailable. Coming soon.' },
      { status: 503 }
    );
  }

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    return NextResponse.json({ detail: 'Invalid request body' }, { status: 400 });
  }

  const { platform, accountIdentifier } = requestBody;
  if (!platform || !accountIdentifier) {
    return NextResponse.json(
      { detail: 'Missing required fields: platform, accountIdentifier' },
      { status: 400 }
    );
  }

  try {
    const client = createCommunicationClient(apiKey);
    // Client automatically converts accountIdentifier → account_identifier
    const { data } = await client.post('/social/verify', { platform, accountIdentifier });

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error(`[API /api/contact/social/verify POST] - Error:`, error);
    return NextResponse.json(
      { detail: getCommunicationErrorDetail(error) },
      { status: getCommunicationErrorStatus(error) }
    );
  }
}
