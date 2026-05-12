import { ResponseProps } from './common';

export const ADMIN_TABLE_PAGE_SIZE = 30;

export interface CreditGrantLinkClaimDetail {
  userId: string;
  organizationId?: number | null;
  claimedAt?: string | null;
  claimedByEmail?: string | null;
  claimedForOrg?: string | null;
}

export interface OneTimeLinkResponse {
  id: string;
  token: string;
  name?: string | null;
  expiresAt: string;
  creditAmount?: number | null;
  maxClaims: number | null;
  claimCount: number;
  claims?: CreditGrantLinkClaimDetail[];
}

export interface OneTimeLinkEntry {
  id: string;
  token: string;
  name?: string | null;
  expiresAt: string;
  creditAmount?: number | null;
  maxClaims: number | null;
  claimCount: number;
  claims?: CreditGrantLinkClaimDetail[];
}

export interface AdminCreditGrantActions {
  generateOneTimeLink: (
    expiresInDays?: number,
    creditAmount?: number | null,
    maxClaims?: number | null,
    name?: string | null
  ) => Promise<OneTimeLinkResponse | ResponseProps>;
  listOneTimeLinks: (limit: number, offset: number) => Promise<OneTimeLinkEntry[] | ResponseProps>;
  deleteOneTimeLink: (linkId: string) => Promise<ResponseProps>;
}

// =============================================================================
// Admin Onboarding Types
// =============================================================================

/** Organization item returned by the admin list endpoint. */
export interface AdminOrgListItem {
  id: number;
  name: string;
  ownerId: string;
  ownerEmail?: string;
  createdAt?: string;
  memberCount: number;
}

/** Paginated org list response. */
export interface AdminOrgListResponse {
  organizations: AdminOrgListItem[];
  limit: number;
  offset: number;
}

/** Enriched org detail for the admin panel. */
/**
 * Postal address dict mirrored from ``BillingAccount.billing_address``.
 * All fields optional — Stripe accepts a partial record but won't
 * compute tax without ``country`` (and usually ``postal_code``).
 */
export interface AdminBillingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Business profile snapshot for an org's BillingAccount. Drives the
 * Stripe Customer record and invoice addressee fields. ``name`` is
 * the display name (mapped to Stripe individual_name vs business_name
 * by ``build_stripe_customer_name``); ``billingEmail`` is required
 * before a Stripe Customer can be provisioned.
 */
export interface AdminBillingProfile {
  billingEmail: string | null;
  name: string | null;
  taxId: string | null;
  taxIdType: string | null;
  billingAddress: AdminBillingAddress;
}

export interface AdminOrgDetail {
  id: number;
  name: string;
  ownerId: string;
  ownerEmail?: string;
  memberCount: number;
  createdAt?: string;
  freeTrial: boolean;
  verified: boolean;
  verifiedAt: string | null;
  // Billing fields (may be null if no billing account)
  billingAccountId: number | null;
  credits: number;
  accountStatus: string;
  tier: string | null;
  stripeCustomerId: string | null;
  /**
   * Business profile (billing email, name, address, tax ID). Fields
   * are individually nullable until the customer (or admin) fills
   * them in. Mirrors ``BillingAccount`` profile columns 1:1.
   */
  billingProfile: AdminBillingProfile;
  /**
   * Self-serve plan switch catalog assignment. Always set — every
   * account inherits ``DEFAULT_PLAN_GROUP_ID = 1`` at creation
   * (NOT NULL by schema invariant). Operators reassign via the
   * org-detail panel; the customer-facing switcher hides itself
   * automatically when the assigned group's membership doesn't
   * include the active plan, so "no self-serve switching" is
   * expressed by the *combination* (group + active template), not
   * by clearing this column.
   */
  planGroupId: number;
}

/** User lookup result from admin endpoint. */
export interface AdminUserLookup {
  id: string;
  email: string;
  name: string;
  lastName?: string;
  image?: string | null;
  organizations?: Array<{ id: number; name: string; roleName?: string }>;
}

/** Pending invite entry returned by the admin list-invites endpoint. */
export interface AdminOrgInvite {
  id: string;
  email: string;
  status: 'pending' | 'expired';
  createdAt: string | null;
  expiresAt: string | null;
}

/** Actions available on the admin onboarding page. */
export interface AdminOnboardingActions {
  // Organization browsing
  listOrganizations: (
    nameFilter?: string,
    limit?: number,
    offset?: number
  ) => Promise<AdminOrgListResponse | ResponseProps>;
  getOrganizationDetail: (orgId: number) => Promise<AdminOrgDetail | ResponseProps>;

  // User lookup + org creation
  lookupUserByEmail: (email: string) => Promise<AdminUserLookup | ResponseProps>;
  createOrganizationForUser: (name: string, creatorUserId: string) => Promise<ResponseProps>;

  // Invite user to org + list invites
  inviteUserToOrg: (
    orgId: number,
    email: string,
    roleId?: number,
    roleName?: string
  ) => Promise<ResponseProps>;
  listOrgInvites: (orgId: number) => Promise<AdminOrgInvite[] | ResponseProps>;

  // Free trial
  enableFreeTrial: (orgId: number) => Promise<ResponseProps>;
  disableFreeTrial: (orgId: number) => Promise<ResponseProps>;

  // Verification
  verifyOrganization: (orgId: number) => Promise<ResponseProps>;
  unverifyOrganization: (orgId: number) => Promise<ResponseProps>;

  // Billing management
  addCredits: (orgId: number, amount: number, type: string) => Promise<ResponseProps>;
  freezeAccount: (orgId: number, freeze: boolean) => Promise<ResponseProps>;
  /**
   * Update the BillingAccount business profile (and best-effort sync
   * to Stripe if the account already has a Customer). Each field is
   * optional — only fields explicitly passed are written.
   *
   * The dialog calling this should make sure the profile is correct
   * BEFORE the operator provisions a Stripe Customer (so the new
   * Customer ships with proper email/name/address/tax id) and BEFORE
   * the next monthly metered invoicer run (so the invoice picks up
   * the latest data).
   */
  updateBillingProfile: (
    orgId: number,
    profile: Partial<AdminBillingProfile>
  ) => Promise<AdminBillingProfile | ResponseProps>;
}

// =============================================================================
// Admin Managed-Billing Types (templates, assignments, FX, Stripe customer)
// =============================================================================

/**
 * Catalog row returned by /admin/billing/plans/templates.
 *
 * Catalog placement is described by two orthogonal booleans:
 * - `isCustom`  true = bespoke per-customer (hidden from public catalog),
 *               false = catalog (assignable to anyone).
 * - `isActive`  true = accepts new assignments,
 *               false = deprecated (existing assignments stay live).
 *
 * Plan-type ("PAYG" vs "COMMITMENT") is *not* a stored column —
 * it's derived from `commitAmount` (NULL/zero = PAYG, positive =
 * COMMITMENT). The server still surfaces a derived `planType` on the
 * assignment / plan-summary endpoints for display convenience.
 */
export interface AdminBillingPlanTemplate {
  id: number;
  name: string;
  /** Customer-facing label printed on invoices and billing dashboards. Falls back to `name` when null. */
  displayName?: string | null;
  description?: string | null;
  billingMode: string; // 'CREDITS' | 'METERED'
  isCustom: boolean;
  isActive: boolean;
  commitAmount?: number | null;
  /** Invoice currency for the whole template (USD/GBP/...). */
  currency: string;
  commitPeriod?: string | null; // 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
  commitSchedule?: string | null;
  /** Multiplier on raw USD usage WITHIN commit (and for all PAYG usage). 1.00 = list price. */
  basePricingFactor: number;
  /** Multiplier on raw USD usage ABOVE commit (COMMITMENT plans only). 1.00 = list price. */
  overagePricingFactor: number;
  collectionMethod: string;
  prorationPolicy: string;
  /** COMMITMENT+CREDITS only. NULL elsewhere (enforced by check constraint). */
  creditsRolloverPolicy?: string | null;
  // FX policy: NULL for USD templates (no conversion needed), or
  // 'LOCKED_RATE' | 'SPOT' | 'PERIOD_AVERAGE' for non-USD templates.
  // The metered invoicer dispatches on this column at month-end.
  fxPolicy?: string | null;
  fxLockedRate?: number | null;
  supersedesTemplateId?: number | null;
  createdAt: string;
  createdByUserId?: string | null;
}

/** Form payload used by the Create Template dialog. */
export interface AdminBillingPlanTemplateCreate {
  name: string;
  /** Customer-facing label (invoice line items, dashboards). Falls back to `name` when null. */
  displayName?: string | null;
  billingMode: string;
  isCustom?: boolean;
  isActive?: boolean;
  description?: string | null;
  commitAmount?: number | null;
  currency?: string;
  commitPeriod?: string | null;
  commitSchedule?: string | null;
  /** Defaults to 1.0 server-side. */
  basePricingFactor?: number;
  /** Defaults to 1.0 server-side; only meaningful for COMMITMENT plans. */
  overagePricingFactor?: number;
  collectionMethod?: string;
  prorationPolicy?: string;
  creditsRolloverPolicy?: string | null;
  fxPolicy?: string | null;
  fxLockedRate?: number | null;
  supersedesTemplateId?: number | null;
  createdByUserId?: string | null;
}

/**
 * Single assignment row returned by the plans/active and plans/history
 * endpoints. There are no separate cancellation columns: when an account
 * moves off a plan, the *next* row's `changeReason` and `createdByUserId`
 * document the why and by-whom. Reading history newest-first
 * reconstructs the narrative.
 */
export interface AdminBillingPlanAssignment {
  id: number;
  billingAccountId: number;
  templateId: number;
  templateName: string;
  templateBillingMode: string;
  templatePlanType: string;
  startedAt: string;
  endedAt?: string | null;
  createdByUserId?: string | null;
  changeReason?: string | null;
}

/**
 * Wrapper from /admin/billing/plans/active. Every account always has an
 * active assignment (the default plan), so `activeAssignment` is
 * always populated under normal operation; a null value indicates an
 * application-invariant violation (the API returns 500 in that case,
 * never a successful null payload).
 */
export interface AdminActivePlanResponse {
  billingAccountId: number;
  activeAssignment: AdminBillingPlanAssignment;
}

/** Wrapper from /admin/billing/plans/history. */
export interface AdminPlanHistoryResponse {
  billingAccountId: number;
  assignments: AdminBillingPlanAssignment[];
}

/** Response from /admin/billing/stripe-customer. */
export interface AdminStripeCustomerResponse {
  billingAccountId: number;
  stripeCustomerId: string;
  created: boolean;
}

/** Filter options for the catalog list endpoint. */
export interface AdminBillingPlanTemplateListOptions {
  /** undefined = both, true = custom-only, false = catalog-only (default). */
  includeCustom?: boolean;
  /** false = active rows only (default), true = also include deprecated. */
  includeInactive?: boolean;
}

/**
 * Actions exposed on the /admin/plans page. The page combines two
 * tabs (Plans + Groups) that share the same backend surface:
 *  - Catalog templates (list / create / deprecate).
 *  - Plan groups (list / get / create / update / add-member /
 *    remove-member / reorder positions).
 *
 * The two surfaces used to live on separate pages, but groups only
 * make sense as bundles of templates so collapsing them into a
 * single tabbed page keeps the operator workflow in one spot. The
 * org-detail panel keeps its own slimmer `AdminOrgPlanActions` bag
 * for per-account assignment (`assignPlanGroupToOrg` + `setPlan`).
 */
export interface AdminBillingPlansActions {
  // ── Templates ────────────────────────────────────────────────────────
  listTemplates: (
    options?: AdminBillingPlanTemplateListOptions
  ) => Promise<AdminBillingPlanTemplate[] | ResponseProps>;
  createTemplate: (
    body: AdminBillingPlanTemplateCreate
  ) => Promise<AdminBillingPlanTemplate | ResponseProps>;
  deprecateTemplate: (templateId: number) => Promise<ResponseProps>;
  // ── Plan groups ──────────────────────────────────────────────────────
  listGroups: (options?: {
    includeInactive?: boolean;
  }) => Promise<AdminPlanGroupListResponse | ResponseProps>;
  getGroup: (groupId: number) => Promise<AdminPlanGroupDetail | ResponseProps>;
  createGroup: (body: AdminPlanGroupCreatePayload) => Promise<AdminPlanGroupDetail | ResponseProps>;
  updateGroup: (
    groupId: number,
    body: AdminPlanGroupUpdatePayload
  ) => Promise<AdminPlanGroupDetail | ResponseProps>;
  addMember: (
    groupId: number,
    templateId: number,
    position?: number | null
  ) => Promise<AdminPlanGroupDetail | ResponseProps>;
  removeMember: (
    groupId: number,
    templateId: number
  ) => Promise<AdminPlanGroupDetail | ResponseProps>;
  setPositions: (
    groupId: number,
    positions: Array<{ templateId: number; position: number | null }>
  ) => Promise<AdminPlanGroupDetail | ResponseProps>;
}

export interface AdminPlanGroupSummary {
  id: number;
  name: string;
  displayName: string | null;
  isActive: boolean;
  memberCount: number;
}

export interface AdminPlanGroupMemberItem {
  templateId: number;
  templateName: string;
  templateDisplayName: string;
  isActive: boolean;
  position: number | null;
  addedAt: string | null;
}

export interface AdminPlanGroupDetail {
  id: number;
  name: string;
  displayName: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  createdByUserId: string | null;
  members: AdminPlanGroupMemberItem[];
}

export interface AdminPlanGroupListResponse {
  groups: AdminPlanGroupSummary[];
}

export interface AdminPlanGroupCreatePayload {
  name: string;
  displayName?: string;
  description?: string;
  isActive?: boolean;
}

export interface AdminPlanGroupUpdatePayload {
  displayName?: string;
  description?: string;
  isActive?: boolean;
}

/** Per-org plan actions threaded through OrganizationsMain. */
export interface AdminOrgPlanActions {
  getActivePlan: (orgId: number) => Promise<AdminActivePlanResponse | ResponseProps>;
  getPlanHistory: (orgId: number) => Promise<AdminPlanHistoryResponse | ResponseProps>;
  /**
   * Single endpoint for every plan transition. Pass
   * `templateId = DEFAULT_TEMPLATE_ID` (= 1) to cancel — the
   * `changeReason` documents *why* the previous plan was closed.
   * Idempotent: returns `{ status: 'noop', ... }` when the account is
   * already on `templateId`.
   */
  setPlan: (
    orgId: number,
    templateId: number,
    options?: {
      effectiveAt?: string;
      changeReason?: string;
    }
  ) => Promise<ResponseProps>;
  ensureStripeCustomer: (
    orgId: number,
    options?: { fallbackEmail?: string; fallbackName?: string; isBusiness?: boolean }
  ) => Promise<AdminStripeCustomerResponse | ResponseProps>;
  listTemplatesForAssignment: (
    options?: AdminBillingPlanTemplateListOptions
  ) => Promise<AdminBillingPlanTemplate[] | ResponseProps>;
  /**
   * Plan-group catalog reads + per-org assignment. Surfaced inside
   * `AdminOrgPlanActions` so the org-detail panel can render the
   * "Plan group" dropdown alongside the existing plan controls
   * without spinning up a parallel actions bag.
   */
  listPlanGroups: (options?: {
    includeInactive?: boolean;
  }) => Promise<AdminPlanGroupListResponse | ResponseProps>;
  /**
   * Loads one group with its full member list. Used by the org
   * detail panel to drive the "active plan not in this group"
   * informational warning when an operator picks a non-default
   * group for a customer whose current template isn't part of it.
   */
  getPlanGroup: (groupId: number) => Promise<AdminPlanGroupDetail | ResponseProps>;
  assignPlanGroupToOrg: (
    orgId: number,
    groupId: number
  ) => Promise<
    { billingAccountId: number; planGroupId: number; planGroupName: string | null } | ResponseProps
  >;
}

// =============================================================================
// Admin invoice list (cross-account)
// =============================================================================

/**
 * One row in the admin invoice list. Two flavours:
 *
 * - `HISTORICAL` rows are backed by a real `Recharge` and carry an
 *   `id` (recharge id), a `RechargeStatus` value in `status`, and
 *   the recharge `at` timestamp.
 * - `UPCOMING` rows are synthesised from
 *   `monthly_metered_invoicer.estimate_in_progress_invoice` for
 *   active METERED assignments that haven't been invoiced for the
 *   current period yet. `id` is `null`, `status` is the literal
 *   `"UPCOMING"`, `at` is the projected month-end invoice date, and
 *   `amount` is the in-progress projection in `currency`.
 *
 * `currency` is the literal contract currency (3-letter ISO). The
 * server never converts FX — the table renders amounts with their
 * currency code beside them.
 */
export interface AdminInvoiceListItem {
  kind: 'HISTORICAL' | 'UPCOMING';
  id: number | null;
  billingAccountId: number;
  recipientKind: 'USER' | 'ORG';
  recipientId: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  /** ISO-8601 timestamp — invoice `at` (HISTORICAL) or projected month-end (UPCOMING). */
  at: string;
  /** Period-end label (`YYYY-MM-DD`) — the invoice grouping date. */
  invoiceGroup?: string | null;
  type?: string | null;
  status: string;
  amount: number;
  currency: string;
  stripeInvoiceId?: string | null;
  planAssignmentId?: number | null;
  planTemplateId?: number | null;
  planTemplateName?: string | null;
  planTemplateDisplayName?: string | null;
  billingMode?: string | null;
}

export interface AdminInvoiceListResponse {
  invoices: AdminInvoiceListItem[];
  limit: number;
  offset: number;
  total: number;
  upcomingCount: number;
}

/**
 * Filters for the admin invoice endpoint. All optional. The endpoint
 * supports comma-separated `status` values (e.g. `"PAID,FAILED"`)
 * including the synthetic `"UPCOMING"` token.
 */
export interface AdminInvoiceListFilters {
  limit?: number;
  offset?: number;
  status?: string;
  currency?: string;
  planTemplateId?: number;
  fromDate?: string; // YYYY-MM-DD
  toDate?: string; // YYYY-MM-DD
  q?: string;
  includeUpcoming?: boolean;
}

export interface AdminInvoiceActions {
  /**
   * List invoices across all billing accounts. Synthesises
   * `UPCOMING` projections per active METERED assignment when
   * `offset === 0` and `includeUpcoming !== false`.
   */
  listInvoices: (
    filters?: AdminInvoiceListFilters
  ) => Promise<AdminInvoiceListResponse | ResponseProps>;
}
