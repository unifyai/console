/**
 * Admin Billing Plans + Stripe Customer Server Actions
 *
 * Wraps Orchestra admin endpoints for managed-billing:
 *  - Catalog browsing / creation / deprecation of `BillingPlanTemplate` rows.
 *  - Plan assignment / change / cancellation per billing account.
 *  - Stripe Customer eager provisioning.
 *
 * Per-template FX policy replaced the legacy FX-snapshot table — see
 * the comment at the bottom of this file. Metered-invoicer triggers
 * are intentionally not exposed here: the monthly bulk run is owned
 * by Cloud Scheduler → Cloud Run job (no admin HTTP surface), and the
 * per-account replay endpoint is used directly from ops scripts /
 * Python shells (no UI consumer).
 *
 * Server-only: all actions hit the orchestra admin surface using
 * `ORCHESTRA_ADMIN_KEY` and are never exposed to the browser bundle.
 */

'use server';

import { snakeToCamelObject } from '@/utils/casing';
import { formatValidationDetail } from '@/utils/orchestra-error';
import { requireUnifyAdmin } from '@/lib/admin/_guard';
import type {
  AdminBillingPlanTemplate,
  AdminBillingPlanTemplateCreate,
  AdminActivePlanResponse,
  AdminPlanHistoryResponse,
  AdminStripeCustomerResponse,
} from '@/types/admin';
import type { ResponseProps } from '@/types/common';

const backendUrl = `${process.env.ORCHESTRA_URL}/v0`;
const adminKey = process.env.ORCHESTRA_ADMIN_KEY;

const adminHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  Authorization: `Bearer ${adminKey}`,
};

/**
 * Shared fetch wrapper with the same error contract as other admin
 * action files: returns the parsed JSON (camel-cased) on 2xx, or
 * `{ detail, status }` on any non-2xx / network error so the caller
 * can branch via the standard `'detail' in result` check.
 */
const safeFetch = async (url: string, options: RequestInit, context: string): Promise<unknown> => {
  try {
    const response = await fetch(url, { ...options, cache: 'no-store' });
    if (response.status === 204) return {};

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        const detail =
          formatValidationDetail(data.detail) ||
          data.error ||
          `Operation failed: ${response.statusText}`;
        return { detail, status: response.status };
      }
      // Recursively snake → camel; Array support is built-in.
      if (Array.isArray(data)) {
        return data.map((row) => snakeToCamelObject(row as Record<string, unknown>));
      }
      return snakeToCamelObject(data as Record<string, unknown>);
    }

    if (!response.ok) return { detail: response.statusText, status: response.status };
    return {};
  } catch (error) {
    console.error(`[admin/billing-plans ${context}] Error:`, error);
    const message = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: message, status: 500 };
  }
};

// ---------------------------------------------------------------------------
// Plan templates (catalog)
// ---------------------------------------------------------------------------

/**
 * Options for the catalog list. Both axes are orthogonal:
 * - `includeCustom` — undefined = both, true = custom-only,
 *                     false = catalog-only (the default).
 * - `includeInactive` — false = active rows only (default),
 *                       true = also return deprecated rows.
 */
interface ListTemplatesOptions {
  includeCustom?: boolean;
  includeInactive?: boolean;
}

export async function listBillingTemplatesAction(
  options?: ListTemplatesOptions
): Promise<AdminBillingPlanTemplate[] | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  const params = new URLSearchParams();
  if (options?.includeCustom !== undefined) {
    params.set('include_custom', String(options.includeCustom));
  }
  if (options?.includeInactive) {
    params.set('include_inactive', 'true');
  }
  const qs = params.toString();
  return safeFetch(
    `${backendUrl}/admin/billing/plans/templates${qs ? `?${qs}` : ''}`,
    { method: 'GET', headers: adminHeaders },
    'listBillingTemplates'
  ) as Promise<AdminBillingPlanTemplate[] | ResponseProps>;
}

export async function createBillingTemplateAction(
  body: AdminBillingPlanTemplateCreate
): Promise<AdminBillingPlanTemplate | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  /* eslint-disable @typescript-eslint/naming-convention */
  const payload: Record<string, unknown> = {
    name: body.name,
    display_name: body.displayName ?? null,
    billing_mode: body.billingMode,
    is_custom: body.isCustom ?? false,
    is_active: body.isActive ?? true,
    description: body.description ?? null,
    commit_amount: body.commitAmount ?? null,
    currency: body.currency ?? 'USD',
    commit_period: body.commitPeriod ?? null,
    commit_schedule: body.commitSchedule ?? null,
    base_pricing_factor: body.basePricingFactor ?? 1.0,
    overage_pricing_factor: body.overagePricingFactor ?? 1.0,
    collection_method: body.collectionMethod ?? 'AUTO_CARD',
    proration_policy: body.prorationPolicy ?? 'PRORATE',
    credits_rollover_policy: body.creditsRolloverPolicy ?? null,
    fx_policy: body.fxPolicy ?? null,
    fx_locked_rate: body.fxLockedRate ?? null,
    supersedes_template_id: body.supersedesTemplateId ?? null,
    created_by_user_id: body.createdByUserId ?? null,
  };
  /* eslint-enable @typescript-eslint/naming-convention */
  return safeFetch(
    `${backendUrl}/admin/billing/plans/templates`,
    { method: 'POST', headers: adminHeaders, body: JSON.stringify(payload) },
    'createBillingTemplate'
  ) as Promise<AdminBillingPlanTemplate | ResponseProps>;
}

export async function deprecateBillingTemplateAction(templateId: number): Promise<ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  return safeFetch(
    `${backendUrl}/admin/billing/plans/templates/${templateId}/deprecate`,
    { method: 'POST', headers: adminHeaders },
    'deprecateBillingTemplate'
  ) as Promise<ResponseProps>;
}

// ---------------------------------------------------------------------------
// Per-account plan management
// ---------------------------------------------------------------------------

export async function getActivePlanAction(
  orgId: number
): Promise<AdminActivePlanResponse | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  return safeFetch(
    `${backendUrl}/admin/billing/plans/active?organization_id=${orgId}`,
    { method: 'GET', headers: adminHeaders },
    'getActivePlan'
  ) as Promise<AdminActivePlanResponse | ResponseProps>;
}

export async function getPlanHistoryAction(
  orgId: number
): Promise<AdminPlanHistoryResponse | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  return safeFetch(
    `${backendUrl}/admin/billing/plans/history?organization_id=${orgId}`,
    { method: 'GET', headers: adminHeaders },
    'getPlanHistory'
  ) as Promise<AdminPlanHistoryResponse | ResponseProps>;
}

interface SetPlanOptions {
  effectiveAt?: string;
  changeReason?: string;
}

/**
 * Server action wrapping `POST /admin/billing/plans/set` — the single
 * endpoint that covers every plan transition (pristine→template,
 * template A→template B, non-default→DEFAULT_TEMPLATE ≡ "cancel").
 *
 * Pass `templateId = DEFAULT_TEMPLATE_ID` (= 1) to "cancel" — the
 * `change_reason` becomes the audit trail for *why* the previous plan
 * was closed (no separate cancellation columns).
 *
 * Returns `{ status: 'ok' | 'noop', billing_account_id, assignment? }`.
 * `noop` is sent when the account is already on `templateId`.
 */
export async function setPlanAction(
  orgId: number,
  templateId: number,
  options?: SetPlanOptions
): Promise<ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  /* eslint-disable @typescript-eslint/naming-convention */
  const body = {
    organization_id: orgId,
    template_id: templateId,
    effective_at: options?.effectiveAt ?? null,
    change_reason: options?.changeReason ?? null,
  };
  /* eslint-enable @typescript-eslint/naming-convention */
  return safeFetch(
    `${backendUrl}/admin/billing/plans/set`,
    { method: 'POST', headers: adminHeaders, body: JSON.stringify(body) },
    'setPlan'
  ) as Promise<ResponseProps>;
}

// ---------------------------------------------------------------------------
// Stripe Customer provisioning
// ---------------------------------------------------------------------------

export async function ensureStripeCustomerAction(
  orgId: number,
  options?: { fallbackEmail?: string; fallbackName?: string; isBusiness?: boolean }
): Promise<AdminStripeCustomerResponse | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  /* eslint-disable @typescript-eslint/naming-convention */
  const body = {
    organization_id: orgId,
    fallback_email: options?.fallbackEmail ?? null,
    fallback_name: options?.fallbackName ?? null,
    is_business: options?.isBusiness ?? null,
  };
  /* eslint-enable @typescript-eslint/naming-convention */
  return safeFetch(
    `${backendUrl}/admin/billing/stripe-customer`,
    { method: 'POST', headers: adminHeaders, body: JSON.stringify(body) },
    'ensureStripeCustomer'
  ) as Promise<AdminStripeCustomerResponse | ResponseProps>;
}

// FX rates: per-template ``fx_policy`` replaced the daily-snapshot table.
// The create-template dialog now collects fx_policy + fx_locked_rate
// directly on the BillingPlanTemplate; SPOT / PERIOD_AVERAGE policies
// resolve via Frankfurter at invoice time. See FxPolicy in
// orchestra.db.models.enums.

// ---------------------------------------------------------------------------
// Plan groups (curated bundles of switchable templates)
// ---------------------------------------------------------------------------
//
// Wraps the admin /v0/admin/billing/plans/groups* surface. Plan
// groups scope the customer-facing self-serve switch endpoint
// (POST /v0/billing/plan); admins manage the catalog here without
// the customer ever calling these. URL prefix mirrors templates
// (/billing/plans/templates/*) so all plan-catalog ops live under
// the same root.

export interface AdminPlanGroupSummary {
  id: number;
  name: string;
  displayName: string | null;
  isActive: boolean;
  memberCount: number;
}

export interface AdminPlanGroupMember {
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
  members: AdminPlanGroupMember[];
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

export interface AdminAssignPlanGroupResponse {
  billingAccountId: number;
  planGroupId: number;
  planGroupName: string | null;
}

export async function listPlanGroupsAction(options?: {
  includeInactive?: boolean;
}): Promise<AdminPlanGroupListResponse | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  const params = new URLSearchParams();
  if (options?.includeInactive) {
    params.set('include_inactive', 'true');
  }
  const qs = params.toString();
  return safeFetch(
    `${backendUrl}/admin/billing/plans/groups${qs ? `?${qs}` : ''}`,
    { method: 'GET', headers: adminHeaders },
    'listPlanGroups'
  ) as Promise<AdminPlanGroupListResponse | ResponseProps>;
}

export async function getPlanGroupAction(
  groupId: number
): Promise<AdminPlanGroupDetail | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  return safeFetch(
    `${backendUrl}/admin/billing/plans/groups/${groupId}`,
    { method: 'GET', headers: adminHeaders },
    'getPlanGroup'
  ) as Promise<AdminPlanGroupDetail | ResponseProps>;
}

export async function createPlanGroupAction(
  body: AdminPlanGroupCreatePayload
): Promise<AdminPlanGroupDetail | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  /* eslint-disable @typescript-eslint/naming-convention */
  const payload: Record<string, unknown> = {
    name: body.name,
    display_name: body.displayName ?? null,
    description: body.description ?? null,
    is_active: body.isActive ?? true,
  };
  /* eslint-enable @typescript-eslint/naming-convention */
  return safeFetch(
    `${backendUrl}/admin/billing/plans/groups`,
    { method: 'POST', headers: adminHeaders, body: JSON.stringify(payload) },
    'createPlanGroup'
  ) as Promise<AdminPlanGroupDetail | ResponseProps>;
}

export async function updatePlanGroupAction(
  groupId: number,
  body: AdminPlanGroupUpdatePayload
): Promise<AdminPlanGroupDetail | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  /* eslint-disable @typescript-eslint/naming-convention */
  const payload: Record<string, unknown> = {};
  if (body.displayName !== undefined) payload.display_name = body.displayName;
  if (body.description !== undefined) payload.description = body.description;
  if (body.isActive !== undefined) payload.is_active = body.isActive;
  /* eslint-enable @typescript-eslint/naming-convention */
  return safeFetch(
    `${backendUrl}/admin/billing/plans/groups/${groupId}`,
    { method: 'PATCH', headers: adminHeaders, body: JSON.stringify(payload) },
    'updatePlanGroup'
  ) as Promise<AdminPlanGroupDetail | ResponseProps>;
}

export async function addPlanGroupMemberAction(
  groupId: number,
  templateId: number,
  position?: number | null
): Promise<AdminPlanGroupDetail | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  /* eslint-disable @typescript-eslint/naming-convention */
  const payload = {
    template_id: templateId,
    position: position ?? null,
  };
  /* eslint-enable @typescript-eslint/naming-convention */
  return safeFetch(
    `${backendUrl}/admin/billing/plans/groups/${groupId}/members`,
    { method: 'POST', headers: adminHeaders, body: JSON.stringify(payload) },
    'addPlanGroupMember'
  ) as Promise<AdminPlanGroupDetail | ResponseProps>;
}

export async function removePlanGroupMemberAction(
  groupId: number,
  templateId: number
): Promise<AdminPlanGroupDetail | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  return safeFetch(
    `${backendUrl}/admin/billing/plans/groups/${groupId}/members/${templateId}`,
    { method: 'DELETE', headers: adminHeaders },
    'removePlanGroupMember'
  ) as Promise<AdminPlanGroupDetail | ResponseProps>;
}

export async function setPlanGroupPositionsAction(
  groupId: number,
  positions: Array<{ templateId: number; position: number | null }>
): Promise<AdminPlanGroupDetail | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  /* eslint-disable @typescript-eslint/naming-convention */
  const payload = {
    positions: positions.map((p) => ({
      template_id: p.templateId,
      position: p.position,
    })),
  };
  /* eslint-enable @typescript-eslint/naming-convention */
  return safeFetch(
    `${backendUrl}/admin/billing/plans/groups/${groupId}/positions`,
    { method: 'PUT', headers: adminHeaders, body: JSON.stringify(payload) },
    'setPlanGroupPositions'
  ) as Promise<AdminPlanGroupDetail | ResponseProps>;
}

/**
 * Assigns the plan_group on a billing account. Every account is
 * always on some group (NOT NULL — see DEFAULT_PLAN_GROUP_ID = 1);
 * to revert an account to the platform default, pass `groupId = 1`.
 * This does NOT change the active plan — use `setPlanAction`
 * separately to do that. The customer-facing switcher hides itself
 * automatically when the active template isn't a member of the
 * assigned group, so picking a group without first reassigning the
 * plan is harmless.
 */
export async function assignPlanGroupToOrgAction(
  orgId: number,
  groupId: number
): Promise<AdminAssignPlanGroupResponse | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  /* eslint-disable @typescript-eslint/naming-convention */
  const payload = { group_id: groupId };
  /* eslint-enable @typescript-eslint/naming-convention */
  return safeFetch(
    `${backendUrl}/admin/billing/accounts/plan-group?organization_id=${orgId}`,
    { method: 'PUT', headers: adminHeaders, body: JSON.stringify(payload) },
    'assignPlanGroupToOrg'
  ) as Promise<AdminAssignPlanGroupResponse | ResponseProps>;
}
