import pagesOptions from './pages';
import { AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import AzureADProvider from 'next-auth/providers/azure-ad';
import CredentialsProvider from 'next-auth/providers/credentials';
import { jwtVerify } from 'jose';
import { OrchestraAdapter } from '@/lib/orchestra/orchestra-adapter';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { trustedClientIpFromContext } from '@/lib/server/clientIp';
import { isSelfHost } from '@/lib/environment/environment';
import { IS_STAGING, isStagingAllowedEmail } from '@/lib/auth/staging-gate';
import { baseColors } from '@/lib/design-tokens';

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
const cookiePrefix = useSecureCookies ? '__Secure-' : '';
const googleClientId = process.env.GOOGLE_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
const googleClientSecret =
  process.env.GOOGLE_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '';
const azureClientId =
  process.env.AZURE_AD_CLIENT_ID ??
  process.env.MICROSOFT_BYOD_CLIENT_ID ??
  process.env.MS365_BYOD_CLIENT_ID ??
  '';
const azureClientSecret =
  process.env.AZURE_AD_CLIENT_SECRET ??
  process.env.MICROSOFT_BYOD_CLIENT_SECRET ??
  process.env.MS365_BYOD_CLIENT_SECRET ??
  '';

const authOptions: AuthOptions = {
  ...pagesOptions,
  // @ts-ignore
  adapter: OrchestraAdapter(),
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
  },
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      // Google verifies email ownership, so it's safe to auto-link accounts
      // that share the same verified email (e.g. user signed up with email/password
      // and later clicks "Continue with Google").
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: 'consent',
          accessType: 'offline',
          responseType: 'code',
          scope: 'openid email profile https://www.googleapis.com/auth/userinfo.profile',
        },
      },
      profile(profile) {
        let firstName = profile.given_name ?? null;
        let lastName = profile.family_name ?? null;

        if (!firstName && profile.name) {
          const parts = profile.name.trim().split(/\s+/);
          firstName = parts[0];
          lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
        } else if (firstName && !lastName && profile.name) {
          const parts = profile.name.trim().split(/\s+/);
          if (parts.length > 1) {
            lastName = parts.slice(1).join(' ');
          }
        }

        return {
          id: profile.sub,
          email: profile.email,
          name: firstName,
          lastName: lastName,
          image: profile.picture ?? null,
        };
      },
    }),
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      // GitHub is deprecated; auto-linking is disabled for security.
    }),
    AzureADProvider({
      clientId: azureClientId,
      clientSecret: azureClientSecret,
      tenantId: process.env.AZURE_AD_TENANT_ID,
      // Microsoft verifies email ownership, so it's safe to auto-link accounts
      // that share the same verified email.
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        // Azure AD may only provide `name` (full display name) without
        // separate given_name / family_name fields — especially for
        // personal Microsoft accounts. Split the full name as a fallback.
        let firstName = profile.given_name ?? null;
        let lastName = profile.family_name ?? null;

        if (!firstName && profile.name) {
          const parts = profile.name.trim().split(/\s+/);
          firstName = parts[0];
          lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
        }

        return {
          id: profile.sub,
          email: profile.email ?? profile.preferred_username ?? null,
          name: firstName,
          lastName: lastName,
          image: null, // Azure AD doesn't return picture in the ID token by default
        };
      },
    }),
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        preAuthToken: { label: 'Pre-auth Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        // Fast path: if a pre-auth token was passed from the authenticate
        // API route, verify it locally and skip the redundant Orchestra call.
        if (credentials.preAuthToken) {
          try {
            const secret = new TextEncoder().encode(process.env.JWT_SECRET);
            const { payload } = await jwtVerify(credentials.preAuthToken, secret);
            return {
              id: payload.sub as string,
              email: payload.email as string,
              name: (payload.name as string) ?? null,
              lastName: (payload.lastName as string) ?? null,
              image: (payload.image as string) ?? null,
              mfaPending: payload.mfaRequired === true,
              onboardingStep: (payload.onboardingStep as string) ?? 'completed',
            };
          } catch {
            // Token expired or tampered — fall through to full auth
          }
        }

        // Full path: validate credentials via Orchestra (fallback / direct call).
        if (!credentials.email || !credentials.password) return null;

        try {
          const res = await OrchestraAdminClient.post('/auth/authenticate', {
            email: credentials.email,
            password: credentials.password,
            clientIp: await trustedClientIpFromContext(),
          });

          if (res.data?.id) {
            return {
              id: res.data.id,
              email: res.data.email,
              name: res.data.name,
              lastName: res.data.lastName ?? null,
              image: res.data.image ?? null,
              mfaPending: res.data.mfaRequired === true,
              onboardingStep: res.data.onboardingStep ?? 'completed',
            };
          }
          return null;
        } catch {
          return null;
        }
      },
    }),
  ],
  secret: process.env.JWT_SECRET,
  theme: {
    colorScheme: 'light',
    brandColor: baseColors.roleGreenDeep,
  },
  callbacks: {
    /**
     * The `signIn` callback is called before a user is signed in.
     * For OAuth providers without `allowDangerousEmailAccountLinking`, we
     * intercept the sign-in to provide a better error message showing
     * which providers are linked. Google and Azure AD have auto-linking
     * enabled, so they are skipped here.
     */
    async signIn({ user, account }) {
      if (!isSelfHost() && IS_STAGING && !isStagingAllowedEmail(user.email)) {
        return '/login?error=StagingRestricted';
      }

      // Providers with allowDangerousEmailAccountLinking — let NextAuth auto-link
      const autoLinkProviders = ['google', 'azure-ad'];

      if (
        account?.provider &&
        account.provider !== 'credentials' &&
        !autoLinkProviders.includes(account.provider) &&
        user.email
      ) {
        try {
          const res = await OrchestraAdminClient.get('/auth/providers-for-email', {
            params: { email: user.email },
          });
          const providers: string[] = res.data?.providers ?? [];

          if (providers.length > 0 && !providers.includes(account.provider)) {
            const providerList = providers.join(',');
            return `/login?error=OAuthAccountNotLinked&providers=${encodeURIComponent(providerList)}`;
          }
        } catch {
          // If the check fails, let NextAuth handle it normally
        }
      }
      return true;
    },

    /**
     * The `redirect` callback is called when a redirect is required, either
     * due to an OAuth callback or a redirect from a login form. The
     * callback is passed the `url` and `baseUrl` of the request, and should
     * return the URL to redirect to. The `baseUrl` is the base URL of the
     * NextAuth.js API, and can be used to construct a new URL.
     *
     * This callback allows relative callback URLs to be used. If the `url`
     * starts with a `/`, it is treated as a relative URL and the `baseUrl`
     * is prepended to it.
     *
     * }
     */
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) return url;
      } catch {
        // Malformed URL — fall through to baseUrl
      }
      return baseUrl;
    },

    /**
     * The `jwt` callback is called after a user is authenticated. The
     * callback is passed the `token` and `profile` of the user, and should
     * return a new JWT. The `token` is the user's JWT, and the `profile` is
     * the user's profile information from the OAuth provider.
     *
     * This callback allows the JWT to be modified or extended with
     * additional information. The `token` is the base JWT, and any
     * additional information should be added to it.
     *
     */
    async jwt({ token, user, account, profile, trigger, session }) {
      // Forcibly sign out any existing session whose email is not allowed
      // in the current environment. Read by the middleware to clear the
      // session cookie and redirect the user back to /login.
      //
      // During impersonation the active identity is the (possibly non-Unify)
      // target, so gate against the impersonating Unify staff member instead —
      // otherwise "view as customer" would self-destruct on staging.
      const gateEmail =
        (token as { impersonatorEmail?: string }).impersonatorEmail ?? token.email ?? user?.email;
      if (!isSelfHost() && IS_STAGING && !isStagingAllowedEmail(gateEmail)) {
        return { restrictedSignOut: true };
      }

      // On initial sign-in: persist the auth provider ('credentials', 'google', 'github')
      if (account) {
        token.provider = account.provider;
      }
      // On initial sign-in: copy mfaPending from authorize() result
      if (user?.mfaPending) {
        token.mfaPending = true;
      }
      // Persist onboarding step from authorize() result (credentials login).
      if (user?.onboardingStep && user.onboardingStep !== 'completed') {
        token.onboardingStep = user.onboardingStep;
      }
      // On OAuth sign-in: check MFA and onboarding status from the backend.
      // We query the backend directly instead of relying on trigger === 'signUp',
      // because NextAuth fires 'signUp' even when an existing email user links
      // a new OAuth provider (e.g. signed up with email, later signs in with Google).
      if (account && account.provider !== 'credentials' && token.email) {
        try {
          const mfaRes = await OrchestraAdminClient.get('/auth/mfa/status-by-email', {
            params: { email: token.email },
          });
          if (mfaRes.data?.mfaEnabled) {
            token.mfaPending = true;
          }
        } catch {
          // Don't block OAuth sign-in if MFA check fails
          console.warn('[jwt] Failed to check MFA status for OAuth user, skipping');
        }

        // Check onboarding status — only set if not already set by credentials path
        if (!token.onboardingStep) {
          try {
            const onboardingRes = await OrchestraAdminClient.get(
              '/auth/onboarding-status-by-email',
              { params: { email: token.email } }
            );
            const step = onboardingRes.data?.onboardingStep;
            if (step && step !== 'completed') {
              token.onboardingStep = step;
            }
          } catch {
            console.warn('[jwt] Failed to check onboarding status for OAuth user, skipping');
          }
        }
      }
      // mfaPending is cleared exclusively by the server-side MFA verify
      // route handlers (src/app/api/auth/mfa/verify and verify-recovery),
      // which patch the JWT cookie directly after Orchestra confirms the
      // TOTP/recovery code. Client-side update() cannot clear this flag.

      // On session update: advance or clear onboarding step
      if (trigger === 'update' && session?.onboardingStep) {
        if (session.onboardingStep === 'completed') {
          try {
            const onboardingRes = await OrchestraAdminClient.get(
              '/auth/onboarding-status-by-email',
              { params: { email: token.email } }
            );
            const step = onboardingRes.data?.onboardingStep;
            if (!step || step === 'completed') {
              delete token.onboardingStep;
            }
          } catch {
            // Don't clear if verification fails
          }
        } else {
          token.onboardingStep = session.onboardingStep;
        }
      }

      if (account?.provider === 'google' && !token.picture) {
        try {
          const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
            headers: { Authorization: `Bearer ${account.accessToken}` },
          });
          const data = await response.json();
          if (data.picture) {
            token.picture = data.picture;
          } else {
            console.log('Google profile picture not found');
            token.picture = null;
          }
        } catch (error) {
          console.error('Error fetching Google profile picture:', error);
          token.picture = null;
        }
      } else if (account?.provider === 'github') {
        if (profile && typeof profile === 'object' && 'avatar_url' in profile) {
          token.picture = typeof profile.avatar_url === 'string' ? profile.avatar_url : null;
        } else {
          token.picture = null;
        }
      } else if (account?.provider === 'azure-ad') {
        // Azure AD does not return a profile picture in the ID token;
        // fetching it requires MS Graph API with User.Read scope, so we
        // leave it null for now.
        if (!token.picture) {
          token.picture = null;
        }
      }
      return token;
    },

    /**
     * The `session` callback is called when a session is created or updated.
     * The callback is passed the `session` and `token` of the user, and should
     * return the updated session.
     *
     * This callback allows the session to be modified or extended with
     * additional information. The `session` is the base session, and any
     * additional information should be added to it.
     *
     */
    async session({ session, token }) {
      // Mirror the jwt-callback gate: drop the user from the session so
      // server components and useSession() see an unauthenticated state.
      if ((token as { restrictedSignOut?: boolean })?.restrictedSignOut) {
        return { ...session, user: undefined } as typeof session;
      }

      if (session.user) {
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.image = token.picture || null;
      }
      // Expose the JWT issued-at timestamp so getCurrentUser() can compare it
      // against password_changed_at for session invalidation.
      if (token.iat) {
        session.iat = token.iat;
      }
      // Expose mfaPending so the middleware and /login/mfa page can react.
      if (token.mfaPending) {
        session.mfaPending = true;
      }
      // Expose onboardingStep so the middleware can redirect to /login/onboarding.
      if (token.onboardingStep) {
        session.onboardingStep = token.onboardingStep;
      }
      // Expose the auth provider so downstream logic can distinguish
      // email/password sessions from OAuth sessions.
      if (token.provider) {
        session.provider = token.provider as string;
      }
      // Expose impersonation state so the client banner can render and offer a
      // "return to your account" control.
      if ((token as { impersonating?: boolean }).impersonating) {
        session.impersonating = true;
        session.impersonatorEmail = (token as { impersonatorEmail?: string }).impersonatorEmail;
        session.impersonatorName = (token as { impersonatorName?: string }).impersonatorName;
      }
      return session;
    },
  },
};

export { authOptions };
export default authOptions;
