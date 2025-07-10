import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { updateBusinessInfo } from '@/lib/user/account';
import { UpdateBusinessInfoRequest } from '@/types/user';

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || !user.apiKey) {
    return NextResponse.json({ error: "User not found or missing API key" }, { status: 404 });
  }

  try {
    const requestBody: UpdateBusinessInfoRequest = await request.json();
    const data = await updateBusinessInfo(user.apiKey, requestBody);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating business info:', error);
    return NextResponse.json({ error: 'Error updating business info' }, { status: 500 });
  }
} 