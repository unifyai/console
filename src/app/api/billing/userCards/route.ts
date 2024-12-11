import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getUserCards, storeUserCard } from '@/lib/user/billing/billing';


/**
 * Returns the list of cards associated with the user as an array of their
 * fingerprint IDs.
 * @param request - The NextRequest object.
 * @returns A JSON response containing an array of card fingerprint IDs.
 * The response will have a status of 401 if the user is not authenticated,
 * 404 if the user does not have a Stripe customer ID, or 500 if there was
 * an error retrieving the user's cards.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const cardFingerprints = await getUserCards(user.id);
    return NextResponse.json({ cardFingerprints });
  } catch (error) {
    console.error('Error retrieving user cards:', error);
    return NextResponse.json({ error: 'Error retrieving user cards' }, { status: 500 });
  }
}

/**
 * Stores the given list of card fingerprints for the authenticated user.
 * @param request - The NextRequest object.
 * @returns A JSON response containing a success boolean.
 * The response will have a status of 401 if the user is not authenticated,
 * 404 if the user does not have a Stripe customer ID, or 500 if there was
 * an error storing the user's cards.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { fingerprints } = body;

    for (const fingerprint of fingerprints) {
      await storeUserCard(user.id, fingerprint);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error storing user cards:', error);
    return NextResponse.json({ error: 'Error storing user cards' }, { status: 500 });
  }
}

