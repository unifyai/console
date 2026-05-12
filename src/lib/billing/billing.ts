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
  AvailablePlanItem,
  AvailablePlansResponse,
  BalanceData,
  BillingMode,
  CurrentPlanSummary,
  AutoRechargeData,
  AutoRechargeUpdatePayload,
  BillingErrorResponse,
  BillingProfileApiResponse,
  BillingProfileData,
  CheckoutSessionResponse,
  PortalSessionResponse,
  CheckoutStatusResponse,
  SupportedTaxCountriesResponse,
  SwitchPlanResponse,
  TaxIdValidationRequest,
  TaxIdValidationResponse,
  InvoiceListResponse,
  InvoiceUrls,
  CurrentPeriodUsage,
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

      // Managed-billing: server returns ``billing_mode`` and a
      // ``plan`` summary. Both are optional in the wire format for
      // back-compat with older orchestra builds — coerce to safe
      // defaults so the rest of the UI never has to special-case
      // ``undefined``.
      const billingMode: BillingMode = data.billingMode === 'METERED' ? 'METERED' : 'CREDITS';
      const planRaw = data.plan ?? null;
      const plan: CurrentPlanSummary | null = planRaw
        ? {
            assignmentId: planRaw.assignmentId ?? null,
            templateId: planRaw.templateId,
            templateName: planRaw.templateName,
            templateDisplayName: planRaw.templateDisplayName ?? planRaw.templateName,
            planType: planRaw.planType,
            billingMode: planRaw.billingMode === 'METERED' ? 'METERED' : 'CREDITS',
            commitAmount: planRaw.commitAmount ?? null,
            currency: planRaw.currency ?? 'USD',
            commitPeriod: planRaw.commitPeriod ?? null,
            commitSchedule: planRaw.commitSchedule ?? null,
            collectionMethod: planRaw.collectionMethod ?? 'AUTO_CARD',
            startedAt: planRaw.startedAt ?? null,
            endedAt: planRaw.endedAt ?? null,
          }
        : null;

      return {
        balance: credits.toFixed(2),
        fullBalance: credits,
        lastRechargeAt: data.lastRechargeAt ?? null,
        accountStatus: data.accountStatus ?? 'ACTIVE',
        billingMode,
        plan,
        planGroupId: typeof data.planGroupId === 'number' ? data.planGroupId : 1,
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

// =============================================================================
// Invoices (managed-billing)
// =============================================================================

/**
 * Lists historical invoices (newest first) for the current billing
 * account. Wraps `GET /v0/billing/invoices`. The orchestra client
 * interceptor handles snake_case → camelCase, so the response is
 * already in the shape `InvoiceListResponse` expects.
 */
export const getInvoices = async (apiKey: string) => {
  return async (params?: {
    limit?: number;
    offset?: number;
  }): Promise<InvoiceListResponse | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      const response = await client.get('/billing/invoices', {
        params: {
          limit: params?.limit ?? 50,
          offset: params?.offset ?? 0,
        },
      });
      return response.data as InvoiceListResponse;
    } catch (error) {
      return errorResponse(error, 'Failed to fetch invoices');
    }
  };
};

/**
 * Resolve Stripe-hosted view + PDF URLs for one invoice. Wraps
 * `GET /v0/billing/invoices/{recharge_id}/urls`. Called on demand
 * from the InvoicesTable rather than pre-fetched, since Stripe URLs
 * are short-lived.
 */
export const getInvoiceUrls = async (apiKey: string) => {
  return async (rechargeId: number): Promise<InvoiceUrls | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      const response = await client.get(`/billing/invoices/${rechargeId}/urls`);
      return response.data as InvoiceUrls;
    } catch (error) {
      return errorResponse(error, 'Failed to fetch invoice URLs');
    }
  };
};

/**
 * Fetch the in-progress monthly invoice estimate for the active
 * METERED plan. Wraps `GET /v0/billing/current-period-usage`. The
 * backend 404s for non-METERED accounts; we surface that as a
 * `BillingErrorResponse` with a stable `detail` so callers can render
 * the credits view instead.
 */
export const getCurrentPeriodUsage = async (apiKey: string) => {
  return async (): Promise<CurrentPeriodUsage | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      const response = await client.get('/billing/current-period-usage');
      return response.data as CurrentPeriodUsage;
    } catch (error) {
      return errorResponse(error, 'Failed to fetch current period usage');
    }
  };
};

// =============================================================================
// Plan switching (self-serve)
// =============================================================================

/**
 * Wraps `GET /v0/billing/available-plans`. The orchestra response is
 * already in the shape `AvailablePlansResponse` expects (axios
 * interceptor handles snake_case → camelCase). `planGroupId` is
 * always set (every account is on at least the platform-default
 * group); the server returns an empty `available` list when there's
 * nothing to switch to (group of one, or current plan not in the
 * group), and callers gate the Switch Plan section on
 * `available.length === 0`.
 */
export const getAvailablePlans = async (apiKey: string) => {
  return async (): Promise<AvailablePlansResponse | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      const response = await client.get('/billing/available-plans');
      const data = response.data;
      // Be defensive about the items list — the interceptor handles
      // case conversion but missing optional fields would still come
      // through as undefined. Normalise so the consumer never has to
      // special-case shape drift.
      const items: AvailablePlanItem[] = (data.available ?? []).map((it: any) => ({
        templateId: it.templateId,
        templateName: it.templateName,
        templateDisplayName: it.templateDisplayName ?? it.templateName,
        billingMode: it.billingMode === 'METERED' ? 'METERED' : 'CREDITS',
        commitAmount: it.commitAmount ?? null,
        currency: it.currency ?? 'USD',
        commitPeriod: it.commitPeriod ?? null,
        commitSchedule: it.commitSchedule ?? null,
        basePricingFactor: typeof it.basePricingFactor === 'number' ? it.basePricingFactor : 1,
        overagePricingFactor:
          typeof it.overagePricingFactor === 'number' ? it.overagePricingFactor : 1,
        position: typeof it.position === 'number' ? it.position : null,
        isCurrent: !!it.isCurrent,
        classification: it.classification ?? 'sidegrade',
        effectiveAt: it.effectiveAt ?? data.nextPeriodStart,
      }));
      return {
        billingAccountId: data.billingAccountId,
        planGroupId: typeof data.planGroupId === 'number' ? data.planGroupId : 1,
        planGroupDisplayName: data.planGroupDisplayName ?? null,
        nextPeriodStart: data.nextPeriodStart,
        available: items,
      };
    } catch (error) {
      return errorResponse(error, 'Failed to fetch available plans');
    }
  };
};

/**
 * Wraps `POST /v0/billing/plan`. The switch is always scheduled at
 * the next AT_BOUNDARY (next-month start UTC) — there is no
 * `effectiveAt` parameter on the wire format because we want the rule
 * to be a server-enforced invariant, not a client preference. The
 * `changeReason` is optional and recorded on the new assignment row
 * for audit clarity.
 */
export const switchPlan = async (apiKey: string) => {
  return async (
    templateId: number,
    changeReason?: string
  ): Promise<SwitchPlanResponse | BillingErrorResponse> => {
    'use server';
    try {
      const client = await getOrchestraUserClient(apiKey);
      const response = await client.post('/billing/plan', {
        templateId,
        changeReason: changeReason ?? null,
      });
      const data = response.data;
      return {
        status: data.status === 'noop' ? 'noop' : 'scheduled',
        billingAccountId: data.billingAccountId,
        templateId: data.templateId,
        effectiveAt: data.effectiveAt ?? null,
        classification: data.classification ?? 'sidegrade',
      };
    } catch (error) {
      return errorResponse(error, 'Failed to switch plan');
    }
  };
};
