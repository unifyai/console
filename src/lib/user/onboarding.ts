'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decode, encode } from 'next-auth/jwt';
import { requireUserApiKey } from '@/lib/server-action-session';
import { getOrchestraUserClient, OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

/**
 * Server action factory that returns a function to update the user's
 * onboarding progress in Orchestra.
 *
 * Accepts any valid step + step_data, so callers can advance from any
 * step to any other (including "completed").  This keeps the action
 * generic — new onboarding steps don't require a new server action.
 *
 * OnboardingStatus is the single source of truth for where the user
 * is in the onboarding flow.
 *
 * Uses the axios-based Orchestra client (which auto-converts
 * camelCase → snake_case) because the onboarding endpoint is not yet
 * in the generated OpenAPI schema.
 */
// ─── Cookie / JWT helpers ─────────────────────────────────────────────────────

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
const cookiePrefix = useSecureCookies ? '__Secure-' : '';
const cookieName = `${cookiePrefix}next-auth.session-token`;

// ─── Server action: patch JWT and redirect ────────────────────────────────────

/** Allowlisted fields that can be mutated in the JWT. */
interface SessionPatch {
  onboardingStep?: string;
}

/**
 * Server action that patches the NextAuth JWT cookie and redirects.
 *
 * This replaces the old `/api/auth/update-session` GET route. A Server Action
 * is strictly more secure because:
 *   - Next.js validates the `Origin` header → built-in CSRF protection.
 *   - Not URL-accessible → can't be triggered by `<img>` tags, links, etc.
 *   - `cookies().set()` writes the `Set-Cookie` header the same way the old
 *     route handler did, so the cookie update is just as reliable.
 *
 * @param patch      Allowlisted JWT mutations.
 *                   `onboardingStep: 'completed'` clears the field from the JWT.
 * @param redirectTo Relative path to redirect to after patching (default: `/assistants`).
 * @param extraParams Extra query params to forward to the redirect destination
 *                    (e.g. credit tokens).
 */
export async function patchSessionAndRedirect(
  patch: SessionPatch,
  redirectTo: string = '/assistants',
  extraParams?: Record<string, string>
): Promise<never> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const cookieStore = await cookies();
  const rawJwt = cookieStore.get(cookieName)?.value;

  if (!rawJwt) {
    redirect('/login');
  }

  // Decode the existing JWT
  const token = await decode({ token: rawJwt, secret });
  if (!token) {
    redirect('/login');
  }

  // ── Apply allowlisted mutations ──────────────────────────────────────

  if (patch.onboardingStep !== undefined) {
    if (patch.onboardingStep === 'completed') {
      try {
        const onboardingRes = await OrchestraAdminClient.get('/auth/onboarding-status-by-email', {
          params: { email: token.email },
        });
        const step = onboardingRes.data?.onboardingStep;
        if (!step || step === 'completed') {
          delete token.onboardingStep;
        }
      } catch {
        // Don't clear if verification fails
      }
    } else {
      token.onboardingStep = patch.onboardingStep;
    }
  }

  // mfaPending is NOT mutable here — it is cleared exclusively by the
  // server-side MFA verify route handlers after Orchestra confirmation.

  // ── Re-encode and set the cookie ─────────────────────────────────────

  const maxAge = 7 * 24 * 60 * 60; // 7 days — matches authOptions.session.maxAge
  const newJwt = await encode({ token, secret, maxAge });

  cookieStore.set(cookieName, newJwt, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: useSecureCookies,
  });

  // ── Redirect ─────────────────────────────────────────────────────────

  // Prevent open-redirect: only allow relative paths
  const safePath = redirectTo.startsWith('/') ? redirectTo : '/assistants';

  // Forward extra params to the destination
  const query = extraParams ? new URLSearchParams(extraParams).toString() : '';
  const finalPath = query ? `${safePath}${safePath.includes('?') ? '&' : '?'}${query}` : safePath;

  redirect(finalPath);
}

// ─── Server action factory: update onboarding in Orchestra ────────────────────

export async function updateOnboardingAction(update: {
  currentStep: string;
  stepData?: Record<string, unknown>;
}): Promise<void> {
  const apiKey = await requireUserApiKey();
  const client = await getOrchestraUserClient(apiKey);

  await client.put('/user/onboarding', {
    currentStep: update.currentStep,
    ...(update.stepData && { stepData: update.stepData }),
  });
}
