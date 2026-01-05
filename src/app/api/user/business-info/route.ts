import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { updateBusinessInfo } from '@/lib/user/account';
import { syncStripeCustomer } from '@/lib/user/billing/stripe/customer-sync';
import { UpdateBusinessInfoRequest } from '@/types/user';

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || !user.api_key) {
    return NextResponse.json({ error: "User not found or missing API key" }, { status: 404 });
  }

  try {
    const requestBody: UpdateBusinessInfoRequest = await request.json();
    
    // 1. Update business info in Orchestra
    const data = await updateBusinessInfo(user.api_key, requestBody);
    
    // 2. Sync Stripe
    syncStripeCustomer({
      user,
      accountType: 'business',
      businessInfo: {
        business_name: requestBody.business_name || user.name,
        tax_id: requestBody.tax_id,
        business_address: requestBody.business_address ?? undefined,
        tax_exempt: requestBody.tax_exempt,
      },
    }).catch((e) => console.error('Failed to update Stripe customer with business details:', e));
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating business info:', error);
    return NextResponse.json({ error: 'Error updating business info' }, { status: 500 });
  }
} 