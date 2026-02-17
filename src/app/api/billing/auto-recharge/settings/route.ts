import { NextRequest, NextResponse } from 'next/server';
import { getBillingAccountInfo } from '@/lib/user/billing/billing';
import {
  enableAutoRecharge,
  setAutoRechargeQty,
  setAutoRechargeThreshold,
} from '@/lib/user/billing/billing';
import { getWorkspaceBillingContext } from '../../../_utils/auth';

/**
 * Resolves billing entity params ({ userId } or { organizationId }) from the workspace context.
 */
function billingEntityParams(ctx: NonNullable<Awaited<ReturnType<typeof getWorkspaceBillingContext>>>) {
  return ctx.type === 'organization'
    ? { organizationId: ctx.organizationId }
    : { userId: ctx.userId };
}

/**
 * GET: Returns auto-recharge settings for the active workspace's billing account.
 */
export async function GET(request: NextRequest) {
  const ctx = await getWorkspaceBillingContext();

  if (!ctx) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const billingInfo = await getBillingAccountInfo(billingEntityParams(ctx));

    return NextResponse.json({
      autoRechargeEnabled: billingInfo.autorecharge,
      autoRechargeThreshold: billingInfo.autorechargeThreshold,
      autoRechargeQty: billingInfo.autorechargeQty,
    });
  } catch (error) {
    console.error('Error fetching auto-recharge settings:', error);
    return NextResponse.json({ error: 'Error fetching billing details' }, { status: 500 });
  }
}

/**
 * POST: Updates auto-recharge settings for the active workspace's billing account.
 */
export async function POST(request: NextRequest) {
  const ctx = await getWorkspaceBillingContext();

  if (!ctx) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { autoRechargeEnabled, autoRechargeThreshold, autoRechargeQty } = body;

    if (typeof autoRechargeEnabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    if (typeof autoRechargeThreshold !== 'number' || autoRechargeThreshold <= 0) {
      return NextResponse.json({ error: 'Invalid threshold value' }, { status: 400 });
    }

    if (typeof autoRechargeQty !== 'number' || autoRechargeQty <= 0) {
      return NextResponse.json({ error: 'Invalid quantity value' }, { status: 400 });
    }

    const entityParams = billingEntityParams(ctx);

    try {
      await enableAutoRecharge(autoRechargeEnabled, entityParams);
    } catch (enableError: any) {
      console.error('Error enabling auto-recharge:', enableError);
      if (enableError.response?.status === 400) {
        return NextResponse.json(
          {
            error:
              enableError.response.data?.detail ||
              'Failed to enable auto-recharge due to eligibility requirements',
          },
          { status: 400 }
        );
      }
      throw enableError;
    }

    try {
      await setAutoRechargeThreshold(autoRechargeThreshold, entityParams);
    } catch (thresholdError: any) {
      console.error('Error setting auto-recharge threshold:', thresholdError);
      if (thresholdError.response?.status === 400) {
        return NextResponse.json(
          {
            error: thresholdError.response.data?.detail || 'Failed to set auto-recharge threshold',
          },
          { status: 400 }
        );
      }
      throw thresholdError;
    }

    try {
      await setAutoRechargeQty(autoRechargeQty, entityParams);
    } catch (qtyError: any) {
      console.error('Error setting auto-recharge quantity:', qtyError);
      if (qtyError.response?.status === 400) {
        return NextResponse.json(
          {
            error: qtyError.response.data?.detail || 'Failed to set auto-recharge quantity',
          },
          { status: 400 }
        );
      }
      throw qtyError;
    }

    return NextResponse.json({ message: 'Auto-recharge settings updated successfully' });
  } catch (error: any) {
    console.error('Error updating auto-recharge settings:', error);
    return NextResponse.json(
      {
        error: error.response?.data?.detail || 'Error updating auto-recharge settings',
      },
      { status: 500 }
    );
  }
}
