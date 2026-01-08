import { listEndpoints } from '@/lib/endpoints/endpoints';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';

/**
 * Handles GET requests to retrieve a list of endpoint names supported by a specific provider and model.
 *
 * Extracts the 'provider' and 'model' query parameters from the request URL,
 * and uses them to fetch the supported endpoints.
 *
 * @param request - The incoming NextRequest object containing the request information.
 * @returns A JSON response containing a list of endpoint names.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const provider = request.nextUrl.searchParams.get('provider') ?? '';
  const model = request.nextUrl.searchParams.get('model') ?? '';

  const endpoints = await listEndpoints(user.apiKey, provider, model);

  return NextResponse.json(endpoints);
}
