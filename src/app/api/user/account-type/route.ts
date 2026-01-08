import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { updateUserAccountType } from '@/lib/user/account';
import { UpdateAccountTypeRequest } from '@/types/user';
import { syncStripeCustomer } from '@/lib/user/billing/stripe/customer-sync';
import { camelToSnakeObject } from '@/utils/casing';

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || !user.apiKey) {
    return NextResponse.json({ error: "User not found or missing API key" }, { status: 404 });
  }

  try {
    const requestBody: UpdateAccountTypeRequest = await request.json();
    const data = await updateUserAccountType(user.apiKey, requestBody);

    // Sync Stripe (convert camelCase to snake_case for Stripe's internal API types)
    const bi = requestBody.businessInfo;
    const stripeBusinessInfo = bi
      ? {
          business_name: bi.businessName,
          tax_id: bi.taxId ?? undefined,
          business_address: bi.businessAddress ? {
            address_line1: bi.businessAddress.addressLine1,
            address_line2: bi.businessAddress.addressLine2 ?? undefined,
            city: bi.businessAddress.city,
            state: bi.businessAddress.state ?? undefined,
            postal_code: bi.businessAddress.postalCode ?? undefined,
            country: bi.businessAddress.country,
          } : undefined,
          tax_exempt: bi.taxExempt,
        }
      : null;
    syncStripeCustomer({
      user,
      accountType: requestBody.accountType,
      businessInfo: stripeBusinessInfo,
    }).catch((e) => console.warn('Failed to sync Stripe after account type change', e));

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating account type:', error);
    return NextResponse.json({ error: 'Error updating account type' }, { status: 500 });
  }
} 