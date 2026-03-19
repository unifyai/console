/**
 * Billing server actions.
 *
 * Each exported function is an async factory that captures the API key
 * (or admin key) and returns a bound server action.  The page.tsx server
 * component calls the factories at render time and passes the resulting
 * actions down to the client via props.
 *
 * Pattern mirrors:
 *   @/lib/user/organization.ts
 *   @/lib/assistants/assistant.ts
 */

import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';
import type {
  BalanceData,
  AutoRechargeData,
  AutoRechargeUpdatePayload,
  BillingErrorResponse,
  BillingProfileApiResponse,
  BillingProfileData,
  CheckoutSessionResponse,
  PortalSessionResponse,
  CheckoutStatusResponse,
  SupportedTaxCountriesResponse,
  TaxIdValidationRequest,
  TaxIdValidationResponse,
} from '@/types/billing';

// =============================================================================
// Helpers
// =============================================================================

function errorResponse(error: unknown, fallback: string): BillingErrorResponse {
  const err = error as any;
  const detail =
    err?.response?.data?.detail ??
    err?.response?.data?.error ??
    (err instanceof Error ? err.message : fallback);
  return { detail };
}

// =============================================================================
// Balance
// =============================================================================

export const getBalance = async (apiKey: string) => {
  return async (): Promise<BalanceData | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      const response = await client.get('/billing/account-info');
      const data = response.data;

      const credits = typeof data.credits === 'number' ? data.credits : 0;

      return {
        balance: credits.toFixed(2),
        fullBalance: credits,
        lastRechargeAt: data.lastRechargeAt ?? null,
        accountStatus: data.accountStatus ?? 'ACTIVE',
      };
    } catch (error) {
      return errorResponse(error, 'Failed to fetch balance');
    }
  };
};

// =============================================================================
// Auto-Recharge
// =============================================================================

export const getAutoRecharge = async (apiKey: string) => {
  return async (): Promise<AutoRechargeData | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      const response = await client.get('/billing/auto-recharge');
      const data = response.data;

      return {
        autoRechargeEnabled: data.enabled,
        autoRechargeThreshold: data.threshold,
        autoRechargeQty: data.qty,
        minRechargeAmount: data.minRechargeAmount,
        totalSpending: data.totalSpending,
        canEnableAutoRecharge: data.eligible,
        minimumSpendRequired: data.minimumSpendRequired,
        remainingSpendNeeded: data.remainingSpendNeeded,
        hasPaymentMethod: data.hasPaymentMethod ?? false,
        blockedReason: data.blockedReason ?? null,
      };
    } catch (error) {
      return errorResponse(error, 'Failed to fetch auto-recharge data');
    }
  };
};

export const updateAutoRecharge = async (apiKey: string) => {
  return async (payload: AutoRechargeUpdatePayload): Promise<void | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      await client.put('/billing/auto-recharge', {
        enabled: payload.enabled,
        threshold: payload.threshold,
        qty: payload.qty,
      });
    } catch (error) {
      return errorResponse(error, 'Failed to update auto-recharge settings');
    }
  };
};

export const toggleAutoRecharge = async (apiKey: string) => {
  return async (enabled: boolean): Promise<void | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      await client.put('/billing/auto-recharge', { enabled });
    } catch (error) {
      return errorResponse(error, 'Failed to toggle auto-recharge');
    }
  };
};

// =============================================================================
// Billing Profile
// =============================================================================

export const getProfile = async (apiKey: string) => {
  return async (): Promise<BillingProfileApiResponse | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      const response = await client.get('/billing/billing-profile');
      return response.data as BillingProfileApiResponse;
    } catch (error) {
      return errorResponse(error, 'Failed to fetch billing profile');
    }
  };
};

export const updateProfile = async (apiKey: string) => {
  return async (
    data: BillingProfileData
  ): Promise<BillingProfileApiResponse | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      // Build payload — the axios interceptor handles camelCase → snake_case.
      // Only include fields that have actual values (strip empty strings).
      const payload: Record<string, unknown> = {};
      if (data.name) payload.name = data.name;
      if (data.billingEmail) payload.billingEmail = data.billingEmail;
      if (data.taxId) payload.taxId = data.taxId;
      if (data.taxIdType) payload.taxIdType = data.taxIdType;
      if (data.billingAddress?.line1) {
        payload.billingAddress = {
          line1: data.billingAddress.line1,
          line2: data.billingAddress.line2 || undefined,
          city: data.billingAddress.city || undefined,
          state: data.billingAddress.state || undefined,
          country: data.billingAddress.country || undefined,
          postalCode: data.billingAddress.postalCode || undefined,
        };
      }
      const response = await client.patch('/billing/billing-profile', payload);
      return response.data as BillingProfileApiResponse;
    } catch (error) {
      return errorResponse(error, 'Failed to update billing profile');
    }
  };
};

// =============================================================================
// Stripe Sessions
// =============================================================================

export const createCheckoutSession = async (apiKey: string) => {
  return async (): Promise<CheckoutSessionResponse | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      const response = await client.post('/billing/checkout-session');
      return response.data as CheckoutSessionResponse;
    } catch (error) {
      return errorResponse(error, 'Failed to create checkout session');
    }
  };
};

export const createPortalSession = async (apiKey: string) => {
  return async (): Promise<PortalSessionResponse | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      const response = await client.post('/billing/portal-session');
      return response.data as PortalSessionResponse;
    } catch (error) {
      return errorResponse(error, 'Failed to create portal session');
    }
  };
};

export const getCheckoutStatus = async (apiKey: string) => {
  return async (sessionId: string): Promise<CheckoutStatusResponse | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      const response = await client.get('/billing/checkout-status', {
        params: { sessionId },
      });
      return response.data as CheckoutStatusResponse;
    } catch (error) {
      return errorResponse(error, 'Failed to get checkout status');
    }
  };
};

// =============================================================================
// Tax Countries & Validation
// =============================================================================

export const getSupportedTaxCountries = async (apiKey: string) => {
  return async (): Promise<SupportedTaxCountriesResponse | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      const response = await client.get('/billing/supported-tax-countries');
      return response.data as SupportedTaxCountriesResponse;
    } catch (error) {
      return errorResponse(error, 'Failed to fetch supported tax countries');
    }
  };
};

export const validateTaxId = async (apiKey: string) => {
  return async (
    request: TaxIdValidationRequest
  ): Promise<TaxIdValidationResponse | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      const response = await client.post('/billing/validate-tax-id', {
        country: request.country,
        taxId: request.taxId,
      });
      const data = response.data as any;
      return {
        valid: data.valid ?? data.isValid ?? false,
        errorMessage: data.errorMessage || data.error || undefined,
      };
    } catch (error) {
      return errorResponse(error, 'Failed to validate tax ID');
    }
  };
};


