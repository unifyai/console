import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getSupportedTaxCountries } from '@/lib/user/tax';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || !user.api_key) {
    return NextResponse.json({ error: "User not found or missing API key" }, { status: 404 });
  }

  try {
    const data = await getSupportedTaxCountries(user.api_key);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching supported tax countries:', error);
    return NextResponse.json({ error: 'Error fetching supported tax countries' }, { status: 500 });
  }
} 