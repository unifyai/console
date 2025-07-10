import { NextRequest, NextResponse } from 'next/server';
import { updateContact, getMailingLists, getContactSubscriptions } from '@/lib/loops';
import { getCurrentUser } from '@/lib/user/user';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const getSubscriptions = searchParams.get('getSubscriptions');

  try {
    if (getSubscriptions) {
      const subscriptions = await getContactSubscriptions(user.email);
      return NextResponse.json(subscriptions);
    } else {
      const mailingLists = await getMailingLists();
      return NextResponse.json(mailingLists);
    }
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching data from Loops' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const { mailingLists } = await request.json();
    const allLists = await getMailingLists();
    const result = await updateContact(user.email, allLists, mailingLists);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Error updating contact' }, { status: 500 });
  }
} 