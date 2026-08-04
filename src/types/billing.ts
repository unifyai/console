/**
 * Billing types used across the billing page.
 *
 * Follows the same pattern as @/types/organization.ts and
 * @/types/assistants/assistant.ts.
 */

// =============================================================================
// Error response (concrete type so type-guards can narrow unions properly)
// =============================================================================

/**
 * Concrete error shape returned by billing server actions.
 *
 * Unlike the generic `ResponseProps` (which carries an index signature and
 * therefore swallows all object types in a union), this interface has an
 * explicit `detail` field.  That lets `isBillingError` act as a proper
 * discriminating type-guard — the negative branch correctly narrows to the
 * success type instead of collapsing to `never`.
 */
export interface BillingErrorResponse {
  detail: string;
}

// =============================================================================
// Balance
// =============================================================================

/** Discriminator for the active billing model. */
export type BillingMode = 'CREDITS' | 'METERED';

/**
 * Compact summary of the active billing plan, surfaced inside `BalanceData`.
 *
 * Mirrors orchestra's `CurrentPlanSummary` schema. Always populated by
 * the server — every account has an active assignment from signup
 * (the default plan) so the UI can render uniformly.
 *
 * `planType` is *derived* server-side from `commitAmount` (positive =
 * COMMITMENT, NULL/zero = PAY_AS_YOU_GO) so client code can switch
 * on it directly without re-deriving the rule.
 */
export interface CurrentPlanSummary {
  /** Assignment id of the currently-active plan row. Always populated. */
  assignmentId: number;
  templateId: number;
  templateName: string;
  /** Customer-facing label, falls back to `templateName` server-side. */
  templateDisplayName?: string;
  /** Derived: PAY_AS_YOU_GO | COMMITMENT */
  planType: string;
  billingMode: BillingMode;
  commitAmount: number | null;
  /** Invoice currency for the whole template (USD/GBP/...). */
  currency: string;
  /** MONTHLY | QUARTERLY | ANNUAL | null */
  commitPeriod: string | null;
  /**
   * When/how the customer is invoiced for the commit fee:
   * MONTHLY | QUARTERLY | ANNUAL | UPFRONT | null (PAYG plans).
   */
  commitSchedule: string | null;
  /** AUTO_CARD | SEND_INVOICE */
  collectionMethod: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface BalanceData {
  /** Formatted string balance (e.g. "25.00") */
  balance: string;
  /** Raw numeric balance — remaining credits in the current cycle */
  fullBalance: number;
  /** ISO-8601 timestamp of last paid recharge, or null */
  lastRechargeAt: string | null;
  /** Account status: ACTIVE, PAST_DUE, SUSPENDED, or CLOSED */
  accountStatus: string;
  /**
   * Active billing model. Frontend gates on this — METERED accounts
   * hide the self-serve credits/subscription UI and show a plan +
   * invoices view instead.
   */
  billingMode: BillingMode;
  /** Active plan summary, always populated (default for pristine accounts) */
  plan: CurrentPlanSummary | null;
  /**
   * Self-serve plan catalog id. Always set — every account is on at
   * least the platform-default group (NOT NULL by schema invariant).
   */
  planGroupId: number;
  /**
   * Whether the self-serve account holds an active paid subscription
   * to a monthly credit tier. ``false`` for free/trial accounts that
   * have never subscribed. Drives the subscribed vs. unsubscribed
   * split of the CREDITS billing view.
   */
  isSubscribed: boolean;
  // The monthly credit allowance is NOT a separate field: it is exactly
  // `plan.commitAmount` (1 credit = $1), so read it off `plan` above.
  /**
   * ISO-8601 timestamp at which free signup/trial credits expire (one
   * week after signup). ``null`` once the account is subscribed (paid
   * tiers reset monthly rather than expiring).
   */
  trialExpiresAt: string | null;
  /**
   * ISO-8601 timestamp of the next subscription renewal (the start of
   * the next credit cycle). ``null`` for unsubscribed accounts.
   */
  nextRenewalAt: string | null;
  /**
   * Whether the active subscription is scheduled to cancel at the end of
   * the current period. When ``true`` the UI shows a persistent "cancels
   * on {nextRenewalAt}" indicator instead of "renews on". ``false`` for
   * unsubscribed accounts.
   */
  cancelAtPeriodEnd: boolean;
}

// =============================================================================
// Plan switching (customer-facing)
// =============================================================================

/**
 * One row in the customer-facing available-plans list. Server
 * derives `classification` so the UI label matches the AT_BOUNDARY
 * deferral rule exactly. `effectiveAt` is the next-month boundary
 * the switch would land on (every member shares the same value).
 */
export interface AvailablePlanItem {
  templateId: number;
  templateName: string;
  templateDisplayName: string;
  billingMode: BillingMode;
  commitAmount: number | null;
  currency: string;
  commitPeriod: string | null;
  commitSchedule: string | null;
  /** NULL = unordered alternative; integer = ladder rung (lower = smaller). */
  position: number | null;
  isCurrent: boolean;
  /** "current" | "upgrade" | "downgrade" | "sidegrade" */
  classification: 'current' | 'upgrade' | 'downgrade' | 'sidegrade';
  /** ISO-8601 next-month boundary (UTC) */
  effectiveAt: string;
}

export interface AvailablePlansResponse {
  billingAccountId: number;
  planGroupId: number;
  planGroupDisplayName: string | null;
  /** ISO-8601 next-month boundary (UTC); shared by all members. */
  nextPeriodStart: string;
  available: AvailablePlanItem[];
}

export interface SwitchPlanResponse {
  /**
   * Outcome of a `POST /v0/billing/plan` change for an already-subscribed
   * account:
   *   * "switched"  — applied immediately (anniversary-anchored, Stripe-prorated)
   *   * "scheduled" — deferred to a future boundary (legacy/metered paths)
   *   * "noop"      — target equals the current tier; nothing changed
   */
  status: 'switched' | 'scheduled' | 'noop';
  billingAccountId: number;
  templateId: number;
  /** ISO-8601 effective date — null on noop. */
  effectiveAt: string | null;
  classification: 'current' | 'upgrade' | 'downgrade' | 'sidegrade';
}

// =============================================================================
// Subscribe (self-serve first subscription)
// =============================================================================

/**
 * Result of `POST /v0/billing/subscribe`.
 *
 * When `hostedInvoiceUrl` is present the customer must complete the
 * first payment on the Stripe-hosted invoice page — the console has no
 * Stripe.js, so the UI redirects there (`window.location.assign`).
 * Otherwise (no hosted invoice, e.g. card already on file) the account
 * is treated as subscribed immediately.
 */
export interface SubscribeResponse {
  status: string;
  billingAccountId: number;
  templateId: number;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string;
  /** Stripe PaymentIntent client secret (unused — console has no Stripe.js). */
  clientSecret: string | null;
  /** Stripe-hosted invoice URL to complete the first payment, when required. */
  hostedInvoiceUrl: string | null;
}

// =============================================================================
// Auto-Increment (replaces Auto-Recharge for self-serve)
// =============================================================================

/**
 * Auto-increment opt-in state, mirrored from `GET/PUT /v0/billing/auto-increment`.
 *
 * When enabled, depleting the cycle's credits auto-upgrades the
 * subscription to the next tier (capped at the top tier — never an
 * auto-downgrade). Only meaningful for subscribed accounts.
 */
export interface AutoIncrementData {
  /** Whether auto-increment to the next tier is enabled. */
  enabled: boolean;
  /** Whether the account currently holds a paid subscription. */
  isSubscribed: boolean;
  /** Whether the account is already on the top (largest) tier. */
  atTopTier: boolean;
}

export interface AutoIncrementUpdatePayload {
  enabled: boolean;
}

/**
 * Result of `DELETE /v0/billing/subscription`.
 *
 * Default cancellation is scheduled for the end of the current billing
 * period (`status: "canceling"`) — the customer keeps credits + service
 * until `effectiveAt`. An immediate cancel returns `status: "canceled"`
 * with a null `effectiveAt`.
 */
export interface CancelSubscriptionResponse {
  status: string;
  billingAccountId: number;
  /** ISO timestamp when the subscription ends (null for immediate cancels). */
  effectiveAt: string | null;
}

// =============================================================================
// Billing Profile
// =============================================================================

export interface BillingAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface BillingProfileData {
  name: string;
  billingEmail: string;
  taxId: string;
  taxIdType: string;
  billingAddress: BillingAddress;
}

/** Billing profile response (camelCase — casing handled by interceptor). */
export interface BillingProfileApiResponse {
  name?: string;
  billingEmail?: string;
  taxId?: string;
  taxIdType?: string;
  billingAddress?: Record<string, string>;
  billingSetupComplete?: boolean;
  isBusiness?: boolean;
}

// =============================================================================
// Tax Countries
// =============================================================================

export interface TaxCountry {
  code: string;
  name: string;
  taxIdName: string;
  taxIdFormat: string;
  stripeTaxIdType: string;
}

export interface SupportedTaxCountryEntry {
  name: string;
  description: string;
  taxIdName: string;
  taxIdFormat: string;
  taxIdType?: string;
  stripeTaxIdType: string;
}

export interface SupportedTaxCountriesResponse {
  supportedCountries: Record<string, SupportedTaxCountryEntry>;
  totalCountries: number;
}

// =============================================================================
// Tax ID Validation
// =============================================================================

export interface TaxIdValidationRequest {
  taxId: string;
  country: string;
}

export interface TaxIdValidationResponse {
  valid: boolean;
  errorMessage?: string;
}

// =============================================================================
// Stripe
// =============================================================================

export interface PortalSessionResponse {
  url: string;
}

// =============================================================================
// Payment methods (in-app card management)
// =============================================================================

/** Client secret used to confirm a new card via Stripe Elements. */
export interface SetupIntentResponse {
  clientSecret: string;
}

/** One saved card on the Stripe customer. */
export interface PaymentMethodCard {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  /** Backs subscription renewals (customer default for invoices). */
  isDefault: boolean;
}

/** The customer's saved cards. */
export interface PaymentMethodListResponse {
  paymentMethods: PaymentMethodCard[];
}

// =============================================================================
// Invoices (managed-billing)
// =============================================================================

/**
 * One historical invoice row, mirrored from orchestra's `InvoiceListItem`
 * after camelCase conversion. Surfaced on the Billing page for METERED
 * accounts (and visible-but-secondary for CREDITS, since the Stripe
 * portal is the canonical receipts source there).
 */
export interface InvoiceListItem {
  id: number;
  /** ISO-8601 timestamp the invoice/recharge was created */
  at: string;
  /** Recharge type: AUTORECHARGE | MANUAL | METERED_INVOICE | … */
  type: string;
  amountUsd: number;
  quantity: number;
  /** PAID | INVOICE_CREATED | FAILED | DISPUTED */
  status: string;
  /** Invoicing month (ISO date for the first of the billed month), if any */
  invoiceGroup: string | null;
  stripeInvoiceId: string | null;
  planAssignmentId: number | null;
  /** Backend plan identifier (e.g. ``tier_50_annual``). */
  planTemplateName: string | null;
  /** Customer-facing plan label (e.g. ``$600 / yr``); prefer for display. */
  planTemplateDisplayName: string | null;
  /** Free-form audit detail (raw usage, commit, overage, …) */
  detail: Record<string, unknown> | null;
}

export interface InvoiceListResponse {
  billingAccountId: number;
  invoices: InvoiceListItem[];
  limit: number;
  offset: number;
}

/**
 * Stripe-hosted view + PDF URLs for one invoice.
 *
 * Returned on demand (per-row click) by `GET /v0/billing/invoices/{id}/urls`
 * so the frontend can offer real customer-facing View / Download buttons
 * instead of the broken `dashboard.stripe.com` link the bare invoice id
 * resolves to.
 *
 * Either URL may be null when Stripe hasn't finalised the invoice yet
 * (rare but possible right after creation).
 */
export interface InvoiceUrls {
  rechargeId: number;
  stripeInvoiceId: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
}

// =============================================================================
// Current-period usage (METERED progress bar)
// =============================================================================

/**
 * Mid-period usage snapshot for a METERED account, mirrored from
 * orchestra's `CurrentPeriodUsageResponse` after camelCase conversion.
 *
 * All `_local` quantities are in the contract `currency` (USD for
 * USD templates). `invoicedEstimateLocal` is what the invoice line
 * would be if the period closed right now: the commit floor for
 * COMMITMENT plans, raw contract usage for PAYG. `overageLocal` is
 * the portion above the commit (always 0 for PAYG and for
 * COMMITMENT periods that haven't burned through the floor yet).
 *
 * FX is best-effort mid-period; the closed-out invoice may differ by
 * a small amount.
 */
export interface CurrentPeriodUsage {
  /** ISO date (UTC, inclusive) — start of the calendar month */
  periodStart: string;
  /** ISO date (UTC, exclusive) — start of the next month */
  periodEnd: string;
  currency: string;
  rawUsageLocal: number;
  contractUsageLocal: number;
  commitAmount: number | null;
  invoicedEstimateLocal: number;
  overageLocal: number;
}

// =============================================================================
// Server Actions Interface
// =============================================================================

/**
 * All billing server actions, bound with the API key on the server.
 * Passed from page.tsx → Main → useBilling hook.
 *
 * Follows the same pattern as OrganizationActions and AssistantActions.
 */
export interface TopUpResponse {
  previousCredits: number;
  added: number;
  currentCredits: number;
}

export interface BillingActions {
  /** Fetch current balance */
  getBalance: () => Promise<BalanceData | BillingErrorResponse>;

  /**
   * Manual-top-up mode (staging): grant free credits with no Stripe charge.
   * Hard-gated to manual-top-up deployments server-side.
   */
  topUp: (amount: number) => Promise<TopUpResponse | BillingErrorResponse>;

  /**
   * Subscribe the self-serve account to a monthly credit tier. When the
   * response carries a `hostedInvoiceUrl` the caller must redirect there
   * so the customer can complete the first payment.
   */
  subscribe: (templateId: number) => Promise<SubscribeResponse | BillingErrorResponse>;

  /**
   * Cancel the active self-serve subscription. Defaults to cancelling at
   * the end of the current period (pass `immediate` to cancel now).
   */
  cancelSubscription: (
    immediate?: boolean
  ) => Promise<CancelSubscriptionResponse | BillingErrorResponse>;

  /**
   * Resume a subscription that's scheduled to cancel at period end — clears
   * the pending cancellation so it renews normally.
   */
  reactivateSubscription: () => Promise<CancelSubscriptionResponse | BillingErrorResponse>;

  /** Fetch auto-increment opt-in state. */
  getAutoIncrement: () => Promise<AutoIncrementData | BillingErrorResponse>;

  /** Update the auto-increment opt-in. */
  updateAutoIncrement: (
    payload: AutoIncrementUpdatePayload
  ) => Promise<AutoIncrementData | BillingErrorResponse>;

  /** Fetch billing profile */
  getProfile: () => Promise<BillingProfileApiResponse | BillingErrorResponse>;

  /** Update billing profile */
  updateProfile: (
    data: BillingProfileData
  ) => Promise<BillingProfileApiResponse | BillingErrorResponse>;

  /** Create Stripe customer portal session URL */
  createPortalSession: () => Promise<PortalSessionResponse | BillingErrorResponse>;

  /** Start adding a card: create a SetupIntent and return its client secret. */
  createSetupIntent: () => Promise<SetupIntentResponse | BillingErrorResponse>;

  /** List the customer's saved cards. */
  listPaymentMethods: () => Promise<PaymentMethodListResponse | BillingErrorResponse>;

  /** Make a saved card the default for renewals; returns the updated list. */
  setDefaultPaymentMethod: (
    paymentMethodId: string
  ) => Promise<PaymentMethodListResponse | BillingErrorResponse>;

  /** Remove a saved card; returns the updated list. */
  detachPaymentMethod: (
    paymentMethodId: string
  ) => Promise<PaymentMethodListResponse | BillingErrorResponse>;

  /** Fetch supported tax countries */
  getSupportedTaxCountries: () => Promise<SupportedTaxCountriesResponse | BillingErrorResponse>;

  /** Validate a tax ID */
  validateTaxId: (
    request: TaxIdValidationRequest
  ) => Promise<TaxIdValidationResponse | BillingErrorResponse>;

  /**
   * List historical invoices (newest first). Used by the Billing page
   * METERED variant; harmless on CREDITS accounts (just shows past
   * autorecharge invoices alongside the Stripe portal link).
   */
  getInvoices: (params?: {
    limit?: number;
    offset?: number;
  }) => Promise<InvoiceListResponse | BillingErrorResponse>;

  /**
   * Resolve Stripe-hosted view + PDF URLs for one invoice. Called on
   * demand when the user clicks View / Download in the invoices table
   * — Stripe URLs are short-lived so we don't pre-fetch them.
   */
  getInvoiceUrls: (rechargeId: number) => Promise<InvoiceUrls | BillingErrorResponse>;

  /**
   * Mid-period invoice estimate for the current calendar month. Only
   * meaningful for METERED accounts; CREDITS accounts get a 404 from
   * the backend (caller treats that as "not applicable").
   */
  getCurrentPeriodUsage: () => Promise<CurrentPeriodUsage | BillingErrorResponse>;

  /**
   * List the templates the account is permitted to self-serve switch
   * between, derived server-side from `BillingAccount.plan_group_id`.
   * Empty list when the account has no group; the UI uses that as
   * the gate to hide the "Switch plan" section entirely.
   */
  getAvailablePlans: () => Promise<AvailablePlansResponse | BillingErrorResponse>;

  /**
   * Change an already-subscribed account to another tier in its plan
   * group via `POST /v0/billing/plan`. For subscription tiers the
   * change is immediate (anniversary-anchored, Stripe-prorated) and the
   * response `status` is "switched"; the UI shows immediate-effect copy.
   * Returns 403 when the account has no plan group or the template
   * isn't a member.
   */
  switchPlan: (
    templateId: number,
    changeReason?: string
  ) => Promise<SwitchPlanResponse | BillingErrorResponse>;
}

// =============================================================================
// Organization context for billing page
// =============================================================================

export interface BillingOrgContext {
  orgId: number;
  orgName: string;
  canEdit: boolean;
}

// =============================================================================
// Type guards
// =============================================================================

export function isBillingError(response: unknown): response is BillingErrorResponse {
  return typeof response === 'object' && response !== null && 'detail' in response;
}
