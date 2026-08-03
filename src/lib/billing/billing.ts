'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
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
  AutoIncrementData,
  AutoIncrementUpdatePayload,
  CancelSubscriptionResponse,
  BillingErrorResponse,
  BillingProfileApiResponse,
  BillingProfileData,
  PortalSessionResponse,
  PaymentMethodListResponse,
  SetupIntentResponse,
  SubscribeResponse,
  SupportedTaxCountriesResponse,
  SwitchPlanResponse,
  TaxIdValidationRequest,
  TaxIdValidationResponse,
  InvoiceListResponse,
  InvoiceUrls,
  CurrentPeriodUsage,
  TopUpResponse,
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

export async function getBalance(): Promise<BalanceData | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
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
      isSubscribed: !!data.isSubscribed,
      trialExpiresAt: data.trialExpiresAt ?? null,
      nextRenewalAt: data.nextRenewalAt ?? null,
      cancelAtPeriodEnd: !!data.subscriptionCancelAtPeriodEnd,
    };
  } catch (error) {
    return errorResponse(error, 'Failed to fetch balance');
  }
}

// =============================================================================
// Manual top-up (staging manual-top-up mode)
// =============================================================================

/**
 * Wraps `POST /v0/credits/topup`. Grants free credits with no Stripe charge.
 * Only succeeds on manual-top-up deployments (staging); production returns 403.
 */
export async function topUp(amount: number): Promise<TopUpResponse | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.post('/credits/topup', { amount });
    const data = response.data;
    return {
      previousCredits: typeof data.previousCredits === 'number' ? data.previousCredits : 0,
      added: typeof data.added === 'number' ? data.added : 0,
      currentCredits: typeof data.currentCredits === 'number' ? data.currentCredits : 0,
    };
  } catch (error) {
    return errorResponse(error, 'Failed to top up credits');
  }
}

// =============================================================================
// Subscribe (self-serve first subscription)
// =============================================================================

/**
 * Wraps `POST /v0/billing/subscribe`. Subscribes the account to the
 * monthly credit tier identified by `templateId`. When the response
 * carries a `hostedInvoiceUrl` the customer must complete the first
 * payment there (the console has no Stripe.js).
 */
export async function subscribe(
  templateId: number
): Promise<SubscribeResponse | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.post('/billing/subscribe', { templateId });
    const data = response.data;
    return {
      status: data.status,
      billingAccountId: data.billingAccountId,
      templateId: data.templateId,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      subscriptionStatus: data.subscriptionStatus,
      clientSecret: data.clientSecret ?? null,
      hostedInvoiceUrl: data.hostedInvoiceUrl ?? null,
    };
  } catch (error) {
    return errorResponse(error, 'Failed to subscribe');
  }
}
// =============================================================================
// Cancel subscription
// =============================================================================

/**
 * Wraps `DELETE /v0/billing/subscription`. Cancels the active self-serve
 * subscription — at period end by default, or immediately when `immediate`
 * is set. The local plan reverts to free once Stripe emits the deletion
 * webhook.
 */
export async function cancelSubscription(
  immediate = false
): Promise<CancelSubscriptionResponse | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.delete('/billing/subscription', {
      params: { immediate },
    });
    const data = response.data;
    return {
      status: data.status,
      billingAccountId: data.billingAccountId,
      effectiveAt: data.effectiveAt ?? null,
    };
  } catch (error) {
    return errorResponse(error, 'Failed to cancel subscription');
  }
}
/**
 * Wraps `POST /v0/billing/subscription/reactivate`. Undoes a scheduled
 * end-of-period cancellation so the subscription renews normally. Only
 * valid while the subscription is still flagged to cancel at period end.
 */
export async function reactivateSubscription(): Promise<
  CancelSubscriptionResponse | BillingErrorResponse
> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.post('/billing/subscription/reactivate');
    const data = response.data;
    return {
      status: data.status,
      billingAccountId: data.billingAccountId,
      effectiveAt: data.effectiveAt ?? null,
    };
  } catch (error) {
    return errorResponse(error, 'Failed to resume subscription');
  }
}
// =============================================================================
// Auto-Increment (replaces Auto-Recharge for self-serve)
// =============================================================================

function mapAutoIncrement(data: any): AutoIncrementData {
  return {
    enabled: !!data.enabled,
    isSubscribed: !!data.isSubscribed,
    atTopTier: !!data.atTopTier,
  };
}

export async function getAutoIncrement(): Promise<AutoIncrementData | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.get('/billing/auto-increment');
    return mapAutoIncrement(response.data);
  } catch (error) {
    return errorResponse(error, 'Failed to fetch auto-increment settings');
  }
}
export async function updateAutoIncrement(
  payload: AutoIncrementUpdatePayload
): Promise<AutoIncrementData | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.put('/billing/auto-increment', {
      enabled: payload.enabled,
    });
    return mapAutoIncrement(response.data);
  } catch (error) {
    return errorResponse(error, 'Failed to update auto-increment settings');
  }
}
// =============================================================================
// Billing Profile
// =============================================================================

export async function getProfile(): Promise<BillingProfileApiResponse | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.get('/billing/billing-profile');
    return response.data as BillingProfileApiResponse;
  } catch (error) {
    return errorResponse(error, 'Failed to fetch billing profile');
  }
}
export async function updateProfile(
  data: BillingProfileData
): Promise<BillingProfileApiResponse | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
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
}
// =============================================================================
// Stripe Sessions
// =============================================================================

export async function createPortalSession(): Promise<PortalSessionResponse | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.post('/billing/portal-session');
    return response.data as PortalSessionResponse;
  } catch (error) {
    return errorResponse(error, 'Failed to create portal session');
  }
}
// =============================================================================
// Payment methods (in-app card management)
// =============================================================================

/**
 * Create a Stripe SetupIntent so the browser can confirm a new card via
 * Elements. The orchestra client interceptor camelCases the response, so
 * `client_secret` arrives as `clientSecret`.
 */
export async function createSetupIntent(): Promise<SetupIntentResponse | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.post('/billing/payment-methods/setup-intent');
    return response.data as SetupIntentResponse;
  } catch (error) {
    return errorResponse(error, 'Failed to start adding a card');
  }
}
/** List the customer's saved cards (newest first). */
export async function listPaymentMethods(): Promise<
  PaymentMethodListResponse | BillingErrorResponse
> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.get('/billing/payment-methods');
    return response.data as PaymentMethodListResponse;
  } catch (error) {
    return errorResponse(error, 'Failed to load payment methods');
  }
}
/** Make a saved card the renewal default; returns the refreshed list. */
export async function setDefaultPaymentMethod(
  paymentMethodId: string
): Promise<PaymentMethodListResponse | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.post(
      `/billing/payment-methods/${encodeURIComponent(paymentMethodId)}/default`
    );
    return response.data as PaymentMethodListResponse;
  } catch (error) {
    return errorResponse(error, 'Failed to set default card');
  }
}
/** Remove a saved card; returns the refreshed list. */
export async function detachPaymentMethod(
  paymentMethodId: string
): Promise<PaymentMethodListResponse | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.delete(
      `/billing/payment-methods/${encodeURIComponent(paymentMethodId)}`
    );
    return response.data as PaymentMethodListResponse;
  } catch (error) {
    return errorResponse(error, 'Failed to remove card');
  }
}
// =============================================================================
// Tax Countries & Validation
// =============================================================================

export async function getSupportedTaxCountries(): Promise<
  SupportedTaxCountriesResponse | BillingErrorResponse
> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.get('/billing/supported-tax-countries');
    return response.data as SupportedTaxCountriesResponse;
  } catch (error) {
    return errorResponse(error, 'Failed to fetch supported tax countries');
  }
}
export async function validateTaxId(
  request: TaxIdValidationRequest
): Promise<TaxIdValidationResponse | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
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
}
// =============================================================================
// Invoices (managed-billing)
// =============================================================================

/**
 * Lists historical invoices (newest first) for the current billing
 * account. Wraps `GET /v0/billing/invoices`. The orchestra client
 * interceptor handles snake_case → camelCase, so the response is
 * already in the shape `InvoiceListResponse` expects.
 */
export async function getInvoices(params?: {
  limit?: number;
  offset?: number;
}): Promise<InvoiceListResponse | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
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
}
/**
 * Resolve Stripe-hosted view + PDF URLs for one invoice. Wraps
 * `GET /v0/billing/invoices/{recharge_id}/urls`. Called on demand
 * from the InvoicesTable rather than pre-fetched, since Stripe URLs
 * are short-lived.
 */
export async function getInvoiceUrls(
  rechargeId: number
): Promise<InvoiceUrls | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.get(`/billing/invoices/${rechargeId}/urls`);
    return response.data as InvoiceUrls;
  } catch (error) {
    return errorResponse(error, 'Failed to fetch invoice URLs');
  }
}
/**
 * Fetch the in-progress monthly invoice estimate for the active
 * METERED plan. Wraps `GET /v0/billing/current-period-usage`. The
 * backend 404s for non-METERED accounts; we surface that as a
 * `BillingErrorResponse` with a stable `detail` so callers can render
 * the credits view instead.
 */
export async function getCurrentPeriodUsage(): Promise<CurrentPeriodUsage | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.get('/billing/current-period-usage');
    return response.data as CurrentPeriodUsage;
  } catch (error) {
    return errorResponse(error, 'Failed to fetch current period usage');
  }
}
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
export async function getAvailablePlans(): Promise<AvailablePlansResponse | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
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
}
/**
 * Wraps `POST /v0/billing/plan`. For subscription tiers the change is
 * applied immediately (anniversary-anchored, Stripe-prorated) and the
 * response `status` is "switched"; "scheduled" survives for legacy /
 * metered paths and "noop" when the target equals the current tier.
 * The `changeReason` is optional and recorded on the new assignment row
 * for audit clarity.
 */
export async function switchPlan(
  templateId: number,
  changeReason?: string
): Promise<SwitchPlanResponse | BillingErrorResponse> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.post('/billing/plan', {
      templateId,
      changeReason: changeReason ?? null,
    });
    const data = response.data;
    const status: SwitchPlanResponse['status'] =
      data.status === 'noop' ? 'noop' : data.status === 'scheduled' ? 'scheduled' : 'switched';
    return {
      status,
      billingAccountId: data.billingAccountId,
      templateId: data.templateId,
      effectiveAt: data.effectiveAt ?? null,
      classification: data.classification ?? 'sidegrade',
    };
  } catch (error) {
    return errorResponse(error, 'Failed to switch plan');
  }
}

// =============================================================================
// Card-gated trial onboarding
// =============================================================================

/**
 * Wraps `POST /v0/billing/trial-checkout`. Creates the Stripe-hosted
 * Checkout Session that collects a card + billing address and
 * auto-enrolls the account on the trial tier subscription (first charge
 * at trial end unless cancelled). The caller redirects to `checkoutUrl`.
 */
export async function startTrialCheckout(): Promise<
  { checkoutUrl: string } | BillingErrorResponse
> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.post('/billing/trial-checkout', {});
    return { checkoutUrl: response.data.checkoutUrl };
  } catch (error) {
    return errorResponse(error, 'Failed to start trial checkout');
  }
}

/**
 * Wraps `GET /v0/billing/access-gate`. Whether the workspace may use
 * metered platform features; `reason === 'card_required'` means the
 * card-gated trial checkout must be completed first.
 */
export async function getAccessGate(): Promise<
  | {
      allowed: boolean;
      reason: string | null;
      trialEndAt: string | null;
      subscriptionActive: boolean;
      apiAccessAllowed: boolean;
    }
  | BillingErrorResponse
> {
  const apiKey = await requireUserApiKey();
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.get('/billing/access-gate');
    const data = response.data;
    return {
      allowed: !!data.allowed,
      reason: data.reason ?? null,
      // Orchestra serialises this response in snake_case (no alias
      // generator on AccessGateResponse), so the camelCase reads these
      // two used before silently resolved to undefined.
      trialEndAt: data.trial_end_at ?? null,
      subscriptionActive: !!data.subscription_active,
      // Defaults true so an older Orchestra build, which omits the
      // field, never makes the Console claim the API is locked.
      apiAccessAllowed: data.api_access_allowed ?? true,
    };
  } catch (error) {
    return errorResponse(error, 'Failed to fetch access gate');
  }
}
