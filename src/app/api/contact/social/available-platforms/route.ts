import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import {
  createCommunicationClient,
  getCommunicationErrorDetail,
  getCommunicationErrorStatus,
} from '@/lib/communication/client';

export async function GET(request: NextRequest) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  try {
    const client = createCommunicationClient(apiKey);
    const { data } = await client.get('/social/available-platforms');

    if (data?.success && typeof data.platforms === 'object' && data.platforms !== null) {
      const platformsData = data.platforms as Record<string, number>;
      const platforms = Object.entries(platformsData).map(([name, cost]) => ({ name, cost }));
      return NextResponse.json({ success: true, platforms }, { status: 200 });
    }

    console.error(
      `[API /api/contact/social/available-platforms GET] - Invalid response format:`,
      data
    );
    return NextResponse.json(
      { detail: 'Invalid response format from social platforms API' },
      { status: 502 }
    );
  } catch (error) {
    console.error(`[API /api/contact/social/available-platforms GET] - Error:`, error);
    return NextResponse.json(
      { detail: getCommunicationErrorDetail(error) },
      { status: getCommunicationErrorStatus(error) }
    );
  }
}
