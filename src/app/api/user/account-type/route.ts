import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { updateUserAccountType } from '@/lib/user/account';
import { UpdateAccountTypeRequest } from '@/types/user';

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || (await getApiKeyFromRequest(request));

  if (!apiKey) {
    return unauthorized();
  }

  try {
    const requestBody: UpdateAccountTypeRequest = await request.json();
    const data = await updateUserAccountType(apiKey, requestBody);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating account type:', error);
    return NextResponse.json({ error: 'Error updating account type' }, { status: 500 });
  }
}
