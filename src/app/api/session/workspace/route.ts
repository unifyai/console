import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { workspaceId } = body;

  const cookieStore = await cookies();

  cookieStore.set('unify_workspace_id', workspaceId, {
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });

  return NextResponse.json({ success: true });
}
