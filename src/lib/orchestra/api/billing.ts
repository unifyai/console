/**
 * Billing-related Orchestra API calls
 *
 * This file consolidates all direct Orchestra calls for billing, credits, and recharges.
 * Uses the admin Axios client because these endpoints are not in the public OpenAPI spec.
 */
'use server';

import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

// =============================================================================
// Types
// =============================================================================

export interface AutoRechargeEligibility {
  userId: string;
  totalSpending: number;
  canEnableAutoRecharge: boolean;
  minimumSpendRequired: number;
  remainingSpendNeeded: number;
}

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

/**
 * Enables or disables the auto-recharge feature for a billing account.
 *
 * Supports both personal (user_id) and organization (organization_id) contexts.
 *
 * @param enabled - Whether auto-recharge should be enabled or disabled.
 * @param opts.userId - User ID (for personal billing accounts).
 * @param opts.organizationId - Organization ID (for org billing accounts).
 * @throws Will throw an error if the auto-recharge status update fails.
 */
export async function enableAutoRecharge(
  enabled: boolean,
  opts: { userId?: string; organizationId?: number }
) {
  const params: Record<string, string | boolean> = { enable: enabled };
  if (opts.userId) params.user_id = opts.userId;
  if (opts.organizationId) params.organization_id = String(opts.organizationId);

  const response = await OrchestraAdminClient.put('/enable_autorecharge', null, { params });
  return response.data;
}

/**
 * Sets the auto-recharge threshold for a billing account.
 *
 * Supports both personal (user_id) and organization (organization_id) contexts.
 *
 * @param threshold - The threshold amount.
 * @param opts.userId - User ID (for personal billing accounts).
 * @param opts.organizationId - Organization ID (for org billing accounts).
 * @throws Will throw an error if the auto-recharge threshold update fails.
 */
export async function setAutoRechargeThreshold(
  threshold: number,
  opts: { userId?: string; organizationId?: number }
) {
  const params: Record<string, string | number> = { threshold };
  if (opts.userId) params.user_id = opts.userId;
  if (opts.organizationId) params.organization_id = String(opts.organizationId);

  const response = await OrchestraAdminClient.put('/autorecharge_threshold', null, { params });
  return response.data;
}

/**
 * Sets the auto-recharge amount for a billing account.
 *
 * Supports both personal (user_id) and organization (organization_id) contexts.
 *
 * @param amount - The recharge amount.
 * @param opts.userId - User ID (for personal billing accounts).
 * @param opts.organizationId - Organization ID (for org billing accounts).
 * @throws Will throw an error if the auto-recharge amount update fails.
 * @returns The response from the API call.
 */
export async function setAutoRechargeQty(
  amount: number,
  opts: { userId?: string; organizationId?: number }
) {
  const params: Record<string, string | number> = { qty: amount };
  if (opts.userId) params.user_id = opts.userId;
  if (opts.organizationId) params.organization_id = String(opts.organizationId);

  const response = await OrchestraAdminClient.put('/autorecharge_qty', null, { params });
  return response.data;
}

/**
 * Checks if a billing account is eligible to enable automatic refills.
 *
 * Accounts must have spent at least the minimum threshold in real-money
 * transactions before they can enable auto-recharge.  This is a
 * fraud-prevention measure to stop bot accounts from setting up very low,
 * repeated automatic top-ups and then disputing the charges.
 *
 * Supports both user (personal) and organization billing accounts.
 *
 * @param userID - The user ID (for personal billing accounts).
 * @param organizationId - The organization ID (for org billing accounts).
 * @returns Auto-recharge eligibility information including spending details.
 */
export async function getAutoRechargeEligibility(
  userID?: string,
  organizationId?: number
): Promise<AutoRechargeEligibility> {
  const params: Record<string, string> = {};
  if (userID) params.user_id = userID;
  if (organizationId) params.organization_id = String(organizationId);

  const response = await OrchestraAdminClient.get('/billing_eligibility', {
    params,
  });
  return response.data as AutoRechargeEligibility;
}
