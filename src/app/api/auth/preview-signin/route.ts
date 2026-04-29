import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { isPreviewHost } from '@/lib/auth/preview-host';
import { isUnifyMember } from '@/lib/auth/staging-gate';

/**
 * POST /api/auth/preview-signin
 *
 * Mints a short-lived ``preAuthToken`` for an internal team member on a
 * slug-tagged Cloud Run preview revision, bypassing Google OAuth.
 *
 * The frontend passes the returned token to
 * ``signIn('credentials', { preAuthToken })`` so the standard NextAuth
 * CredentialsProvider fast-path takes over from there — meaning session
 * cookie minting, JWT shape, and middleware behaviour are all identical
 * to a normal sign-in.
 *
 * Two structural gates:
 * - ``isPreviewHost(host)`` — the route only activates on slug-tagged
 *   preview hosts. Calls from the canonical custom domain, the bare
 *   staging host, or production are rejected with 403.
 * - ``isUnifyMember(email)`` — only ``@unify.ai`` emails are accepted.
 *
 * The minted token always sets ``mfaRequired: false`` and
 * ``onboardingStep: 'completed'`` so preview sign-in is one click; the
 * gates above are what keep this from being a security hole.
 */
export async function POST(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!isPreviewHost(host)) {
    return NextResponse.json(
      { error: 'preview_only', message: 'This endpoint is only available on preview revisions.' },
      { status: 403 }
    );
  }

  let email: string | undefined;
  try {
    const body = await request.json();
    email = typeof body?.email === 'string' ? body.email.trim() : undefined;
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  if (!email) {
    return NextResponse.json(
      { error: 'missing_email', message: 'An email address is required.' },
      { status: 400 }
    );
  }

  if (!isUnifyMember(email)) {
    return NextResponse.json(
      {
        error: 'email_not_allowed',
        message: 'Preview sign-in is restricted to @unify.ai accounts.',
      },
      { status: 403 }
    );
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return NextResponse.json(
      { error: 'server_misconfigured', message: 'Auth secret is not configured.' },
      { status: 500 }
    );
  }

  let user: { id: string; email: string; name: string | null; lastName: string | null; image: string | null };
  try {
    const response = await OrchestraAdminClient.get('/user/by-email', {
      params: { email },
    });
    if (!response.data?.id) {
      return NextResponse.json(
        { error: 'user_not_found', message: `No account exists for ${email}.` },
        { status: 404 }
      );
    }
    user = {
      id: response.data.id,
      email: response.data.email,
      name: response.data.name ?? null,
      lastName: response.data.lastName ?? response.data.last_name ?? null,
      image: response.data.image ?? null,
    };
  } catch (err: unknown) {
    const status =
      typeof err === 'object' && err && 'response' in err
        ? ((err as { response?: { status?: number } }).response?.status ?? 502)
        : 502;
    return NextResponse.json(
      { error: 'orchestra_lookup_failed', message: `User lookup failed (status ${status}).` },
      { status: status === 404 ? 404 : 502 }
    );
  }

  const secret = new TextEncoder().encode(jwtSecret);
  const preAuthToken = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    lastName: user.lastName,
    image: user.image,
    mfaRequired: false,
    onboardingStep: 'completed',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(secret);

  return NextResponse.json({ preAuthToken }, { status: 200 });
}
