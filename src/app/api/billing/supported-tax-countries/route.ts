import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { getSupportedTaxCountries } from '@/lib/orchestra/api/user';

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const data = await getSupportedTaxCountries(apiKey);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching supported tax countries:', error);
    return NextResponse.json({ error: 'Error fetching supported tax countries' }, { status: 500 });
  }
}

