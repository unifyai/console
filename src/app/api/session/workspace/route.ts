import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/user/user';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { workspaceId } = body;

  if (workspaceId === 'personal') {
    const user = await getCurrentUser();
    if (user?.personalWorkspaceDisabled) {
      return NextResponse.json(
        { error: 'Personal workspace is disabled for organization members.' },
        { status: 403 }
      );
    }
  }

  const cookieStore = await cookies();

  cookieStore.set('unify_workspace_id', workspaceId, {
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });

  return NextResponse.json({ success: true });
}
