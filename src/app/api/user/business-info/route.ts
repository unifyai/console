import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { updateBusinessInfo } from '@/lib/user/account';
import { UpdateBusinessInfoRequest } from '@/types/user';

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || (await getApiKeyFromRequest(request));

  if (!apiKey) {
    return unauthorized();
  }

  try {
    const requestBody: UpdateBusinessInfoRequest = await request.json();

    const data = await updateBusinessInfo(apiKey, requestBody);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating business info:', error);
    return NextResponse.json({ error: 'Error updating business info' }, { status: 500 });
  }
}
