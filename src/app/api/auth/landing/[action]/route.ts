import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { validatePassword } from '@/lib/auth/password';
import { IS_STAGING, isStagingAllowedEmail } from '@/lib/auth/staging-gate';
import { snakeToCamelObject } from '@/utils/casing';
import { signupProvenanceFrom } from '@/lib/server/signupProvenance';

type LandingAuthAction = 'email' | 'register' | 'verify' | 'login' | 'resend';

interface AuthUser {
  id?: string;
  userId?: string;
  email?: string;
  name?: string | null;
  lastName?: string | null;
  image?: string | null;
  mfaRequired?: boolean;
  onboardingStep?: string | null;
}

const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
const cookiePrefix = useSecureCookies ? '__Secure-' : '';
const cookieName = `${cookiePrefix}next-auth.session-token`;

function allowedOrigins(): Set<string> {
  const configured = (process.env.LANDING_AUTH_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(
    [
      'https://useunitys.ai',
      'https://www.useunitys.ai',
      'https://unify.ai',
      'https://www.unify.ai',
      'http://localhost:3007',
      process.env.NEXT_PUBLIC_SITE_URL,
      ...configured,
    ].filter(Boolean) as string[]
  );
}

function corsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    Vary: 'Origin',
  };

  if (origin && allowedOrigins().has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }

  return headers;
}

function json(request: NextRequest, body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders(request),
      ...(init?.headers ?? {}),
    },
  });
}

function errorPayload(error: any, fallback: string) {
  const rawData = error?.response?.data;
  return rawData?.detail ?? rawData ?? { error: 'landing_auth_failed', message: fallback };
}

function redirectForUser(user: AuthUser, fallback = '/assistants') {
  if (user.mfaRequired) return '/login/mfa';
  if (user.onboardingStep && user.onboardingStep !== 'completed') return '/login/onboarding';
  return fallback;
}

async function responseWithSession(
  request: NextRequest,
  rawUser: unknown,
  fallbackRedirect = '/assistants'
) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return json(
      request,
      { error: 'missing_jwt_secret', message: 'JWT_SECRET is not configured' },
      { status: 500 }
    );
  }

  const user = snakeToCamelObject<AuthUser>(rawUser);
  const userId = user.id ?? user.userId;

  if (!userId || !user.email) {
    return json(
      request,
      { error: 'invalid_user', message: 'Authenticated user payload was incomplete' },
      { status: 500 }
    );
  }

  const token = await encode({
    token: {
      sub: userId,
      email: user.email,
      name: user.name ?? null,
      lastName: user.lastName ?? null,
      picture: user.image ?? null,
      provider: 'credentials',
      mfaPending: user.mfaRequired === true,
      onboardingStep: user.onboardingStep ?? 'completed',
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    maxAge: SESSION_MAX_AGE,
  });

  const response = json(request, {
    ok: true,
    redirectUrl: redirectForUser(user, fallbackRedirect),
    user: {
      email: user.email,
      name: user.name ?? null,
    },
  });

  response.cookies.set(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: useSecureCookies,
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}

async function handleRegister(request: NextRequest, body: any) {
  const { email, firstName, lastName, password } = body;

  if (IS_STAGING && !isStagingAllowedEmail(email)) {
    return json(
      request,
      {
        error: 'staging_restricted',
        message: 'Registration on this environment is restricted to Unify AI members.',
      },
      { status: 403 }
    );
  }

  const validation = validatePassword(password ?? '');
  if (!validation.isValid) {
    const missing = validation.rules
      .filter((rule) => !rule.passed)
      .map((rule) => rule.label.toLowerCase());
    return json(
      request,
      { error: 'weak_password', message: `Password must have ${missing.join(', ')}.` },
      { status: 400 }
    );
  }

  try {
    const res = await OrchestraAdminClient.post('/auth/register', {
      email,
      name: firstName || undefined,
      lastName: lastName || undefined,
      password,
      captchaToken: body.captchaToken || undefined,
    });
    return json(request, res.data, { status: 200 });
  } catch (error: any) {
    return json(request, errorPayload(error, 'Registration failed'), {
      status: error?.response?.status ?? 500,
    });
  }
}

async function handleEmail(request: NextRequest, body: any) {
  const email = body.email;
  const password = body.password;

  try {
    const providersRes = await OrchestraAdminClient.get('/auth/providers-for-email', {
      params: { email },
    });
    const providers: string[] = providersRes.data?.providers ?? [];

    if (providers.includes('email')) {
      return handleLogin(request, body);
    }

    if (providers.length > 0) {
      const names = providers
        .map((provider) =>
          provider === 'azure-ad'
            ? 'Microsoft'
            : provider.charAt(0).toUpperCase() + provider.slice(1)
        )
        .join(' or ');
      return json(
        request,
        {
          error: 'provider_exists',
          message: `This email is already registered with ${names}. Please continue with ${names}.`,
        },
        { status: 409 }
      );
    }
  } catch (error: any) {
    // If provider lookup fails because the user does not exist, continue into
    // registration. Other failures should still surface clearly.
    if (error?.response?.status && error.response.status !== 404) {
      return json(request, errorPayload(error, 'Provider lookup failed'), {
        status: error.response.status,
      });
    }
  }

  if (IS_STAGING && !isStagingAllowedEmail(email)) {
    return json(
      request,
      {
        error: 'staging_restricted',
        message: 'Registration on this environment is restricted to Unify AI members.',
      },
      { status: 403 }
    );
  }

  const validation = validatePassword(password ?? '');
  if (!validation.isValid) {
    const missing = validation.rules
      .filter((rule) => !rule.passed)
      .map((rule) => rule.label.toLowerCase());
    return json(
      request,
      { error: 'weak_password', message: `Password must have ${missing.join(', ')}.` },
      { status: 400 }
    );
  }

  try {
    const res = await OrchestraAdminClient.post('/auth/register', {
      email,
      password,
      captchaToken: body.captchaToken || undefined,
      // Self-host creates the user here; hosted records it at verify.
      ...signupProvenanceFrom(request),
    });
    return json(request, { ok: true, next: 'verify', ...res.data }, { status: 200 });
  } catch (error: any) {
    return json(request, errorPayload(error, 'Registration failed'), {
      status: error?.response?.status ?? 500,
    });
  }
}

async function handleVerify(request: NextRequest, body: any) {
  try {
    const verifyRes = await OrchestraAdminClient.post('/auth/verify-code', {
      email: body.email,
      code: body.code,
      purpose: 'signup',
    });
    const createRes = await OrchestraAdminClient.post('/auth/create-user', {
      token: verifyRes.data.token,
      ...signupProvenanceFrom(request),
    });
    return responseWithSession(request, createRes.data, '/login/onboarding');
  } catch (error: any) {
    return json(request, errorPayload(error, 'Verification failed'), {
      status: error?.response?.status ?? 500,
    });
  }
}

async function handleLogin(request: NextRequest, body: any) {
  try {
    const res = await OrchestraAdminClient.post('/auth/authenticate', {
      email: body.email,
      password: body.password,
    });
    return responseWithSession(request, res.data, '/assistants');
  } catch (error: any) {
    return json(request, errorPayload(error, 'Authentication failed'), {
      status: error?.response?.status ?? 500,
    });
  }
}

async function handleResend(request: NextRequest, body: any) {
  try {
    const res = await OrchestraAdminClient.post('/auth/resend-verification', {
      email: body.email,
      purpose: body.purpose ?? 'signup',
    });
    return json(request, res.data, { status: 200 });
  } catch (error: any) {
    return json(request, errorPayload(error, 'Failed to resend code'), {
      status: error?.response?.status ?? 500,
    });
  }
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;
  const body = await request.json().catch(() => ({}));

  switch (action) {
    case 'email':
      return handleEmail(request, body);
    case 'register':
      return handleRegister(request, body);
    case 'verify':
      return handleVerify(request, body);
    case 'login':
      return handleLogin(request, body);
    case 'resend':
      return handleResend(request, body);
    default:
      return json(
        request,
        { error: 'unknown_action', message: 'Unknown landing auth action' },
        { status: 404 }
      );
  }
}
