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

    // Only include fields that were explicitly provided in the request body
    // to avoid overwriting existing values with null/undefined.
    const userUpdateRequest: Partial<UserUpdateRequest> & { email: string; userId: string } = {
      email: user.email,
      userId: user.id,
    };
    if ('name' in body) userUpdateRequest.name = body.name;
    if ('lastName' in body) userUpdateRequest.lastName = body.lastName;
    if ('jobTitle' in body) userUpdateRequest.jobTitle = body.jobTitle;
    if ('bio' in body) userUpdateRequest.bio = body.bio;
    if ('timezone' in body) userUpdateRequest.timezone = body.timezone || null;
    if ('image' in body) userUpdateRequest.image = body.image;
    // Contact fields persist eagerly (phone/WhatsApp only after the number has
    // been verified server-side). Empty string clears the value.
    if ('phoneNumber' in body) userUpdateRequest.phoneNumber = body.phoneNumber || null;
    if ('whatsappNumber' in body) userUpdateRequest.whatsappNumber = body.whatsappNumber || null;
    if ('discordId' in body) userUpdateRequest.discordId = body.discordId || null;

    const response = await updateUser(userUpdateRequest as UserUpdateRequest);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
