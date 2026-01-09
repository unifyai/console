import { NextRequest, NextResponse } from 'next/server';
import { getUserBillingDetails } from '@/lib/user/billing/billing';
import { getCurrentUser } from '@/lib/user/user';
import { enableAutoRecharge, setAutoRechargeQty, setAutoRechargeThreshold } from '@/lib/user/billing/billing';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {

    const billingDetailsRet = await getUserBillingDetails(user.id as string)

    if (!billingDetailsRet) {
      return NextResponse.json({ error: "No billing details found" }, { status: 404 });
    }

    const billingDetails = billingDetailsRet[0]

    const autoRechargeEnabled = billingDetails.autorecharge;
    const autoRechargeThreshold = billingDetails.autorechargeThreshold;
    const autoRechargeQty = billingDetails.autorechargeQty;

    return NextResponse.json({ autoRechargeEnabled, autoRechargeThreshold, autoRechargeQty })

  } catch (error) {
    console.error('Error fetching billing details:', error);
    return NextResponse.json({ error: 'Error fetching billing details' }, { status: 500 });
  }
}


export async function POST(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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

    // Handle each API call individually to catch specific errors
    try {
      await enableAutoRecharge(user.id, autoRechargeEnabled);
    } catch (enableError: any) {
      console.error('Error enabling auto-recharge:', enableError);
      console.error('Error response status:', enableError.response?.status);
      console.error('Error response data:', enableError.response?.data);
      
      if (enableError.response?.status === 400) {
        return NextResponse.json({ 
          error: enableError.response.data?.detail || 'Failed to enable auto-recharge due to eligibility requirements'
        }, { status: 400 });
      }
      // If not a 400 error, re-throw to be caught by outer catch
      throw enableError;
    }

    try {
      await setAutoRechargeThreshold(user.id, autoRechargeThreshold);
    } catch (thresholdError: any) {
      console.error('Error setting auto-recharge threshold:', thresholdError);
      console.error('Threshold error response status:', thresholdError.response?.status);
      console.error('Threshold error response data:', thresholdError.response?.data);
      
      if (thresholdError.response?.status === 400) {
        return NextResponse.json({ 
          error: thresholdError.response.data?.detail || 'Failed to set auto-recharge threshold'
        }, { status: 400 });
      }
      throw thresholdError;
    }

    try {
      await setAutoRechargeQty(user.id, autoRechargeQty);
    } catch (qtyError: any) {
      console.error('Error setting auto-recharge quantity:', qtyError);
      console.error('Qty error response status:', qtyError.response?.status);
      console.error('Qty error response data:', qtyError.response?.data);
      
      if (qtyError.response?.status === 400) {
        return NextResponse.json({ 
          error: qtyError.response.data?.detail || 'Failed to set auto-recharge quantity'
        }, { status: 400 });
      }
      throw qtyError;
    }

    return NextResponse.json({ message: 'Auto-recharge settings updated successfully' });
  } catch (error: any) {
    console.error('Error updating auto-recharge settings:', error);
    return NextResponse.json({ 
      error: error.response?.data?.detail || 'Error updating auto-recharge settings'
    }, { status: 500 });
  }
}

    