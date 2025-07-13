import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { updateUserAccountType } from '@/lib/user/account';
import { UpdateAccountTypeRequest } from '@/types/user';
import { syncStripeCustomer } from '@/lib/user/billing/stripe/customer-sync';

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || !user.apiKey) {
    return NextResponse.json({ error: "User not found or missing API key" }, { status: 404 });
  }

  try {
    const requestBody: UpdateAccountTypeRequest = await request.json();
    const data = await updateUserAccountType(user.apiKey, requestBody);

    // Sync Stripe
    syncStripeCustomer({
      user,
      accountType: requestBody.account_type,
      businessInfo: requestBody.business_info ?? null,
    }).catch((e) => console.warn('Failed to sync Stripe after account type change', e));

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating account type:', error);
    return NextResponse.json({ error: 'Error updating account type' }, { status: 500 });
  }
} 