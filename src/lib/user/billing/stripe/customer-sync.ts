import { ensureStripeCustomer } from '@/lib/user/billing/stripe/stripe';
import { mapCountryToTaxIdType, toIsoCountryCode } from '@/utils/stripe/taxIdTypes';

interface BusinessAddress {
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state?: string | null;
  postal_code?: string | null;
  country: string; // ISO-2 or full country name
}

interface BusinessInfo {
  business_name: string;
  tax_id?: string | null;
  business_address?: BusinessAddress;
  tax_exempt?: boolean;
}

interface SyncParams {
  user: { id: string; email: string; name: string };
  accountType: 'individual' | 'business';
  businessInfo?: BusinessInfo | null;
}

/**
 * Syncs a Stripe customer to match the latest account type / business info.
 * – For personal accounts we clear any stored tax info & use the user’s name.
 * – For business accounts we store business name, address and tax ID.
 */
export async function syncStripeCustomer({ user, accountType, businessInfo }: SyncParams) {
  if (accountType === 'individual') {
    await ensureStripeCustomer({
      userId: user.id,
      email: user.email,
      name: user.name,
      clearTaxInfo: true,
    });
    return;
  }

  if (!businessInfo) return; // nothing to sync

  const countryCode = toIsoCountryCode(businessInfo.business_address?.country);

  await ensureStripeCustomer({
    userId: user.id,
    email: user.email,
    name: businessInfo.business_name,
    address: businessInfo.business_address
      ? {
          line1: businessInfo.business_address.address_line1,
          line2: businessInfo.business_address.address_line2 || undefined,
          city: businessInfo.business_address.city,
          state: businessInfo.business_address.state || undefined,
          postal_code: businessInfo.business_address.postal_code || undefined,
          country: countryCode,
        }
      : undefined,
    taxId: businessInfo.tax_id || undefined,
    taxIdType: mapCountryToTaxIdType(countryCode),
    taxExempt: businessInfo.tax_exempt || undefined,
  });
}
