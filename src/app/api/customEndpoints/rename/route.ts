import { NextRequest, NextResponse } from 'next/server';
import { transformQueryParams } from '../../_utils/casingTransform';
import { getCurrentUser } from '@/lib/user/user';
import { snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  const url = new URL(request.url);
  const snakeQuery = transformQueryParams(url);

  const res = await fetch(`${baseUrl}/custom_endpoint/rename${snakeQuery}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  // Parse and transform response from snake_case to camelCase
  const text = await res.text();
  if (!text) {
    return NextResponse.json({ success: true }, { status: res.status });
  }
  const responseData = JSON.parse(text);
  const camelCaseData = snakeToCamelObject(responseData);

  return NextResponse.json(camelCaseData, { status: res.status });
}
