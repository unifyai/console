import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { updateBusinessInfo } from '@/lib/user/account';
import { syncStripeCustomer } from '@/lib/user/billing/stripe/customer-sync';
import { UpdateBusinessInfoRequest } from '@/types/user';

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || !user.apiKey) {
    return NextResponse.json({ error: "User not found or missing API key" }, { status: 404 });
  }

  try {
    const requestBody: UpdateBusinessInfoRequest = await request.json();
    
    // 1. Update business info in Orchestra
    const data = await updateBusinessInfo(user.apiKey, requestBody);
    
    // 2. Sync Stripe (convert camelCase to snake_case for Stripe's internal API types)
    const addr = requestBody.businessAddress;
    syncStripeCustomer({
      user,
      accountType: 'business',
      businessInfo: {
        business_name: requestBody.businessName || user.name,
        tax_id: requestBody.taxId ?? undefined,
        business_address: addr ? {
          address_line1: addr.addressLine1,
          address_line2: addr.addressLine2 ?? undefined,
          city: addr.city,
          state: addr.state ?? undefined,
          postal_code: addr.postalCode ?? undefined,
          country: addr.country,
        } : undefined,
        tax_exempt: requestBody.taxExempt,
      },
    }).catch((e) => console.error('Failed to update Stripe customer with business details:', e));
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating business info:', error);
    return NextResponse.json({ error: 'Error updating business info' }, { status: 500 });
  }
} 