import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, updateUser } from '@/lib/user/user';
import { syncStripeCustomer } from '@/lib/user/billing/stripe/customer-sync';
import { UserUpdateRequest } from '@/types/user';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, lastName, jobTitle, bio, timezone } = body;

    // Update user properties in db
    const userUpdateRequest: UserUpdateRequest = {
      email: user.email,
      user_id: user.id,
      name,
      last_name: lastName,
      job_title: jobTitle,
      bio: bio,
      timezone: timezone || null,
      image: null // We don't update image in onboarding
    };

    const response = await updateUser(userUpdateRequest);

    // Sync name change with Stripe (if provided)
    if (name) {
      syncStripeCustomer({ user, accountType: 'individual' }).catch((e) =>
        console.warn('Failed to sync name change with Stripe:', e)
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}