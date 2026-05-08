/**
 * Seed Scenario: Managed Billing
 *
 * End-to-end "showroom" scenario for the managed-billing v2 UI surfaces.
 * Creates a Unify org (so the operator can view the /admin/* pages),
 * a catalog of `BillingPlanTemplate` rows in every shape, and several
 * personal users + organizations sitting on different plans so the
 * billing page renders one of each variant.
 *
 * **What it creates (catalog):**
 *
 * `Plan type` is *derived* on read from `commit_amount` (positive =
 * COMMITMENT, NULL = PAYG), and catalog placement is two booleans:
 * `is_custom` (catalog vs bespoke) and `is_active` (live vs deprecated).
 * `fx_policy` is NULL for USD templates and required for non-USD ones.
 *
 * | Template                       | Plan type     | Mode    | Currency | FX policy   | is_custom | is_active |
 * |--------------------------------|---------------|---------|----------|-------------|-----------|-----------|
 * | (seeded by migration)          | PAY_AS_YOU_GO | CREDITS | USD      | NULL        | false     | true      |
 * | Pilot Free                     | PAY_AS_YOU_GO | CREDITS | USD      | NULL        | false     | true      |
 * | ClientGamma Credits Monthly        | COMMITMENT    | CREDITS | USD      | NULL        | false     | true      |
 * | Enterprise USD Monthly         | COMMITMENT    | METERED | USD      | NULL        | false     | true      |
 * | Enterprise GBP Monthly         | COMMITMENT    | METERED | GBP      | LOCKED_RATE | false     | true      |
 * | Enterprise EUR Monthly (spot)  | COMMITMENT    | METERED | EUR      | SPOT        | false     | true      |
 * | Acme Bespoke v1 (deprecated)   | COMMITMENT    | METERED | USD      | NULL        | true      | false     |
 *
 * **What it creates (accounts):**
 *
 * | User / Org                     | Plan                              | Notes                                   |
 * |--------------------------------|-----------------------------------|-----------------------------------------|
 * | `unify_admin`  (Owner of Unify)| default (org)                | Has access to /admin/*                  |
 * | `payg_user`                    | default (personal)           | $50 credits, autorecharge OFF           |
 * | `auto_user`                    | default (personal)           | $25 credits, autorecharge ON ($10 → $50)|
 * | `low_user`                     | default (personal)           | -$2 credits — out-of-credits banner     |
 * | `pilot_user`                   | Pilot Free (personal)             | STANDARD non-default CREDITS plan       |
 * | `ClientGamma Health` (org)         | ClientGamma Credits Monthly           | $1,000/mo COMMITMENT+CREDITS, history   |
 * | `Acme Corp` (org)              | Enterprise USD Monthly            | $5,000/mo METERED, fake stripe customer |
 * | `BritCo` (org)                 | Enterprise GBP Monthly            | £4,000/mo METERED, locked FX 0.79 → USD |
 * | `EuroCo` (org)                 | Enterprise EUR Monthly (spot)     | €3,000/mo METERED, SPOT (Frankfurter)   |
 * | `Startup Inc` (org)            | default (org)                | Plain org for the "no contract" view    |
 *
 * Plan **history** is pre-populated for `ClientGamma Health` so the OrgPlanSection
 * History card renders multiple rows (default → Pilot Free → ClientGamma).
 *
 * **Invoice mix (drives the /admin/invoices page):** every
 * `RechargeStatus` value is exercised across the seeded accounts so
 * the admin invoice list, status filter, and currency rendering all
 * have something to show without needing to run the real invoicer.
 *
 * | Account            | Period            | Status            | Currency | Notes                                        |
 * |--------------------|-------------------|-------------------|----------|----------------------------------------------|
 * | Auto Recharge user | -14d              | PAID              | USD      | CREDITS, auto_recharge type                  |
 * | ClientGamma Health     | last month        | PAID              | USD      | CREDITS, commit_topup (commitment fee)       |
 * | Acme Corp          | 3 months ago      | PAID              | USD      | METERED commit                                |
 * | Acme Corp          | 2 months ago      | PAID              | USD      | METERED commit + overage                      |
 * | Acme Corp          | last month        | INVOICE_CREATED   | USD      | issued, awaiting payment                      |
 * | Acme Corp          | current month     | PENDING_INVOICE   | USD      | mid-period placeholder (invoicer pre-claim)   |
 * | BritCo             | 2 months ago      | PAID              | GBP      | METERED, locked FX                            |
 * | BritCo             | last month        | FAILED            | GBP      | charge declined                               |
 * | EuroCo             | last month        | PAID              | EUR      | METERED, SPOT FX                              |
 * | EuroCo             | 2 months ago      | DISPUTED          | EUR      | chargeback                                    |
 *
 * Plus *synthesised UPCOMING projections*: the /admin/invoices
 * endpoint generates one per active METERED assignment (Acme,
 * BritCo, EuroCo) by calling
 * `monthly_metered_invoicer.estimate_in_progress_invoice` against
 * the seeded current-month usage. Acme's UPCOMING is suppressed
 * automatically by the endpoint's "already invoiced this period?"
 * check because of the seeded PENDING_INVOICE row above — exercising
 * the de-duplication branch.
 *
 * **Credentials:** Every user has email login with password `testpass123`.
 * Sign in as `unify_admin` to view the /admin/plans + /admin/organizations
 * pages and inspect every plan / template via the new admin surface.
 *
 * Run:
 *   ./scripts/local.sh start --seed managed-billing
 *
 * (Optionally pair with `--stripe` if you want to exercise checkout/portal,
 * or `--pubsub` for live billing-event banners.)
 */

import type { SeededOrg, SeededState, SeededUser } from '../types';
import {
  addMember,
  createAssistant,
  createEmailLogin,
  createOrg,
  createUser,
  dbExec,
  dbExecBlock,
  seedChatInfrastructure,
} from '../client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Seeded by the v2 migration; every account starts on this template. */
const DEFAULT_TEMPLATE_ID = 1;

// ---------------------------------------------------------------------------
// Direct-SQL helpers (managed-billing schema)
// ---------------------------------------------------------------------------

/**
 * Inputs for {@link createTemplate}. Mirrors the (post-refinement)
 * `BillingPlanTemplate` columns:
 *
 *   * `plan_type` is no longer a column — pass `commitAmount > 0` for
 *     COMMITMENT, omit (or pass null) for PAY_AS_YOU_GO. The server
 *     derives the label on read.
 *   * `monthly_usage_cap`, `overage_policy`, `overdraft_policy`,
 *     `fx_provider` were dropped entirely.
 *   * `availability` was split into two booleans: `isCustom` (catalog
 *     vs bespoke) and `isActive` (live vs deprecated).
 *   * `commit_currency` was renamed to `currency`.
 *   * `rollover_policy` was renamed to `creditsRolloverPolicy` and is
 *     now the only credits-side knob (overdraft never blocks UX).
 *   * `fx_policy` is NULL for USD templates and required (LOCKED_RATE
 *     / SPOT / PERIOD_AVERAGE) for non-USD ones.
 */
interface CreateTemplateOpts {
  name: string;
  displayName: string;
  description: string;
  billingMode: 'CREDITS' | 'METERED';
  commitAmount?: number | null;
  currency?: string;
  commitPeriod?: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | null;
  commitSchedule?: 'AMORTISED' | 'UPFRONT' | null;
  basePricingFactor?: number;
  overagePricingFactor?: number;
  collectionMethod?: 'AUTO_CARD' | 'SEND_INVOICE_NET_30';
  prorationPolicy?: 'PRORATE' | 'SKIP_FIRST' | 'FULL_FIRST';
  creditsRolloverPolicy?: 'ROLL_OVER' | 'FORFEIT_AT_PERIOD_END' | null;
  fxPolicy?: 'LOCKED_RATE' | 'SPOT' | 'PERIOD_AVERAGE' | null;
  fxLockedRate?: number | null;
  isCustom?: boolean;
  isActive?: boolean;
  supersedesTemplateId?: number | null;
}

function sqlString(value: string | null | undefined): string {
  if (value == null) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNumber(value: number | null | undefined): string {
  if (value == null) return 'NULL';
  return String(value);
}

/**
 * Insert a `BillingPlanTemplate` row directly via SQL. Bypasses the
 * admin endpoint so the seed can run without going through Console
 * (which isn't booted yet at seed time) — the orchestra DAO has no
 * extra side-effects for templates beyond the row insert, so this is
 * a safe shortcut.
 */
function createTemplate(opts: CreateTemplateOpts): number {
  const isCommit = (opts.commitAmount ?? 0) > 0;
  const currency = opts.currency ?? 'USD';
  // Mirror the backend invariant: USD => fx_policy NULL,
  // non-USD => fx_policy required (default to SPOT if caller omitted it).
  const fxPolicy = currency === 'USD' ? null : (opts.fxPolicy ?? 'SPOT');
  // creditsRolloverPolicy is COMMITMENT+CREDITS only (CHECK constraint).
  const rolloverPolicy =
    isCommit && opts.billingMode === 'CREDITS' ? (opts.creditsRolloverPolicy ?? null) : null;

  const sql = `
INSERT INTO billing_plan_template (
  name, display_name, description,
  billing_mode,
  commit_amount, currency, commit_period, commit_schedule,
  base_pricing_factor, overage_pricing_factor,
  collection_method,
  proration_policy, credits_rollover_policy,
  fx_policy, fx_locked_rate,
  is_custom, is_active, supersedes_template_id,
  created_at
) VALUES (
  ${sqlString(opts.name)},
  ${sqlString(opts.displayName)},
  ${sqlString(opts.description)},
  ${sqlString(opts.billingMode)},
  ${sqlNumber(opts.commitAmount ?? null)},
  ${sqlString(currency)},
  ${opts.commitPeriod ? sqlString(opts.commitPeriod) : 'NULL'},
  ${opts.commitSchedule ? sqlString(opts.commitSchedule) : 'NULL'},
  ${sqlNumber(opts.basePricingFactor ?? 1.0)},
  ${sqlNumber(opts.overagePricingFactor ?? 1.0)},
  ${sqlString(opts.collectionMethod ?? 'AUTO_CARD')},
  ${sqlString(opts.prorationPolicy ?? 'PRORATE')},
  ${rolloverPolicy ? sqlString(rolloverPolicy) : 'NULL'},
  ${fxPolicy ? sqlString(fxPolicy) : 'NULL'},
  ${sqlNumber(opts.fxLockedRate ?? null)},
  ${(opts.isCustom ?? false) ? 'true' : 'false'},
  ${(opts.isActive ?? true) ? 'true' : 'false'},
  ${sqlNumber(opts.supersedesTemplateId ?? null)},
  now()
)
RETURNING id;
`;
  const id = dbExec(sql);
  return parseInt(id, 10);
}

/**
 * Look up the billing_account_id for a user or organization.
 */
function billingAccountFor(opts: { userId?: string; orgId?: number }): number {
  if (opts.userId) {
    const id = dbExec(`SELECT billing_account_id FROM "user" WHERE id = '${opts.userId}';`);
    return parseInt(id, 10);
  }
  if (opts.orgId != null) {
    const id = dbExec(`SELECT billing_account_id FROM organization WHERE id = ${opts.orgId};`);
    return parseInt(id, 10);
  }
  throw new Error('billingAccountFor requires userId or orgId');
}

interface AssignPlanOpts {
  billingAccountId: number;
  templateId: number;
  /** UTC ISO timestamp; default = first-of-current-month. */
  startedAt?: string;
  /** UTC ISO timestamp; default = NULL (active). */
  endedAt?: string | null;
  changeReason?: string;
  /** Whether to set this as the account's plan_assignment_id. */
  makeActive?: boolean;
}

/**
 * Insert a `BillingPlanAssignment` row and (optionally) set the account's
 * `plan_assignment_id` pointer to it.
 *
 * The migration backfill only catches accounts that exist *at migration
 * time*. Seed-created accounts have NULL `plan_assignment_id` until we
 * insert their first assignment — this helper closes that gap.
 */
function assignPlan(opts: AssignPlanOpts): number {
  const startedAt = opts.startedAt ?? firstOfCurrentMonthIso();
  const endedAt = opts.endedAt ?? null;
  const reason = opts.changeReason ?? 'Seeded by managed-billing scenario';

  const id = dbExec(`
INSERT INTO billing_plan_assignment (
  billing_account_id, template_id,
  started_at, ended_at,
  change_reason
) VALUES (
  ${opts.billingAccountId},
  ${opts.templateId},
  '${startedAt}'::timestamptz,
  ${endedAt ? `'${endedAt}'::timestamptz` : 'NULL'},
  ${sqlString(reason)}
)
RETURNING id;
`);
  const assignmentId = parseInt(id, 10);

  if (opts.makeActive ?? endedAt === null) {
    dbExec(
      `UPDATE billing_account SET plan_assignment_id = ${assignmentId} WHERE id = ${opts.billingAccountId};`
    );
  }
  return assignmentId;
}

/**
 * Convenience wrapper: ensure the given billing account has a default
 * assignment row + `plan_assignment_id` pointer (matching what
 * `BillingAccountDAO.create` does in production).
 *
 * Idempotent: skips if the account already has an active assignment.
 */
function ensureDefaultPaygAssignment(billingAccountId: number): void {
  const existing = dbExec(
    `SELECT id FROM billing_plan_assignment WHERE billing_account_id = ${billingAccountId} AND ended_at IS NULL LIMIT 1;`
  );
  if (existing) return;
  assignPlan({
    billingAccountId,
    templateId: DEFAULT_TEMPLATE_ID,
    changeReason: 'default (seed)',
    makeActive: true,
  });
}

/**
 * Set a fake Stripe customer id on a billing account so the admin
 * "Stripe Customer ✓ provisioned" pill renders without round-tripping
 * to Stripe.
 *
 * Use the `cus_seed_*` prefix so it's obviously not a real Stripe id
 * if it ever leaks into a log.
 */
function setFakeStripeCustomer(billingAccountId: number, suffix: string): void {
  dbExec(
    `UPDATE billing_account SET stripe_customer_id = 'cus_seed_${suffix}', billing_setup_complete = true WHERE id = ${billingAccountId};`
  );
}

/**
 * Insert a metered Recharge row referencing the given plan assignment
 * + a realistic `detail` audit blob so both the customer billing
 * page's InvoicesTable and the new /admin/invoices page render past
 * metered invoices.
 *
 * The `detail` shape matches what the real metered invoicer stamps
 * (`raw_usage_local`, `commit_amount`, `invoiced_local`, `currency`,
 * …) so the customer-facing breakdown renderer recognises it as a
 * METERED row and surfaces the inline "Commit · Usage · Overage" line.
 *
 * `status` defaults to `PAID` for back-compat with the original call
 * sites. `INVOICE_CREATED` / `FAILED` / `DISPUTED` rows still get a
 * stable `in_seed_*` `stripe_invoice_id`; `PENDING_INVOICE` rows get
 * NULL since in reality the Stripe invoice hasn't been created yet at
 * that status (it represents the internal "we owe this customer an
 * invoice at period close" state). The `at` timestamp is "1 hour
 * before period close" for everything except PENDING_INVOICE which is
 * "mid-period" — closer to what the metered invoicer actually writes.
 */
function addMeteredRecharge(opts: {
  billingAccountId: number;
  planAssignmentId: number;
  /** Final invoice amount in *contract currency* (matches `currency`). */
  amountLocal: number;
  /** YYYY-MM-DD of the period start (1st of month). */
  periodStart: string;
  currency: string;
  /** USD → contract-currency rate (1.0 for USD templates). */
  fxRate: number;
  commitAmount: number;
  /** Raw usage in USD (ledger-level), pre-FX, pre-pricing-factor. */
  rawUsageUsd: number;
  /** Recharge status. Defaults to PAID for back-compat. */
  status?: 'PAID' | 'INVOICE_CREATED' | 'FAILED' | 'DISPUTED' | 'PENDING_INVOICE';
}): void {
  const rawUsageLocal = +(opts.rawUsageUsd * opts.fxRate).toFixed(2);
  const contractUsageLocal = rawUsageLocal; // pricing_factor = 1 in seed
  const invoicedLocal = Math.max(opts.commitAmount, contractUsageLocal);
  const overageLocal = Math.max(0, contractUsageLocal - opts.commitAmount);
  const periodEndIso = new Date(
    new Date(`${opts.periodStart}T00:00:00Z`).setUTCMonth(
      new Date(`${opts.periodStart}T00:00:00Z`).getUTCMonth() + 1
    )
  )
    .toISOString()
    .slice(0, 10);

  const detail = JSON.stringify({
    raw_usage_usd: opts.rawUsageUsd.toString(),
    grants_usd: '0',
    raw_usage_local: rawUsageLocal.toString(),
    grants_local: '0',
    base_pricing_factor: '1',
    overage_pricing_factor: '1',
    contract_usage_local: contractUsageLocal.toString(),
    payg_charge_local: '0',
    commit_charge_local: opts.commitAmount.toString(),
    overage_charge_local: overageLocal.toString(),
    commit_amount: opts.commitAmount.toString(),
    monthly_commit_local: opts.commitAmount.toString(),
    commit_schedule: 'AMORTISED',
    is_commit_billing_period: true,
    invoiced_local: invoicedLocal.toString(),
    overage_local: overageLocal.toString(),
    currency: opts.currency,
    period_start: `${opts.periodStart}T00:00:00+00:00`,
    period_end: `${periodEndIso}T00:00:00+00:00`,
    fx_rate: opts.fxRate.toString(),
    fx_policy: opts.currency === 'USD' ? 'NONE' : 'LOCKED_RATE',
    fx_provider: opts.currency === 'USD' ? null : 'frankfurter',
  }).replace(/'/g, "''");

  const status = opts.status ?? 'PAID';
  // PENDING_INVOICE is the internal "owe this customer an invoice at
  // period close" state — Stripe knows nothing about it yet, so leave
  // ``stripe_invoice_id`` NULL. Every other state has a real invoice
  // on the Stripe side; we mint a stable ``in_seed_*`` id so the
  // admin Stripe-Dashboard deep-link and the customer View / PDF
  // buttons render.
  const stripeInvoiceId =
    status === 'PENDING_INVOICE'
      ? null
      : `in_seed_${opts.billingAccountId}_${opts.periodStart.replace(/-/g, '')}`;

  // PENDING_INVOICE is mid-period (no close yet); everything else is
  // pinned to the last hour of the period (matches the real invoicer
  // which writes the row at period close).
  const at =
    status === 'PENDING_INVOICE'
      ? `'${opts.periodStart}T00:00:00Z'::timestamptz + interval '14 days'`
      : `'${opts.periodStart}T00:00:00Z'::timestamptz + interval '1 month' - interval '1 hour'`;

  dbExecBlock(`
INSERT INTO recharge (
  billing_account_id, type, quantity, amount_usd, status, at,
  plan_id, invoice_group, detail, stripe_invoice_id
) VALUES (
  ${opts.billingAccountId},
  'monthly_commit',
  ${opts.amountLocal},
  ${opts.amountLocal},
  '${status}',
  ${at},
  ${opts.planAssignmentId},
  '${opts.periodStart}'::date,
  '${detail}'::jsonb,
  ${stripeInvoiceId === null ? 'NULL' : `'${stripeInvoiceId}'`}
);
`);
}

/**
 * Insert a CREDITS-mode commitment recharge — the historical
 * counterpart to {@link addMeteredRecharge} for accounts on a CREDITS
 * COMMITMENT plan (commit fee paid in advance, credits topped up to
 * `amount_usd` on settlement).
 *
 * Distinct from {@link addMeteredRecharge} on three axes:
 *   - `type` is `commit_topup` (not `monthly_commit`) so the
 *     customer-facing breakdown renderer doesn't try to parse a
 *     METERED `detail` blob.
 *   - `detail` is intentionally NULL — CREDITS recharges have no
 *     "raw usage / commit / overage" decomposition; they're a flat
 *     period charge.
 *   - `currency` lives on the template, not the row, so we don't
 *     stash it on the recharge itself; the admin endpoint joins
 *     `BillingPlanTemplate.currency` for the display column.
 */
function addCreditsCommitmentRecharge(opts: {
  billingAccountId: number;
  planAssignmentId: number;
  amountUsd: number;
  /** YYYY-MM-DD of the period start (1st of month). */
  periodStart: string;
  status?: 'PAID' | 'INVOICE_CREATED' | 'FAILED' | 'DISPUTED';
}): void {
  const status = opts.status ?? 'PAID';
  const stripeInvoiceId = `in_seed_${opts.billingAccountId}_${opts.periodStart.replace(/-/g, '')}_credits`;
  dbExecBlock(`
INSERT INTO recharge (
  billing_account_id, type, quantity, amount_usd, status, at,
  plan_id, invoice_group, stripe_invoice_id
) VALUES (
  ${opts.billingAccountId},
  'commit_topup',
  ${opts.amountUsd},
  ${opts.amountUsd},
  '${status}',
  '${opts.periodStart}T00:00:00Z'::timestamptz + interval '1 month' - interval '1 hour',
  ${opts.planAssignmentId},
  '${opts.periodStart}'::date,
  '${stripeInvoiceId}'
);
`);
}

/**
 * Stamp a single CreditTransaction debit at the given offset *into the
 * current calendar month* — used to give METERED accounts some
 * mid-period usage so the billing page progress bar renders against a
 * real number rather than $0 of the commit.
 */
function addCurrentMonthUsage(opts: {
  billingAccountId: number;
  userId: string;
  amountUsd: number;
  daysIntoMonth: number;
}): void {
  dbExecBlock(`
INSERT INTO credit_transaction
  (billing_account_id, user_id, amount, category, description, at)
VALUES (
  ${opts.billingAccountId},
  '${opts.userId}',
  ${-Math.abs(opts.amountUsd)},
  'llm',
  'Seeded current-period usage',
  date_trunc('month', NOW()) + INTERVAL '${opts.daysIntoMonth} days'
);
`);
}

function firstOfCurrentMonthIso(): string {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return first.toISOString();
}

function firstOfMonthsAgoIso(monthsAgo: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
  return d.toISOString();
}

function firstOfMonthsAgoDate(monthsAgo: number): string {
  return firstOfMonthsAgoIso(monthsAgo).slice(0, 10);
}

/**
 * Insert a `plan_group` row directly via SQL and return the new id.
 * Mirrors {@link createTemplate}: the seed bypasses the admin
 * endpoint because Console isn't booted at seed time, and the DAO
 * has no extra side effects.
 */
function createPlanGroup(opts: {
  name: string;
  displayName: string;
  description?: string;
}): number {
  const id = dbExec(`
INSERT INTO plan_group (name, display_name, description, is_active, created_at)
VALUES (
  ${sqlString(opts.name)},
  ${sqlString(opts.displayName)},
  ${sqlString(opts.description ?? null)},
  true,
  now()
)
RETURNING id;
`);
  return parseInt(id, 10);
}

/**
 * Add a template to a plan group at the given (optional) ladder
 * rung. NULL position = unordered alternative; integer position =
 * ordered rung (lower = smaller tier; downgrade target). Positions
 * must be unique within a group when set — the partial unique index
 * enforces that.
 */
function addPlanGroupMember(opts: {
  groupId: number;
  templateId: number;
  position?: number | null;
}): void {
  dbExec(`
INSERT INTO plan_group_member (group_id, template_id, position, added_at)
VALUES (
  ${opts.groupId},
  ${opts.templateId},
  ${sqlNumber(opts.position ?? null)},
  now()
);
`);
}

/** Set the plan_group_id pointer on a billing account (NULL clears). */
function assignPlanGroupToAccount(billingAccountId: number, groupId: number | null): void {
  dbExec(
    `UPDATE billing_account SET plan_group_id = ${sqlNumber(groupId)} WHERE id = ${billingAccountId};`
  );
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

export async function seedManagedBilling(): Promise<SeededState> {
  // ───────────────────────────────────────────────────────────────────────
  // 1. Catalog: BillingPlanTemplate rows
  // ───────────────────────────────────────────────────────────────────────

  const pilotFreeId = createTemplate({
    name: 'pilot-free-2026',
    displayName: 'Pilot Free',
    description:
      'Free 30-day pilot for early enterprise prospects. Same shape as default ' +
      'but tracked separately so usage can be reported back to the sales team.',
    billingMode: 'CREDITS',
    collectionMethod: 'AUTO_CARD',
    isCustom: false,
    isActive: true,
  });

  const vantageCreditsId = createTemplate({
    name: 'clientgamma-credits-2026',
    displayName: 'ClientGamma Credits Monthly',
    description: '$1,000 monthly credit subscription. Unused credits roll over within the period.',
    billingMode: 'CREDITS',
    commitAmount: 1000,
    currency: 'USD',
    commitPeriod: 'MONTHLY',
    commitSchedule: 'UPFRONT',
    // UPFRONT-schedule plans bill the full commit on contract
    // anniversaries; the backend CHECK constraint requires FULL_FIRST
    // proration so the first period carries the full commit and
    // anniversaries land cleanly on month boundaries.
    prorationPolicy: 'FULL_FIRST',
    creditsRolloverPolicy: 'ROLL_OVER',
    collectionMethod: 'AUTO_CARD',
    isCustom: false,
    isActive: true,
  });

  const enterpriseUsdId = createTemplate({
    name: 'enterprise-usd-2026',
    displayName: 'Enterprise USD Monthly',
    description:
      '$5,000 monthly commitment, metered. Usage above commit is invoiced at list price ' +
      'on the next monthly invoice (NET-30).',
    billingMode: 'METERED',
    commitAmount: 5000,
    currency: 'USD',
    commitPeriod: 'MONTHLY',
    commitSchedule: 'AMORTISED',
    collectionMethod: 'SEND_INVOICE_NET_30',
    isCustom: false,
    isActive: true,
  });

  const enterpriseGbpId = createTemplate({
    name: 'enterprise-gbp-2026',
    displayName: 'Enterprise GBP Monthly',
    description:
      '£4,000 monthly commitment, metered, billed in GBP. USD-ledger usage converted ' +
      'to GBP at the contractually-locked rate of 0.79 GBP per USD.',
    billingMode: 'METERED',
    commitAmount: 4000,
    currency: 'GBP',
    commitPeriod: 'MONTHLY',
    commitSchedule: 'AMORTISED',
    collectionMethod: 'SEND_INVOICE_NET_30',
    fxPolicy: 'LOCKED_RATE',
    fxLockedRate: 0.79,
    isCustom: false,
    isActive: true,
  });

  const enterpriseEurId = createTemplate({
    name: 'enterprise-eur-2026',
    displayName: 'Enterprise EUR Monthly',
    description:
      '€3,000 monthly commitment, metered, billed in EUR. USD-ledger usage converted ' +
      'to EUR at the spot rate (Frankfurter) on the invoice date.',
    billingMode: 'METERED',
    commitAmount: 3000,
    currency: 'EUR',
    commitPeriod: 'MONTHLY',
    commitSchedule: 'AMORTISED',
    collectionMethod: 'SEND_INVOICE_NET_30',
    fxPolicy: 'SPOT',
    isCustom: false,
    isActive: true,
  });

  // ─── Extra rungs for the ClientGamma public ladder ───────────────────────
  // Two extra METERED-USD templates that flank the existing
  // ``enterpriseUsdId`` so the customer-facing Switch Plan section
  // has somewhere to upgrade *and* downgrade to. Same shape as the
  // main commit, just at different price points.
  const vantageStarterId = createTemplate({
    name: 'clientgamma-starter-2026',
    displayName: 'ClientGamma Starter',
    description:
      'Entry tier of the public ClientGamma ladder. $1,500 monthly commit, ' +
      'metered, designed for prospects evaluating the platform.',
    billingMode: 'METERED',
    commitAmount: 1500,
    currency: 'USD',
    commitPeriod: 'MONTHLY',
    commitSchedule: 'AMORTISED',
    collectionMethod: 'SEND_INVOICE_NET_30',
    isCustom: false,
    isActive: true,
  });

  const vantageScaleId = createTemplate({
    name: 'clientgamma-scale-2026',
    displayName: 'ClientGamma Scale',
    description:
      'Top rung of the public ClientGamma ladder. $10,000 monthly commit ' +
      'with a 0.85× base discount on contract usage.',
    billingMode: 'METERED',
    commitAmount: 10000,
    currency: 'USD',
    commitPeriod: 'MONTHLY',
    commitSchedule: 'AMORTISED',
    basePricingFactor: 0.85,
    collectionMethod: 'SEND_INVOICE_NET_30',
    isCustom: false,
    isActive: true,
  });

  // Deprecated row — proves the catalog filter / "Deprecated" badge.
  // is_custom=true keeps it out of the default catalog list; is_active=false
  // keeps it out unless the operator opts into "Show deprecated".
  createTemplate({
    name: 'acme-bespoke-v1',
    displayName: 'Acme Bespoke v1',
    description:
      'Original bespoke contract with Acme Corp (deprecated; superseded by ' +
      'Enterprise USD Monthly). Kept around for grandfathered accounts.',
    billingMode: 'METERED',
    commitAmount: 7500,
    currency: 'USD',
    commitPeriod: 'MONTHLY',
    commitSchedule: 'AMORTISED',
    collectionMethod: 'SEND_INVOICE_NET_30',
    isCustom: true,
    isActive: false,
    supersedesTemplateId: enterpriseUsdId,
  });

  // ───────────────────────────────────────────────────────────────────────
  // 2. Unify org + admin viewer
  // ───────────────────────────────────────────────────────────────────────

  const unifyAdmin = createUser({ name: 'Unify', lastName: 'Admin' });
  createEmailLogin({ userId: unifyAdmin.id });

  const unifyOrg = createOrg({ name: 'Unify', ownerId: unifyAdmin.id });
  ensureDefaultPaygAssignment(billingAccountFor({ orgId: unifyOrg.id }));

  // ───────────────────────────────────────────────────────────────────────
  // 3. Personal users on different CREDITS plans
  // ───────────────────────────────────────────────────────────────────────

  const paygUser = createUser({
    name: 'PAYG',
    lastName: 'User',
    credits: 50,
  });
  createEmailLogin({ userId: paygUser.id });
  ensureDefaultPaygAssignment(billingAccountFor({ userId: paygUser.id }));

  const autoUser = createUser({
    name: 'Auto',
    lastName: 'Recharge',
    credits: 25,
  });
  createEmailLogin({ userId: autoUser.id });
  ensureDefaultPaygAssignment(billingAccountFor({ userId: autoUser.id }));
  // Flip auto-recharge ON for this user.
  dbExec(
    `UPDATE billing_account SET autorecharge = true, autorecharge_threshold = 10, autorecharge_qty = 50 WHERE id = ${billingAccountFor({ userId: autoUser.id })};`
  );
  // Add one historical PAID recharge so the InvoicesTable shows something.
  dbExecBlock(`
INSERT INTO recharge (billing_account_id, type, quantity, amount_usd, status, at)
VALUES (
  ${billingAccountFor({ userId: autoUser.id })},
  'auto_recharge', 50, 50, 'PAID', now() - interval '14 days'
);
`);

  const lowUser = createUser({
    name: 'Low',
    lastName: 'Credits',
    credits: -2,
  });
  createEmailLogin({ userId: lowUser.id });
  ensureDefaultPaygAssignment(billingAccountFor({ userId: lowUser.id }));

  const pilotUser = createUser({
    name: 'Pilot',
    lastName: 'Tester',
    credits: 100,
  });
  createEmailLogin({ userId: pilotUser.id });
  // Pilot user is on the Pilot Free template (a non-default STANDARD CREDITS plan).
  assignPlan({
    billingAccountId: billingAccountFor({ userId: pilotUser.id }),
    templateId: pilotFreeId,
    changeReason: 'Onboarded onto Pilot Free programme',
    startedAt: firstOfMonthsAgoIso(1),
    makeActive: true,
  });

  // ───────────────────────────────────────────────────────────────────────
  // 4. ClientGamma Health — COMMITMENT + CREDITS, with plan history
  // ───────────────────────────────────────────────────────────────────────

  const vantageOwner = createUser({ name: 'ClientGamma', lastName: 'Owner' });
  createEmailLogin({ userId: vantageOwner.id });
  const vantageOrg = createOrg({
    name: 'ClientGamma Health',
    ownerId: vantageOwner.id,
    credits: 320, // current period balance (consumed roughly 2/3 of commit)
  });
  const vantageBaId = billingAccountFor({ orgId: vantageOrg.id });

  // Plan history: started on default, moved to Pilot Free, now ClientGamma.
  assignPlan({
    billingAccountId: vantageBaId,
    templateId: DEFAULT_TEMPLATE_ID,
    startedAt: firstOfMonthsAgoIso(4),
    endedAt: firstOfMonthsAgoIso(3),
    changeReason: 'Initial signup',
    makeActive: false,
  });
  assignPlan({
    billingAccountId: vantageBaId,
    templateId: pilotFreeId,
    startedAt: firstOfMonthsAgoIso(3),
    endedAt: firstOfMonthsAgoIso(1),
    changeReason: 'Moved to Pilot Free programme',
    makeActive: false,
  });
  const vantageActive = assignPlan({
    billingAccountId: vantageBaId,
    templateId: vantageCreditsId,
    startedAt: firstOfMonthsAgoIso(1),
    changeReason: 'Q2 contract — committed credits',
    makeActive: true,
  });

  // CREDITS-COMMITMENT historical recharge: the monthly $1,000
  // commit-fee invoice that topped ClientGamma's wallet up at the start
  // of the current period. Gives the admin invoices page at least
  // one CREDITS-mode historical row alongside the METERED ones — a
  // distinct billing_mode column value the operator can filter on.
  addCreditsCommitmentRecharge({
    billingAccountId: vantageBaId,
    planAssignmentId: vantageActive,
    amountUsd: 1000,
    periodStart: firstOfMonthsAgoDate(1),
  });

  const vantageAssistant = createAssistant({
    userId: vantageOwner.id,
    orgId: vantageOrg.id,
    firstName: 'Vance',
    surname: 'Bot',
  });
  await seedChatInfrastructure({
    apiKey: vantageOrg.ownerOrgApiKey,
    userId: vantageOwner.id,
    assistantId: vantageAssistant.agentId,
    email: vantageOwner.email,
  });

  // ───────────────────────────────────────────────────────────────────────
  // 5. Acme Corp — METERED USD with past invoices
  // ───────────────────────────────────────────────────────────────────────

  const acmeOwner = createUser({ name: 'Acme', lastName: 'Owner' });
  createEmailLogin({ userId: acmeOwner.id });
  const acmeOrg = createOrg({
    name: 'Acme Corp',
    ownerId: acmeOwner.id,
    credits: 0, // METERED accounts don't carry a wallet balance
  });
  const acmeBaId = billingAccountFor({ orgId: acmeOrg.id });
  setFakeStripeCustomer(acmeBaId, `acme_${acmeOrg.id}`);

  const acmeActive = assignPlan({
    billingAccountId: acmeBaId,
    templateId: enterpriseUsdId,
    startedAt: firstOfMonthsAgoIso(3),
    changeReason: 'Q1 2026 master agreement',
    makeActive: true,
  });

  // Past PAID invoices (commit + slight overage) — two consecutive
  // months so the admin /invoices view has multiple historical rows
  // for the same account.
  addMeteredRecharge({
    billingAccountId: acmeBaId,
    planAssignmentId: acmeActive,
    amountLocal: 5000,
    periodStart: firstOfMonthsAgoDate(3),
    currency: 'USD',
    fxRate: 1,
    commitAmount: 5000,
    rawUsageUsd: 4200,
  });
  addMeteredRecharge({
    billingAccountId: acmeBaId,
    planAssignmentId: acmeActive,
    amountLocal: 5800,
    periodStart: firstOfMonthsAgoDate(2),
    currency: 'USD',
    fxRate: 1,
    commitAmount: 5000,
    rawUsageUsd: 5800,
  });
  // Last month: invoice was created and finalised on Stripe but the
  // customer hasn't paid yet — the canonical INVOICE_CREATED state
  // (visible to customers as "outstanding" and to operators as a
  // collection target). Slightly larger than commit so the row also
  // exercises the "with overage" decomposition.
  addMeteredRecharge({
    billingAccountId: acmeBaId,
    planAssignmentId: acmeActive,
    amountLocal: 6300,
    periodStart: firstOfMonthsAgoDate(1),
    currency: 'USD',
    fxRate: 1,
    commitAmount: 5000,
    rawUsageUsd: 6300,
    status: 'INVOICE_CREATED',
  });
  // Mid-current-month placeholder Recharge in the internal
  // PENDING_INVOICE state — written by the metered invoicer's
  // pre-claim step before it has actually called ``Invoice.create``
  // on Stripe. The synthesised UPCOMING projection on the admin
  // page will *also* show Acme's current-month exposure, but the two
  // are complementary: PENDING_INVOICE is a real DB row that the
  // invoicer will mutate at period close, whereas UPCOMING is a
  // computed view that disappears once the row exists. Seeding both
  // exercises the de-duplication path in the admin endpoint
  // ("already invoiced for this period? skip the projection").
  const currentMonthFirst = (() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  })();
  addMeteredRecharge({
    billingAccountId: acmeBaId,
    planAssignmentId: acmeActive,
    amountLocal: 5000,
    periodStart: currentMonthFirst,
    currency: 'USD',
    fxRate: 1,
    commitAmount: 5000,
    rawUsageUsd: 3200,
    status: 'PENDING_INVOICE',
  });

  // Current-month usage so the in-progress progress bar shows real
  // motion: ~$3,200 spent across the first two weeks of the month
  // (well below the $5,000 commit so the bar stays in the "below
  // commit" state rather than overage).
  addCurrentMonthUsage({
    billingAccountId: acmeBaId,
    userId: acmeOwner.id,
    amountUsd: 1850,
    daysIntoMonth: 2,
  });
  addCurrentMonthUsage({
    billingAccountId: acmeBaId,
    userId: acmeOwner.id,
    amountUsd: 1350,
    daysIntoMonth: 5,
  });

  const acmeAssistant = createAssistant({
    userId: acmeOwner.id,
    orgId: acmeOrg.id,
    firstName: 'Acme',
    surname: 'Bot',
  });
  await seedChatInfrastructure({
    apiKey: acmeOrg.ownerOrgApiKey,
    userId: acmeOwner.id,
    assistantId: acmeAssistant.agentId,
    email: acmeOwner.email,
  });

  // ───────────────────────────────────────────────────────────────────────
  // 6. BritCo — METERED GBP with locked FX
  // ───────────────────────────────────────────────────────────────────────

  const britOwner = createUser({ name: 'Brit', lastName: 'Owner' });
  createEmailLogin({ userId: britOwner.id });
  const britOrg = createOrg({ name: 'BritCo', ownerId: britOwner.id, credits: 0 });
  const britBaId = billingAccountFor({ orgId: britOrg.id });
  setFakeStripeCustomer(britBaId, `brit_${britOrg.id}`);

  const britActive = assignPlan({
    billingAccountId: britBaId,
    templateId: enterpriseGbpId,
    startedAt: firstOfMonthsAgoIso(2),
    changeReason: 'UK regional pilot — billed in GBP',
    makeActive: true,
  });
  addMeteredRecharge({
    billingAccountId: britBaId,
    planAssignmentId: britActive,
    amountLocal: 4000,
    periodStart: firstOfMonthsAgoDate(2),
    currency: 'GBP',
    fxRate: 0.79,
    commitAmount: 4000,
    rawUsageUsd: 3800,
  });
  // Last month for BritCo: charge attempted, Stripe declined the
  // wire (e.g. customer's bank rejected). FAILED is the operator's
  // collection-action target on the admin invoices page.
  addMeteredRecharge({
    billingAccountId: britBaId,
    planAssignmentId: britActive,
    amountLocal: 4000,
    periodStart: firstOfMonthsAgoDate(1),
    currency: 'GBP',
    fxRate: 0.79,
    commitAmount: 4000,
    rawUsageUsd: 3500,
    status: 'FAILED',
  });

  // BritCo: pushed past the £4,000 commit this month so the progress
  // bar enters the "in overage" state with the amber tail.
  addCurrentMonthUsage({
    billingAccountId: britBaId,
    userId: britOwner.id,
    amountUsd: 4500,
    daysIntoMonth: 3,
  });
  addCurrentMonthUsage({
    billingAccountId: britBaId,
    userId: britOwner.id,
    amountUsd: 1100,
    daysIntoMonth: 6,
  });

  // ───────────────────────────────────────────────────────────────────────
  // 7. EuroCo — METERED EUR with SPOT FX
  // ───────────────────────────────────────────────────────────────────────

  const euroOwner = createUser({ name: 'Euro', lastName: 'Owner' });
  createEmailLogin({ userId: euroOwner.id });
  const euroOrg = createOrg({ name: 'EuroCo', ownerId: euroOwner.id, credits: 0 });
  const euroBaId = billingAccountFor({ orgId: euroOrg.id });
  setFakeStripeCustomer(euroBaId, `euro_${euroOrg.id}`);

  // Override `preferred_payment_method_types` to "wire only" so the
  // OrgPlanSection / admin payment-preferences endpoint shows a non-default
  // value. Mirrors what the new admin override flow writes.
  dbExec(
    `UPDATE billing_account SET preferred_payment_method_types = ARRAY['customer_balance']::varchar[] WHERE id = ${euroBaId};`
  );

  const euroActive = assignPlan({
    billingAccountId: euroBaId,
    templateId: enterpriseEurId,
    startedAt: firstOfMonthsAgoIso(2),
    changeReason: 'EU regional pilot — billed in EUR (spot FX)',
    makeActive: true,
  });

  // Last month: PAID — gives the admin invoices page a non-USD
  // historical row so currency rendering is exercised under
  // a paid state too (BritCo's last-month row is FAILED).
  // Commit is €3,000; SPOT FX uses ~1.10 USD→EUR for the seed.
  addMeteredRecharge({
    billingAccountId: euroBaId,
    planAssignmentId: euroActive,
    amountLocal: 3000,
    periodStart: firstOfMonthsAgoDate(1),
    currency: 'EUR',
    fxRate: 1.1,
    commitAmount: 3000,
    rawUsageUsd: 2400,
  });
  // Two months ago: customer disputed the charge (chargeback) — the
  // DISPUTED state. Distinct from FAILED (Stripe-side decline) and
  // useful for the admin invoices status filter.
  addMeteredRecharge({
    billingAccountId: euroBaId,
    planAssignmentId: euroActive,
    amountLocal: 3300,
    periodStart: firstOfMonthsAgoDate(2),
    currency: 'EUR',
    fxRate: 1.1,
    commitAmount: 3000,
    rawUsageUsd: 3000,
    status: 'DISPUTED',
  });

  // EuroCo: light current-month usage (~30% of commit) so the progress
  // bar shows a partially-filled state for the EUR variant.
  addCurrentMonthUsage({
    billingAccountId: euroBaId,
    userId: euroOwner.id,
    amountUsd: 950,
    daysIntoMonth: 4,
  });

  // ───────────────────────────────────────────────────────────────────────
  // 8. Plan groups — public ClientGamma ladder
  //
  // Three-rung ladder (Starter < Enterprise USD < Scale) so the
  // customer-facing Switch Plan section has both a downgrade and an
  // upgrade target relative to whichever rung the account sits on.
  // Acme is pinned to the middle rung; BritCo is intentionally NOT
  // assigned to the group so the seed exercises the "no
  // self-serve switching" code path next to the assigned one.
  // ───────────────────────────────────────────────────────────────────────

  const vantageLadderGroupId = createPlanGroup({
    name: 'clientgamma-public-ladder',
    displayName: 'ClientGamma Tiers',
    description:
      'Public ClientGamma ladder customers can self-serve switch between ' +
      '(Starter ⇄ Enterprise ⇄ Scale).',
  });
  addPlanGroupMember({
    groupId: vantageLadderGroupId,
    templateId: vantageStarterId,
    position: 0,
  });
  addPlanGroupMember({
    groupId: vantageLadderGroupId,
    templateId: enterpriseUsdId,
    position: 1,
  });
  addPlanGroupMember({
    groupId: vantageLadderGroupId,
    templateId: vantageScaleId,
    position: 2,
  });
  // Pin Acme on the middle rung so the Switch Plan UI shows
  // "Starter (downgrade) · Enterprise (current) · Scale (upgrade)".
  assignPlanGroupToAccount(acmeBaId, vantageLadderGroupId);

  // ───────────────────────────────────────────────────────────────────────
  // 9. Startup Inc — plain org on default (the "vanilla" admin row)
  // ───────────────────────────────────────────────────────────────────────

  const startupOwner = createUser({ name: 'Startup', lastName: 'Owner' });
  const startupMember = createUser({ name: 'Startup', lastName: 'Member' });
  createEmailLogin({ userId: startupOwner.id });
  createEmailLogin({ userId: startupMember.id });
  const startupOrg = createOrg({ name: 'Startup Inc', ownerId: startupOwner.id });
  const startupMemberKey = addMember({
    orgId: startupOrg.id,
    userId: startupMember.id,
    role: 'Member',
  });
  ensureDefaultPaygAssignment(billingAccountFor({ orgId: startupOrg.id }));

  // ───────────────────────────────────────────────────────────────────────
  // Result
  // ───────────────────────────────────────────────────────────────────────

  const users: Record<string, SeededUser> = {
    unify_admin: unifyAdmin,
    payg_user: paygUser,
    auto_user: autoUser,
    low_user: lowUser,
    pilot_user: pilotUser,
    vantage_owner: vantageOwner,
    acme_owner: acmeOwner,
    brit_owner: britOwner,
    euro_owner: euroOwner,
    startup_owner: startupOwner,
    startup_member: startupMember,
  };

  // For each user the `apiKey` slot uses the *org-scoped* key when the
  // user belongs to an org (Unify admin, org owners) so that switching
  // into them lands on a billing account that exposes the org's plan.
  // Personal users use their personal apiKey.
  const credentials: SeededState['credentials'] = {
    unify_admin: {
      email: unifyAdmin.email,
      password: 'testpass123',
      apiKey: unifyOrg.ownerOrgApiKey,
      userId: unifyAdmin.id,
    },
    payg_user: cred(paygUser),
    auto_user: cred(autoUser),
    low_user: cred(lowUser),
    pilot_user: cred(pilotUser),
    vantage_owner: {
      email: vantageOwner.email,
      password: 'testpass123',
      apiKey: vantageOrg.ownerOrgApiKey,
      userId: vantageOwner.id,
    },
    acme_owner: {
      email: acmeOwner.email,
      password: 'testpass123',
      apiKey: acmeOrg.ownerOrgApiKey,
      userId: acmeOwner.id,
    },
    brit_owner: {
      email: britOwner.email,
      password: 'testpass123',
      apiKey: britOrg.ownerOrgApiKey,
      userId: britOwner.id,
    },
    euro_owner: {
      email: euroOwner.email,
      password: 'testpass123',
      apiKey: euroOrg.ownerOrgApiKey,
      userId: euroOwner.id,
    },
    startup_owner: {
      email: startupOwner.email,
      password: 'testpass123',
      apiKey: startupOrg.ownerOrgApiKey,
      userId: startupOwner.id,
    },
    startup_member: {
      email: startupMember.email,
      password: 'testpass123',
      apiKey: startupMemberKey,
      userId: startupMember.id,
    },
  };

  // Pin the Unify org as the "primary" org returned in `state.org` so
  // the runner banner highlights the admin entry point.
  const primaryOrg: SeededOrg = unifyOrg;

  return {
    users,
    org: primaryOrg,
    assistants: [vantageAssistant, acmeAssistant],
    credentials,
  };
}

function cred(user: SeededUser): SeededState['credentials'][string] {
  return {
    email: user.email,
    password: 'testpass123',
    apiKey: user.apiKey,
    userId: user.id,
  };
}
