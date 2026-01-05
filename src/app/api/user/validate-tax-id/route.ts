import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { validateTaxId } from '@/lib/user/tax';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || !user.api_key) {
    return NextResponse.json({ error: 'User not found or missing API key' }, { status: 404 });
  }

  try {
    const requestBody = await request.json();
    const data = await validateTaxId(user.api_key, requestBody);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error validating tax ID:', error);
    return NextResponse.json({ error: 'Failed to validate tax ID' }, { status: 500 });
  }
} 