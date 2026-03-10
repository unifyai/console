/**
 * Billing-related Orchestra API calls
 *
 * This file consolidates all direct Orchestra calls for billing, credits, and recharges.
 * Uses the admin Axios client because these endpoints are not in the public OpenAPI spec.
 *
 * NOTE: Auto-recharge functions have been removed. The frontend API routes now
 * call the backend user-key-authenticated endpoints directly via
 * getOrchestraUserClient instead of these admin wrappers.
 */
'use server';

import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

// =============================================================================
// Types
// =============================================================================

/**
 * Billing account info returned by the /billing/account-info admin endpoint.
 * Works for both user (personal) and organization billing accounts.
 */
export interface BillingAccountInfo {
  billingAccountId: number;
  stripeCustomerId: string | null;
  credits: number;
  autorecharge: boolean;
  autorechargeThreshold: number;
  autorechargeQty: number;
  accountStatus: string;
  userId?: string;
  organizationId?: number;
}

// =============================================================================
// Billing Functions
// =============================================================================

/**
 * Retrieves billing account info for a user or organization.
 *
 * This is the preferred way to get billing details — it calls the
 * `/billing/account-info` admin endpoint which resolves the BillingAccount
 * for either a user_id or organization_id.
 *
 * @param params.userId - User ID (for personal billing accounts)
 * @param params.organizationId - Organization ID (for org billing accounts)
 * @returns Billing account info including stripe_customer_id, credits, etc.
 */
export async function getBillingAccountInfo(params: {
  userId?: string;
  organizationId?: number;
}): Promise<BillingAccountInfo> {
  const queryParams: Record<string, string> = {};
  if (params.userId) queryParams.user_id = params.userId;
  if (params.organizationId) queryParams.organization_id = String(params.organizationId);

  const response = await OrchestraAdminClient.get('/billing/account-info', {
    params: queryParams,
  });

  return response.data as BillingAccountInfo;
}
