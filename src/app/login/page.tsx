'use client';

import { LayoutGroup, motion } from 'framer-motion';
import { signIn, signOut, useSession } from 'next-auth/react';
import { redirect, useSearchParams, useRouter } from 'next/navigation';
import LoginFragment from '@/components/Pages/Login/LoginFragment';
import { Suspense, useState, useEffect, useRef } from 'react';
import CheckElement from '@/components/Pages/Login/CheckElement';
import AnimatedTabs from '@/components/Common/Tabs/AnimatedTabs';
import LoadingElement from '@/components/Common/Loaders/LoadingElement';
import { useEnvironment } from '@/components/Pages/Providers/EnvironmentProvider';
import { selfHostAutoLogin } from '@/lib/self-host/actions';
const ERRORS: Record<string, string> = {
  Signin: 'Try signing with a different account.',
  OAuthSignin: 'Try signing with a different account.',
  OAuthCallback: 'Try signing with a different account.',
  OAuthCreateAccount: 'Try signing with a different account.',
  EmailCreateAccount: 'Try signing with a different account.',
  Callback: 'Try signing with a different account.',
  OAuthAccountNotLinked: 'Please sign in with the same authentication method you used originally.',
  EmailSignin: 'Check your email address.',
  CredentialsSignin: 'Sign in failed. Check the details you provided are correct.',
  Verification: 'Error occured during verification.',
  StagingRestricted: 'This staging environment is restricted to unify ai members only.',
  default: 'Unable to sign in.',
};

const Login = () => {
  const session = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSelfHost } = useEnvironment();

  const shouldSignOut = searchParams?.get('signout') === 'true';
  const callbackUrl = searchParams?.get('callbackUrl');
  const searchError = searchParams?.get('error');
  const linkedProviders = searchParams?.get('providers');

  // Build a provider-aware error message when OAuthAccountNotLinked includes linked providers
  let searchErrorMessage: string | undefined;
  if (searchError === 'OAuthAccountNotLinked' && linkedProviders) {
    const providerNames = linkedProviders
      .split(',')
      .map((p) => {
        const names: Record<string, string> = {
          google: 'Google',
          'azure-ad': 'Microsoft',
          email: 'Email/Password',
        };
        return names[p] ?? p;
      })
      .join(', ');
    searchErrorMessage = `This email is already registered with ${providerNames}. Please sign in with ${providerNames} instead.`;
  } else if (searchError) {
    searchErrorMessage = ERRORS[searchError];
  }

  // Token handling: persist invite and credit tokens through OAuth flow
  const inviteToken = searchParams?.get('invite');
  const creditToken = searchParams?.get('credit');
  // Referral code (?ref=CODE): persist immediately so it survives the OAuth
  // round-trip and onboarding; it is attributed after the user authenticates.
  const referralCode = searchParams?.get('ref');

  // Detect invite context from either explicit param or callbackUrl
  const isInviteFlow =
    !!inviteToken || callbackUrl?.includes('/login/invite') || callbackUrl?.includes('/invite');

  // Track whether we are actively signing out a stale session
  // (e.g. user deleted their backend account but the JWT cookie persists).
  const [isSigningOut, setIsSigningOut] = useState(shouldSignOut);
  const [tab, setTab] = useState<'login' | 'loading' | 'check'>('login');
  const [error, setError] = useState<string | undefined>(searchErrorMessage);

  // Self-host single-owner auto-login: once an account exists locally, sign the
  // owner in automatically (no password, no click). Start in the
  // "signing in" state on self-host so the create/sign-in form never flashes
  // before we know whether an account exists.
  const [selfHostAutoLoggingIn, setSelfHostAutoLoggingIn] = useState(isSelfHost && !shouldSignOut);
  const selfHostAutoLoginAttempted = useRef(false);

  // Persist the referral code as soon as we see it so it isn't lost across
  // the OAuth round-trip (localStorage survives the same-origin redirect).
  useEffect(() => {
    if (referralCode && typeof window !== 'undefined') {
      try {
        localStorage.setItem('pending_referral_code', referralCode);
      } catch {
        // localStorage may be unavailable in some contexts
      }
    }
  }, [referralCode]);

  useEffect(() => {
    if (!shouldSignOut) return;

    // An explicit sign-out is the escape hatch from auto-login: remember it for
    // this tab so we don't immediately sign the owner back in.
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('sh_suppress_autologin', '1');
      } catch {
        // sessionStorage may be unavailable in some contexts
      }
    }

    if (session.status === 'authenticated') {
      // Session exists but backend user is gone — clear the JWT cookie
      // then do a full-page reload to avoid a race between React state
      // updates and the session context (which could briefly trigger
      // redirect('/assistants') before the session clears).
      signOut({ redirect: false }).then(() => {
        const loginUrl = creditToken
          ? `/login?credit=${encodeURIComponent(creditToken)}`
          : '/login';
        window.location.href = loginUrl;
      });
    } else if (session.status === 'unauthenticated') {
      // Already signed out (or cookie was cleared another way)
      setIsSigningOut(false);
      router.replace('/login');
    }
    // While session.status === 'loading', we wait
  }, [shouldSignOut, session.status, router, creditToken]);

  // Self-host: attempt passwordless auto-login for the recorded local owner.
  // Resolves the `selfHostAutoLoggingIn` loader either by redirecting (success)
  // or by falling through to the create-account screen (no/stale account).
  useEffect(() => {
    if (!isSelfHost) return;
    if (shouldSignOut) {
      setSelfHostAutoLoggingIn(false);
      return;
    }
    if (session.status === 'loading') return; // wait for session resolution
    if (session.status === 'authenticated') return; // render-time redirect handles it
    if (selfHostAutoLoginAttempted.current) return;

    if (typeof window !== 'undefined' && sessionStorage.getItem('sh_suppress_autologin') === '1') {
      setSelfHostAutoLoggingIn(false);
      return;
    }

    selfHostAutoLoginAttempted.current = true;
    setSelfHostAutoLoggingIn(true);
    (async () => {
      const result = await selfHostAutoLogin();
      if (result.ok) {
        const dest = callbackUrl && callbackUrl.startsWith('/') ? callbackUrl : '/assistants';
        window.location.href = dest;
      } else {
        // No account yet (first run) or a stale/unreachable owner — show the
        // create-account screen.
        setSelfHostAutoLoggingIn(false);
      }
    })();
  }, [isSelfHost, shouldSignOut, session.status, callbackUrl]);

  // Redirect authenticated users — but NOT if we're in the middle of signing
  // them out due to a deleted backend account.  Honour the callbackUrl
  // (which may contain a credit-grant token) so the token survives.
  if (session.data && !isSigningOut) {
    if (creditToken) {
      redirect(`/assistants?token=${encodeURIComponent(creditToken)}`);
    } else if (callbackUrl) {
      redirect(callbackUrl.startsWith('/') ? callbackUrl : '/assistants');
    } else {
      redirect('/assistants');
    }
  }

  // Show a loader while we're clearing a stale session
  if (isSigningOut) {
    return (
      <div className="m-auto flex items-center justify-center">
        <LoadingElement />
      </div>
    );
  }

  // Self-host: while we attempt passwordless auto-login, show a loader instead
  // of flashing the create/sign-in form.
  if (isSelfHost && selfHostAutoLoggingIn) {
    return (
      <div className="m-auto flex items-center justify-center">
        <LoadingElement />
      </div>
    );
  }

  const handleLogin = (provider: 'email' | 'google' | 'azure-ad', email?: string) => async () => {
    setTab('loading');
    let callback: URL;

    // If we have an invite or credit token, set the callback to the appropriate page
    if (inviteToken) {
      callback = new URL('/login/invite', document.location.href);
      callback.searchParams.set('token', inviteToken);
    } else if (creditToken) {
      callback = new URL('/assistants', document.location.href);
      callback.searchParams.set('token', creditToken);
    } else if (callbackUrl?.startsWith('http')) {
      callback = new URL(callbackUrl);
    } else {
      callback = new URL(callbackUrl ?? '/', document.location.href);
    }
    callback.searchParams.delete('error');
    // Carry the referral code onto the post-auth landing page so it can be
    // attributed there (belt-and-braces alongside the localStorage copy).
    if (referralCode) {
      callback.searchParams.set('ref', referralCode);
    }
    if (provider === 'email') {
      const result = await signIn('email', {
        email,
        redirect: false,
        callbackUrl: callback.toString(),
      });

      if (!result || result.error || !result.ok) {
        setTab('login');
        setError(ERRORS[result?.error ?? 'default']);
        return;
      }

      if (result.ok) {
        setTab('check');
        return;
      }
    }
    await signIn(provider, { callbackUrl: callback.toString() });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="m-auto flex w-full min-w-0 flex-col gap-9"
    >
      <LayoutGroup>
        {/* Banner for invite/credit token context */}
        {isInviteFlow && (
          <div
            className="text-body border-[color:var(--status-success)]/25 rounded-lg border bg-[color:var(--status-success-bg)] p-3 text-center text-[color:var(--status-success)]"
            data-testid="invite-banner"
          >
            You&apos;ve been invited to join an organization. Please sign in with the email address
            you received the invitation at.
          </div>
        )}
        <div className="flex w-full min-w-0 justify-center lg:container">
          <AnimatedTabs selected={tab}>
            <LoginFragment
              onLogin={handleLogin}
              error={error}
              callbackUrl={callbackUrl ?? undefined}
              emailOnly={process.env.NEXT_PUBLIC_SELF_HOST === '1'}
              key="login"
            />
            <LoadingElement key="loading" />
            <CheckElement key="check" />
          </AnimatedTabs>
        </div>
      </LayoutGroup>
    </motion.div>
  );
};

/**
 * Wrap in Suspense because Login uses useSearchParams(), which requires
 * a Suspense boundary for Next.js static generation.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingElement />}>
      <Login />
    </Suspense>
  );
}
