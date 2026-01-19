import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { updateBusinessInfo } from '@/lib/user/account';
import { syncStripeCustomer } from '@/lib/user/billing/stripe/customer-sync';
import { UpdateBusinessInfoRequest } from '@/types/user';

export async function PATCH(request: NextRequest) {
  // Need full user object for Stripe sync
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || (await getApiKeyFromRequest(request));

  if (!apiKey) {
    return unauthorized();
  }

  try {
    const requestBody: UpdateBusinessInfoRequest = await request.json();

    // 1. Update business info in Orchestra
    const data = await updateBusinessInfo(apiKey, requestBody);

    // 2. Sync Stripe (only if we have full user object)
    if (user) {
      const addr = requestBody.businessAddress;
      syncStripeCustomer({
        user,
        accountType: 'business',
        businessInfo: {
          business_name: requestBody.businessName || user.name,
          tax_id: requestBody.taxId ?? undefined,
          business_address: addr
            ? {
                address_line1: addr.addressLine1,
                address_line2: addr.addressLine2 ?? undefined,
                city: addr.city,
                state: addr.state ?? undefined,
                postal_code: addr.postalCode ?? undefined,
                country: addr.country,
              }
            : undefined,
          tax_exempt: requestBody.taxExempt,
        },
      }).catch((e) => console.error('Failed to update Stripe customer with business details:', e));
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating business info:', error);
    return NextResponse.json({ error: 'Error updating business info' }, { status: 500 });
  }
}
