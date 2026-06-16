'use client';

import { useState } from 'react';
import Image from 'next/image';
import HallowButton from './HallowButton';
import GoogleIcon from '@/public/icons/google-icon.png';
import MicrosoftIcon from '@/public/icons/microsoft-icon.png';
import { Mail } from 'lucide-react';
import EmailLoginForm from './EmailLoginForm';
import UnifyLogo from '@/components/Common/Misc/UnifyLogo';
import dynamic from 'next/dynamic';
import { useEnvironment, useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';

// Dev-only quick login panel — lazy-loaded and tree-shaken in production builds.
const DevQuickLogin =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('@/components/Dev/DevQuickLogin'), { ssr: false })
    : () => null;

/** Auth method tabs */
type AuthTab = 'oauth' | 'email';

interface LoginProps {
  // eslint-disable-next-line no-unused-vars
  onLogin: (provider: 'email' | 'google' | 'azure-ad', email?: string) => () => void;
  error?: string;
  /** Callback URL for email login redirect */
  callbackUrl?: string;
  /**
   * When true, only the email + password form is shown and the user
   * cannot switch to OAuth providers (e.g. self-host deployments that
   * have no OAuth client registered).
   */
  emailOnly?: boolean;
}

const LoginFragment = ({
  onLogin: handleLogin,
  error,
  callbackUrl,
  emailOnly = false,
}: LoginProps) => {
  const { loginGoogle, loginMicrosoft } = useFeatures();
  const env = useEnvironment();
  // Topology-driven (not credential-driven): dev seed quick-login only in local dev.
  const devQuickLogin = env.isDev;

  // Only offer OAuth when at least one provider is actually configured for this
  // deployment (self-host may run email/password only).
  const hasOAuth = loginGoogle || loginMicrosoft;
  const oauthLabel = [loginGoogle && 'Google', loginMicrosoft && 'Microsoft']
    .filter(Boolean)
    .join(' or ');

  const [authTab, setAuthTab] = useState<AuthTab>(emailOnly || !hasOAuth ? 'email' : 'oauth');

  return (
    <div className="flex flex-wrap">
      <div className="flex flex-1 flex-col gap-10">
        {/* Header */}
        <div className="relative flex flex-col items-center gap-6 text-center">
          <div className="flex justify-center">
            <UnifyLogo />
          </div>
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <span className="h-2 w-2 rounded-[2px] bg-primary" />
            Welcome aboard
          </div>
          <div className="grid gap-4">
            <h1 className="text-brand-display text-foreground">
              Meet your first <span className="text-brand-serif-accent">droid.</span>
            </h1>
            <p className="mx-auto max-w-[34rem] text-[15px] leading-6 text-muted-foreground">
              {env.isSelfHost
                ? 'No prompting, no setup, no jargon. Create your account and hop on a call with the teammate who takes tedious work off your plate.'
                : 'No prompting, no setup, no jargon. Sign in and hop on a call with the teammate who takes tedious work off your plate.'}
            </p>
          </div>
        </div>

        {/* Content — auth buttons / email form */}
        <div className="flex flex-col gap-3">
          {error && authTab === 'oauth' && (
            <div className="text-body text-error" data-testid="oauth-error">
              {error}
            </div>
          )}

          {authTab === 'oauth' ? (
            <>
              {loginGoogle && (
                <HallowButton onClick={handleLogin('google')}>
                  <div className="flex items-center justify-center gap-2">
                    <Image src={GoogleIcon} alt="Google" height={20} width={20} />
                    Continue with Google
                  </div>
                </HallowButton>
              )}
              {loginMicrosoft && (
                <HallowButton onClick={handleLogin('azure-ad')}>
                  <div className="flex items-center justify-center gap-2">
                    <Image src={MicrosoftIcon} alt="Microsoft" height={20} width={20} />
                    Continue with Microsoft
                  </div>
                </HallowButton>
              )}

              <div className="my-1 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-caption text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <HallowButton onClick={() => setAuthTab('email')} data-testid="email-auth-tab">
                <div className="flex items-center justify-center gap-2">
                  <Mail className="h-5 w-5" />
                  Continue with Email
                </div>
              </HallowButton>
            </>
          ) : (
            <>
              <EmailLoginForm callbackUrl={callbackUrl} externalError={error} />
              {!emailOnly && hasOAuth && (
                <>
                  <div className="my-1 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-caption text-muted-foreground">or</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setAuthTab('oauth')}
                    className="text-caption text-center text-muted-foreground transition-colors hover:text-foreground"
                    data-testid="switch-to-oauth"
                  >
                    {`Sign in with ${oauthLabel}`}
                  </button>
                </>
              )}
            </>
          )}

          {/* Dev-only quick login (hidden for self-host installs) */}
          {devQuickLogin && <DevQuickLogin />}
        </div>

        {/* Footer — disclaimer */}
        <div className="text-body-muted">
          {'By signing up you agree to our '}
          <a
            href="https://unify.ai/privacy-policy"
            className="font-semibold text-primary underline"
          >
            Privacy Policy
          </a>
          {' and '}
          <a
            href="https://unify.ai/terms-of-service"
            className="font-semibold text-primary underline"
          >
            Terms of Service
          </a>
          {'.'}
        </div>
      </div>
    </div>
  );
};

export default LoginFragment;
