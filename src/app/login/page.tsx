'use client';

import { LayoutGroup, motion } from 'framer-motion';
import { signIn, signOut, useSession } from 'next-auth/react';
import { redirect, useSearchParams, useRouter } from 'next/navigation';
import LoginFragment from './login';
import { useState, useEffect } from 'react';
import CheckElement from './check';
import Back from '@/public/icons/back.svg';
import UnifyLogo from '@/components/Common/Misc/UnifyLogo';
import AnimatedTabs from '@/components/Common/Tabs/AnimatedTabs';
import LoadingElement from '@/components/Common/Loaders/LoadingElement';
import { useTheme } from 'next-themes';

const ERRORS: Record<string, string> = {
  Signin: 'Try signing with a different account.',
  OAuthSignin: 'Try signing with a different account.',
  OAuthCallback: 'Try signing with a different account.',
  OAuthCreateAccount: 'Try signing with a different account.',
  EmailCreateAccount: 'Try signing with a different account.',
  Callback: 'Try signing with a different account.',
  OAuthAccountNotLinked:
    'Please sign in with the same authentication method you used originally.',
  EmailSignin: 'Check your email address.',
  CredentialsSignin: 'Sign in failed. Check the details you provided are correct.',
  Verification: 'Error occured during verification.',
  default: 'Unable to sign in.',
};

const Login = () => {
  const session = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();

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
        const names: Record<string, string> = { google: 'Google', 'azure-ad': 'Microsoft', email: 'Email/Password' };
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

  // Track whether we are actively signing out a stale session
  // (e.g. user deleted their backend account but the JWT cookie persists).
  const [isSigningOut, setIsSigningOut] = useState(shouldSignOut);
  const [tab, setTab] = useState<'login' | 'loading' | 'check'>('login');
  const [error, setError] = useState<string | undefined>(searchErrorMessage);

  useEffect(() => {
    if (!shouldSignOut) return;

    if (session.status === 'authenticated') {
      // Session exists but backend user is gone — clear the JWT cookie
      // then do a full-page reload to avoid a race between React state
      // updates and the session context (which could briefly trigger
      // redirect('/assistants') before the session clears).
      signOut({ redirect: false }).then(() => {
        window.location.href = '/login';
      });
    } else if (session.status === 'unauthenticated') {
      // Already signed out (or cookie was cleared another way)
      setIsSigningOut(false);
      router.replace('/login');
    }
    // While session.status === 'loading', we wait
  }, [shouldSignOut, session.status, router]);

  // Redirect authenticated users to /assistants — but NOT if we're in the
  // middle of signing them out due to a deleted backend account.
  if (session.data && !isSigningOut) {
    redirect('/assistants');
  }

  // Show a loader while we're clearing a stale session
  if (isSigningOut) {
    return (
      <div className="fixed left-0 top-0 flex h-screen w-screen items-center justify-center">
        <LoadingElement />
      </div>
    );
  }

  const handleLogin = (provider: 'email' | 'google' | 'azure-ad', email?: string) => async () => {
    setTab('loading');
    let callback: URL;

    // If we have an invite or credit token, set the callback to the appropriate page
    if (inviteToken) {
      callback = new URL('/invite', document.location.href);
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
    <div className="fixed left-0 top-0 flex h-screen w-screen items-center justify-center">
      <LayoutGroup>
        <motion.div
          initial={{ y: '100vh' }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', bounce: 0.1 }}
          className="border-1 z-[200] mt-20 rounded-3xl border-[var(--white-smoke)] p-6 backdrop-blur-lg"
        >
          <div className="max-h-screen w-screen overflow-y-auto overflow-x-hidden rounded-lg bg-background p-8 md:p-24 xl:w-[720px] xl:drop-shadow-[0px_12px_100px_rgba(0,184,40,0.18)]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col gap-9"
            >
              <UnifyLogo theme={resolvedTheme} />

              {/* Banner for invite/credit token context */}
              {inviteToken && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200" data-testid="invite-banner">
                  You&apos;ve been invited to join an organization. Sign in to accept.
                </div>
              )}
              <div className="flex justify-center lg:container">
                <AnimatedTabs selected={tab}>
                  <LoginFragment onLogin={handleLogin} error={error} callbackUrl={callbackUrl ?? undefined} key="login" />
                  <LoadingElement key="loading" />
                  <CheckElement key="check" />
                </AnimatedTabs>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </LayoutGroup>
    </div>
  );
};

export default Login;
