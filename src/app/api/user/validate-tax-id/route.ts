import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../_utils/auth';
import { validateTaxId } from '@/lib/user/tax';

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const requestBody = await request.json();
    if (!requestBody.country || !requestBody.taxId) {
      return badRequest('Missing required fields: country and taxId');
    }
    const data = await validateTaxId(apiKey, requestBody);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error validating tax ID:', error);
    return NextResponse.json({ error: 'Failed to validate tax ID' }, { status: 500 });
  }
}
