import { listModels } from '@/lib/endpoints/endpoints';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';

/**
 * Handles GET requests to retrieve a list of model names supported by the given provider.
 *
 * Extracts the 'provider' query parameter from the request URL,
 * and uses it to fetch the supported model names.
 *
 * @param request - The incoming NextRequest object containing the request information.
 * @returns A JSON response containing a list of model names.
 */
export async function GET(request: NextRequest) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized - no API key' }, { status: 401 });
  }

  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');
  const models = await listModels(apiKey, provider!);

  return NextResponse.json(models);
}
