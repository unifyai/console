import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';

export async function GET(request: NextRequest) {
  try {
    // Get user data from Orchestra
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
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

    // Return a more specific error message
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
