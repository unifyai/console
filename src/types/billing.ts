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
  /** Raw numeric balance */
  fullBalance: number;
  /** ISO-8601 timestamp of last paid recharge, or null */
  lastRechargeAt: string | null;
  /** Account status: ACTIVE, PAST_DUE, SUSPENDED, or CLOSED */
  accountStatus: string;
  /**
   * Active billing model. Frontend gates on this — METERED accounts
   * hide the credits wallet UI (Buy Credits, Auto-Recharge) and show
   * a plan + invoices view instead.
   */
  billingMode: BillingMode;
  /** Active plan summary, always populated (default PAYG for pristine accounts) */
  plan: CurrentPlanSummary | null;
  /**
   * Self-serve switch catalog id. Always set — every account is on
   * at least the platform-default group (NOT NULL by schema
   * invariant). The "Switch plan" section is hidden by the
   * server-side response (empty `available` list) when there's
   * nothing useful to switch to (group of one, or current plan
   * not in the assigned group).
   */
  planGroupId: number;
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
  basePricingFactor: number;
  overagePricingFactor: number;
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
  /** "scheduled" when a future assignment was created; "noop" when no-op. */
  status: 'scheduled' | 'noop';
  billingAccountId: number;
  templateId: number;
  /** ISO-8601 effective date — null on noop. */
  effectiveAt: string | null;
  classification: 'current' | 'upgrade' | 'downgrade' | 'sidegrade';
}

// =============================================================================
// Auto-Recharge
// =============================================================================

export type AutoRechargeBlockedReason =
  | 'account_status'
  | 'unpaid_invoice'
  | 'spending'
  | 'payment_method';

export interface AutoRechargeData {
  // Settings
  autoRechargeEnabled: boolean;
  autoRechargeThreshold: number;
  autoRechargeQty: number;
  minRechargeAmount: number;
  // Eligibility
  totalSpending: number;
  canEnableAutoRecharge: boolean;
  minimumSpendRequired: number;
  remainingSpendNeeded: number;
  // Whether the user has a default payment method on file
  hasPaymentMethod: boolean;
  // If non-null, auto-recharge cannot be enabled and this explains why
  blockedReason: AutoRechargeBlockedReason | null;
}

export interface AutoRechargeUpdatePayload {
  enabled: boolean;
  threshold: number;
  qty: number;
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

export interface CheckoutSessionResponse {
  url: string;
}

export interface PortalSessionResponse {
  url: string;
}

export interface CheckoutStatusResponse {
  paymentStatus: string;
}

// =============================================================================
// Checkout Return Status (UI)
// =============================================================================

export interface CheckoutStatus {
  message: string;
  type: 'success' | 'error';
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
  planTemplateName: string | null;
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
export interface BillingActions {
  /** Fetch current balance */
  getBalance: () => Promise<BalanceData | BillingErrorResponse>;

  /** Fetch auto-recharge settings + eligibility */
  getAutoRecharge: () => Promise<AutoRechargeData | BillingErrorResponse>;

  /** Update auto-recharge settings */
  updateAutoRecharge: (payload: AutoRechargeUpdatePayload) => Promise<void | BillingErrorResponse>;

  /** Toggle auto-recharge enabled/disabled */
  toggleAutoRecharge: (enabled: boolean) => Promise<void | BillingErrorResponse>;

  /** Fetch billing profile */
  getProfile: () => Promise<BillingProfileApiResponse | BillingErrorResponse>;

  /** Update billing profile */
  updateProfile: (
    data: BillingProfileData
  ) => Promise<BillingProfileApiResponse | BillingErrorResponse>;

  /** Create Stripe checkout session URL */
  createCheckoutSession: () => Promise<CheckoutSessionResponse | BillingErrorResponse>;

  /** Create Stripe customer portal session URL */
  createPortalSession: () => Promise<PortalSessionResponse | BillingErrorResponse>;

  /** Check Stripe checkout session status */
  getCheckoutStatus: (sessionId: string) => Promise<CheckoutStatusResponse | BillingErrorResponse>;

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
   * Schedule a self-serve switch to `templateId` (must be an active
   * member of the account's plan group). Always lands on the next
   * AT_BOUNDARY (next-month start UTC); the response surfaces both
   * the effective date and the server-derived classification so the
   * UI can render a confirmation toast that matches the rule
   * exactly. Returns 403 when the account has no plan group or the
   * template isn't a member.
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
