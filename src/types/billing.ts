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

export interface BalanceData {
  /** Formatted string balance (e.g. "25.00") */
  balance: string;
  /** Raw numeric balance */
  fullBalance: number;
  /** ISO-8601 timestamp of last paid recharge, or null */
  lastRechargeAt: string | null;
}

// =============================================================================
// Auto-Recharge
// =============================================================================

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
  individualName: string;
  billingEmail: string;
  taxId: string;
  taxIdType: string;
  billingAddress: BillingAddress;
}

/** Billing profile response (camelCase — casing handled by interceptor). */
export interface BillingProfileApiResponse {
  individualName?: string;
  businessName?: string;
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
  updateAutoRecharge: (
    payload: AutoRechargeUpdatePayload
  ) => Promise<void | BillingErrorResponse>;

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
  getCheckoutStatus: (
    sessionId: string
  ) => Promise<CheckoutStatusResponse | BillingErrorResponse>;

  /** Fetch supported tax countries */
  getSupportedTaxCountries: () => Promise<SupportedTaxCountriesResponse | BillingErrorResponse>;

  /** Validate a tax ID */
  validateTaxId: (
    request: TaxIdValidationRequest
  ) => Promise<TaxIdValidationResponse | BillingErrorResponse>;
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


