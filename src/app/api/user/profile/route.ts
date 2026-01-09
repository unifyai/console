import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { unauthorized } from '../../_utils/auth';

export async function GET(request: NextRequest) {
  try {
    // Profile endpoint returns user object data, so we need getCurrentUser
    // API key header doesn't give us user profile info, only the session does
    const user = await getCurrentUser();

    // Check for API key header as fallback for auth check
    const headerApiKey = request.headers.get('apiKey');

    if (!user && !headerApiKey) {
      return unauthorized();
    }

    if (!user) {
      // With API key only, we can't return profile data
      // Return a minimal response indicating auth worked but no profile available
      return NextResponse.json(
        { error: 'Profile data requires session authentication' },
        { status: 404 }
      );
    }

    // Return user profile data
    return NextResponse.json({
      id: user.id,
      name: user.name || null,
      lastName: user.lastName || null,
      jobTitle: user.jobTitle || null,
      bio: user.bio || null,
      timezone: user.timezone || null,
      email: user.email,
    });
  } catch (error) {
    console.error('Error fetching user profile from Orchestra:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch user profile',
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
