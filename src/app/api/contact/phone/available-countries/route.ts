import { NextRequest, NextResponse } from 'next/server';
import { processPhoneCountryCodes } from '@/utils/assistants/country-utils';
import { getApiKeyFromRequest, unauthorized } from '../../../_utils/auth';
import {
  createCommunicationClient,
  getCommunicationErrorDetail,
  getCommunicationErrorStatus,
} from '@/lib/communication/client';

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const client = createCommunicationClient(apiKey);
    const { data } = await client.get('/phone/available-countries');

    // Validate and transform backend data (response already converted to camelCase by client)
    const codes = (data?.countries as string | undefined) ?? '';
    const processed = processPhoneCountryCodes(codes);
    return NextResponse.json({ success: true, countries: processed }, { status: 200 });
  } catch (error) {
    console.error(`[API /api/contact/phone/available-countries GET] - Error:`, error);
    return NextResponse.json(
      { detail: getCommunicationErrorDetail(error) },
      { status: getCommunicationErrorStatus(error) }
    );
  }
}
