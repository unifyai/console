import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getRecharges, isDuplicateCard } from '@/lib/user/billing/billing';
import { getUserCards } from '@/lib/user/billing/billing';
import { createRecharge } from '@/lib/user/billing/billing';


export async function GET(request: NextRequest) {
    const user = await getCurrentUser();

    if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const freeRecharges = await getRecharges(user.id, undefined, undefined, undefined, "free");
    const userCardsResponse = await getUserCards(user.id);
    const userCards = await userCardsResponse;

    if (freeRecharges.length > 0 || userCards.length == 0) {
        return NextResponse.json({ success:"User Does not qualify for free credits" }, { status: 400 });
    }

    // check if the user is using a duplicate card
    for ( const card of userCards) {
        if (await isDuplicateCard(card.user_id, card.fingerprint)) {
            return NextResponse.json({success: "Duplicate card found" }, { status: 400 });
        }
    }

    // create the recharge
    const recharge = await createRecharge(
        user.id,
        5, // 5 credits
        "free",
        ""
    );

    if (recharge.status !== 200) {
        return NextResponse.json({ success: false, message: "Failed to create recharge" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Recharge created successfully" }, { status: 200 });
}