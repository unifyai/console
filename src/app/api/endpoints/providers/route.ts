import { listProviders } from '@/lib/endpoints/endpoints';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';

/**
 * Handles GET requests to retrieve a list of provider names that support a specific model.
 *
 * Extracts the 'model' query parameter from the request URL,
 * and uses it to fetch the supported providers.
 *
 * @param request - The incoming NextRequest object containing the request information.
 * @returns A JSON response containing a list of provider names.
 */
export async function GET(request: NextRequest) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized - no API key' }, { status: 401 });
  }

  const url = new URL(request.url);
  const model = url.searchParams.get('model');
  const providers = await listProviders(apiKey, model!);
  return NextResponse.json(providers);
}
