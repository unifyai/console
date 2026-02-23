import { getMailchimpUserInterests, addMailchimpUser } from '@/lib/user/email-preferences';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const mailchimpInterests = await getMailchimpUserInterests(email);

  if (!mailchimpInterests) {
    await addMailchimpUser(email);
  } else {
    return new Response(JSON.stringify({ subscriptions: mailchimpInterests }), {
      status: 200,
    });
  }
}
