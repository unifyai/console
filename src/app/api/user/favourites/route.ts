import { NextRequest, NextResponse } from 'next/server';
import { getFavourites } from '@/lib/interfaces/favourites';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';

export async function GET(req: NextRequest) {
  try {
    const apiKey = await getApiKeyFromRequest(req);

    if (!apiKey) {
      return unauthorized();
    }

    const favourites = await getFavourites(apiKey);
    return NextResponse.json(favourites, { status: 200 });
  } catch (err) {
    console.error('/api/user/favourites error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
