import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getOnboardingStatus, updateOnboardingStatus } from '@/lib/user/account';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const status = await getOnboardingStatus(user.apiKey);
    return NextResponse.json(status);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await updateOnboardingStatus(user.apiKey, body);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
