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

// Dev-only quick login panel — lazy-loaded and tree-shaken in production builds.
const DevQuickLogin =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('@/components/Dev/DevQuickLogin'), { ssr: false })
    : () => null;

import { IS_SELF_HOST } from '@/lib/auth/self-host';

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
   * cannot switch to OAuth providers. Used on slug-tagged preview hosts
   * where Google/Microsoft callback URIs are not (and cannot reasonably
   * be) registered against the OAuth client.
   */
  previewOnly?: boolean;
}

const LoginFragment = ({
  onLogin: handleLogin,
  error,
  callbackUrl,
  previewOnly = false,
}: LoginProps) => {
  const [authTab, setAuthTab] = useState<AuthTab>(previewOnly ? 'email' : 'oauth');

  return (
    <div className="flex flex-wrap">
      <div className="flex flex-1 flex-col gap-14">
        {/* Header — tagline */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-center">
            <UnifyLogo />
          </div>
          <h1 className="text-center text-4xl leading-[1] tracking-[-0.02em] text-gray-800 dark:text-white sm:text-5xl">
            Hire AI <span className="font-serif italic">— Not APIs</span>
          </h1>
        </div>

        {/* Content — auth buttons / email form */}
        <div className="flex flex-col gap-3">
          {error && authTab === 'oauth' && (
            <div className="text-red-500" data-testid="oauth-error">
              {error}
            </div>
          )}

          {authTab === 'oauth' ? (
            <>
              <HallowButton onClick={handleLogin('google')}>
                <div className="flex items-center justify-center gap-2">
                  <Image src={GoogleIcon} alt="Google" height={20} width={20} />
                  Continue with Google
                </div>
              </HallowButton>
              <HallowButton onClick={handleLogin('azure-ad')}>
                <div className="flex items-center justify-center gap-2">
                  <Image src={MicrosoftIcon} alt="Microsoft" height={20} width={20} />
                  Continue with Microsoft
                </div>
              </HallowButton>

              <div className="my-1 flex items-center gap-3">
                <div className="h-[1px] flex-1 bg-[var(--border-light)]" />
                <span className="text-caption text-muted-foreground">or</span>
                <div className="h-[1px] flex-1 bg-[var(--border-light)]" />
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
              {!previewOnly && (
                <>
                  <div className="my-1 flex items-center gap-3">
                    <div className="h-[1px] flex-1 bg-[var(--border-light)]" />
                    <span className="text-caption text-muted-foreground">or</span>
                    <div className="h-[1px] flex-1 bg-[var(--border-light)]" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setAuthTab('oauth')}
                    className="text-caption text-center text-muted-foreground transition-colors hover:text-foreground"
                    data-testid="switch-to-oauth"
                  >
                    Sign in with Google or Microsoft
                  </button>
                </>
              )}
            </>
          )}

          {/* Dev-only quick login (hidden for self-host installs) */}
          {!IS_SELF_HOST && <DevQuickLogin />}
        </div>

        {/* Footer — disclaimer */}
        <div className="text-branding-grey text-body">
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
            Terms Of Service
          </a>
          {'.'}
        </div>
      </div>
    </div>
  );
};

export default LoginFragment;
