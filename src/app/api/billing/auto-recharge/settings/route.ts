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
    const autoRechargeThreshold = billingDetails.autorecharge_threshold;
    const autoRechargeQty = billingDetails.autorecharge_qty;

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

    await enableAutoRecharge(user.id, autoRechargeEnabled);
    await setAutoRechargeThreshold(user.id, autoRechargeThreshold);
    await setAutoRechargeQty(user.id, autoRechargeQty);

    return NextResponse.json({ message: 'Auto-recharge settings updated successfully' });
  } catch (error) {
    console.error('Error updating auto-recharge settings:', error);
    return NextResponse.json({ error: 'Error updating auto-recharge settings' }, { status: 500 });
  }
}

    