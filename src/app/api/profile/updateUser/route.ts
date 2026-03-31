import { updateUser, getCurrentUser } from '@/lib/user/user';
import { UserUpdateRequest } from '@/types/user';
import { NextRequest } from 'next/server';

/**
 * Handles the form submission for updating a user's profile information.
 *
 * The user ID is resolved from the authenticated session, not from the
 * request, to prevent IDOR attacks.
 */
export async function POST(request: NextRequest) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const id = sessionUser.id;
  const formData = await request.formData();

  // Update user properties in db
  const phoneNumber = formData.get('phoneNumber') as string | null;
  const whatsappNumber = formData.get('whatsappNumber') as string | null;
  const userUpdateReq: UserUpdateRequest = {
    email: formData.get('email') as string,
    userId: id,
    image: formData.get('image') as string,
    name: formData.get('name') as string,
    lastName: formData.get('lastName') as string,
    jobTitle: formData.get('jobTitle') as string,
    bio: formData.get('bio') as string,
    timezone: (formData.get('timezone') as string) || null,
    phoneNumber: phoneNumber === '' ? null : phoneNumber,
    whatsappNumber: whatsappNumber === '' ? null : whatsappNumber,
  };

  try {
    const response = await updateUser(userUpdateReq);
    return new Response(JSON.stringify(response));
  } catch (error: unknown) {
    const axiosErr = error as { response?: { status?: number; data?: { detail?: unknown } } };
    const statusCode = axiosErr?.response?.status || 500;
    const rawDetail = axiosErr?.response?.data?.detail;

    let detail: string;
    if (typeof rawDetail === 'string') {
      detail = rawDetail;
    } else if (Array.isArray(rawDetail) && rawDetail.length > 0) {
      detail = rawDetail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join('; ');
    } else {
      detail = 'Failed to update user.';
    }

    return new Response(JSON.stringify({ error: detail }), { status: statusCode });
  }
}
