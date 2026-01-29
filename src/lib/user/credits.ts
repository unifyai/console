'use server';

/**
 * User credit operations.
 *
 * This module provides functions to check and deduct credits from user accounts
 * for billable operations. These functions use the user's API key to ensure
 * credits are billed to the correct account.
 *
 * Credits are deducted from the billing user associated with the API key:
 * - Personal workspace: User's own account
 * - Organization workspace: Organization's billing_user_id account
 *
 * Note: For admin-level billing operations (using ORCHESTRA_ADMIN_KEY),
 * see '@/lib/orchestra/api/billing' instead.
 */

import { createOrchestraClient } from '@/lib/orchestra/client';

// =============================================================================
// Types
// =============================================================================

/**
 * Response from the credits balance endpoint.
 */
export interface CreditsBalanceResponse {
  id: string;
  credits: number;
}

/**
 * Response from the credits deduction endpoint.
 */
export interface CreditsDeductResponse {
  previousCredits: number;
  deducted: number;
  currentCredits: number;
}

/**
 * Error response from credits operations.
 */
export interface CreditsError {
  detail: string;
}

/**
 * Result of a credit check operation.
 */
export interface CheckCreditsResult {
  hasSufficientCredits: boolean;
  currentBalance: number;
  error?: string;
}

/**
 * Result of a credit deduction operation.
 */
export interface DeductCreditsResult {
  success: boolean;
  previousCredits?: number;
  deducted?: number;
  currentCredits?: number;
  error?: string;
}

// =============================================================================
// Credit Operations (User Context)
// =============================================================================

/**
 * Check if the user has sufficient credits for an operation.
 *
 * Uses the user's API key to query credits, ensuring the correct
 * account is checked (personal or organization billing user).
 *
 * @param apiKey - The user's API key (personal or org)
 * @param requiredAmount - The amount of credits needed
 * @returns CheckCreditsResult with balance information
 */
export async function checkCreditsBalance(
  apiKey: string,
  requiredAmount: number
): Promise<CheckCreditsResult> {
  try {
    const client = createOrchestraClient(apiKey);

    const { data, error } = await client.GET('/v0/credits');

    if (error) {
      const errorDetail =
        (error as unknown as CreditsError)?.detail || 'Failed to check credits balance';
      return {
        hasSufficientCredits: false,
        currentBalance: 0,
        error: errorDetail,
      };
    }

    const creditsData = data as unknown as CreditsBalanceResponse;
    const currentBalance = creditsData?.credits ?? 0;

    return {
      hasSufficientCredits: currentBalance >= requiredAmount,
      currentBalance,
    };
  } catch (error) {
    console.error('[credits.ts checkCreditsBalance] Error:', error);
    return {
      hasSufficientCredits: false,
      currentBalance: 0,
      error: error instanceof Error ? error.message : 'Unknown error checking credits',
    };
  }
}

/**
 * Deduct credits from the user's account.
 *
 * Uses the user's API key to deduct credits, ensuring the correct
 * account is charged (personal or organization billing user).
 *
 * @param apiKey - The user's API key (personal or org)
 * @param amount - The amount of credits to deduct (must be positive)
 * @returns DeductCreditsResult with deduction details
 */
export async function deductCredits(apiKey: string, amount: number): Promise<DeductCreditsResult> {
  if (amount <= 0) {
    return {
      success: false,
      error: 'Amount must be positive',
    };
  }

  try {
    const client = createOrchestraClient(apiKey);

    const { data, error, response } = await client.POST('/v0/credits/deduct', {
      body: { amount },
    });

    if (error) {
      const errorDetail = (error as unknown as CreditsError)?.detail || 'Failed to deduct credits';

      // Check for insufficient credits (400 status)
      if (response?.status === 400 && errorDetail.includes('Insufficient')) {
        return {
          success: false,
          error: 'INSUFFICIENT_CREDITS',
        };
      }

      return {
        success: false,
        error: errorDetail,
      };
    }

    const deductData = data as unknown as CreditsDeductResponse;

    return {
      success: true,
      previousCredits: deductData.previousCredits,
      deducted: deductData.deducted,
      currentCredits: deductData.currentCredits,
    };
  } catch (error) {
    console.error('[credits.ts deductCredits] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error deducting credits',
    };
  }
}
