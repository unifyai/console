import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, updateUser } from '@/lib/user/user';
import { UserUpdateRequest } from '@/types/user';
import { unauthorized } from '../../_utils/auth';

export async function POST(request: NextRequest) {
  try {
    // Update profile requires full user object for the update
    const user = await getCurrentUser();

    // Check for API key header as fallback
    const headerApiKey = request.headers.get('apiKey');

    if (!user && !headerApiKey) {
      return unauthorized();
    }

    if (!user) {
      // With API key only, we can't update profile (need user object)
      return NextResponse.json(
        { error: 'Profile update requires session authentication' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, lastName, jobTitle, bio, timezone } = body;

    // Update user properties in db
    const userUpdateRequest: UserUpdateRequest = {
      email: user.email,
      userId: user.id,
      name,
      lastName,
      jobTitle,
      bio: bio,
      timezone: timezone || null,
      image: null, // We don't update image in onboarding
    };

    const response = await updateUser(userUpdateRequest);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
