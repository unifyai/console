import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { getBalance } from '@/lib/billing/billing';
import { isBillingError } from '@/types/billing';

const BALANCE_FETCH_MAX_ATTEMPTS = 2;
const BALANCE_FETCH_RETRY_DELAY_MS = 250;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns the billing status for the active workspace's billing account.
 *
 * Delegates to the shared `getBalance` server action factory so the
 * transform logic (credits → formatted balance) lives in one place.
 *
 * Response shape:
 *   - balance: formatted string (e.g. "25.00")
 *   - fullBalance: raw number
 *   - lastRechargeAt: ISO-8601 timestamp of last paid recharge, or null
 *   - accountStatus: ACTIVE, PAST_DUE, SUSPENDED, or CLOSED
 *   - billingMode: CREDITS | METERED (managed-billing discriminator)
 *   - plan: CurrentPlanSummary | null (active plan summary)
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);

  if (!apiKey) {
    return unauthorized();
  }

  try {
    let latestError = 'Failed to fetch billing details';

    for (let attempt = 1; attempt <= BALANCE_FETCH_MAX_ATTEMPTS; attempt += 1) {
      const result = await getBalance();
      if (!isBillingError(result)) {
        return NextResponse.json(result);
      }

      latestError = result.detail;
      if (attempt < BALANCE_FETCH_MAX_ATTEMPTS) {
        await wait(BALANCE_FETCH_RETRY_DELAY_MS * attempt);
      }
    }

    return NextResponse.json({ error: latestError }, { status: 500 });
  } catch (error: any) {
    console.error('Error fetching billing balance:', error?.message || error);
    return NextResponse.json({ error: 'Error fetching billing details' }, { status: 500 });
  }
}
