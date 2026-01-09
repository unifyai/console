import { NextRequest, NextResponse } from 'next/server';
import { processPhoneCountryCodes } from '@/utils/assistants/country-utils';
import { getCurrentUser } from '@/lib/user/user';
import { snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.COMMUNICATION_URL}`;

export async function GET(request: NextRequest) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }
  try {
    const response = await fetch(`${baseUrl}/phone/available-countries`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const responseText = await response.text();
    let responseData;

    if (response.ok && responseText) {
      try {
        responseData = JSON.parse(responseText);
      } catch (e: any) {
        console.error(
          `[API /api/contact/phone/available-countries GET] - JSON parsing error:`,
          e.message
        );
        return NextResponse.json(
          { error: 'Invalid JSON response from backend', raw: responseText },
          { status: 502 }
        );
      }

      // Validate and transform backend data
      const camelCaseData = snakeToCamelObject(responseData) as Record<string, unknown>;
      const codes = camelCaseData?.countries as string;
      const processed = processPhoneCountryCodes(codes);
      return NextResponse.json({ success: true, countries: processed }, { status: 200 });
    } else if (!response.ok) {
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { detail: responseText || 'Unknown error from backend API' };
      }
      console.error(
        `[API /api/contact/phone/available-countries GET] - Backend error (${response.status}):`,
        responseData
      );
      return NextResponse.json(responseData, { status: response.status });
    } else {
      return NextResponse.json({ success: true, countries: [] }, { status: 200 });
    }
  } catch (error: any) {
    console.error(
      `[API /api/contact/phone/available-countries GET] - Fetch error:`,
      error.message,
      error.stack
    );
    return NextResponse.json(
      { error: 'Failed to connect to backend API', details: error.message },
      { status: 500 }
    );
  }
}
