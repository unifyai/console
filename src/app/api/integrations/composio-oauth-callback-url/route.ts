import { NextResponse } from 'next/server';
import { getComposioOAuthCallbackUrl } from '../_utils/orchestra-url';

export async function GET() {
  return NextResponse.json({ oauthRedirectUri: getComposioOAuthCallbackUrl() });
}
