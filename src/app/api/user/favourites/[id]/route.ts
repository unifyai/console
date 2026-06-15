import { NextRequest, NextResponse } from 'next/server';
import { updateFavourite, deleteFavourite } from '@/lib/interfaces/favourites';
import { getApiKeyFromRequest, unauthorized } from '../../../_utils/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const apiKey = await getApiKeyFromRequest(req);

    if (!apiKey) {
      return unauthorized();
    }

    const body = await req.json();
    const updateFav = await updateFavourite(apiKey);
    const updated = await updateFav(Number(id), body);
    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error('/api/user/favourites/[id] PATCH error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const apiKey = await getApiKeyFromRequest(req);

    if (!apiKey) {
      return unauthorized();
    }

    const deleteFav = await deleteFavourite(apiKey);
    const success = await deleteFav(Number(id));
    return NextResponse.json({ success }, { status: success ? 200 : 500 });
  } catch (err) {
    console.error('/api/user/favourites/[id] DELETE error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
