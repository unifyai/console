'use client';

import { useState } from 'react';
import Image from 'next/image';
import HallowButton from './hallowButton';
import GoogleIcon from '@/public/icons/google-icon.png';
import GithubIcon from '@/public/icons/github-icon.png';
import { Mail } from 'lucide-react';
import EmailLoginForm from './email-login';

/** Auth method tabs */
type AuthTab = 'oauth' | 'email';

interface LoginProps {
  // eslint-disable-next-line no-unused-vars
  onLogin: (provider: 'email' | 'google' | 'github', email?: string) => () => void;
  error?: string;
  /** Callback URL for email login redirect */
  callbackUrl?: string;
}

const LoginFragment = ({ onLogin: handleLogin, error, callbackUrl }: LoginProps) => {
  const [authTab, setAuthTab] = useState<AuthTab>('oauth');

  return (
    <div className="flex flex-wrap gap-16">
      <div className="flex flex-1 flex-col gap-[40px]">
        <h1 className="text-center text-4xl leading-tight text-gray-800 dark:text-white sm:text-5xl">
          Hire <span className="font-bold">AI </span>
          - Not <span className="font-bold">APIs</span>
        </h1>
        <div className="flex flex-col gap-3">
          {error && authTab === 'oauth' && (
            <div className="text-red-500" data-testid="oauth-error">{error}</div>
          )}

          {authTab === 'oauth' ? (
            <>
              <HallowButton onClick={handleLogin('google')}>
                <div className="flex items-center justify-center gap-2">
                  <Image src={GoogleIcon} alt="Google" height={20} width={20} />
                  Continue with Google
                </div>
              </HallowButton>
              <HallowButton onClick={handleLogin('github')}>
                <div className="flex items-center justify-center gap-2">
                  <Image src={GithubIcon} alt="Github" height={20} width={20} />
                  Continue with Github
                </div>
              </HallowButton>

              <div className="flex items-center gap-3 my-1">
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
              <div className="flex items-center gap-3 my-1">
                <div className="h-[1px] flex-1 bg-[var(--border-light)]" />
                <span className="text-caption text-muted-foreground">or</span>
                <div className="h-[1px] flex-1 bg-[var(--border-light)]" />
              </div>
              <button
                type="button"
                onClick={() => setAuthTab('oauth')}
                className="text-caption text-muted-foreground hover:text-foreground transition-colors text-center"
                data-testid="switch-to-oauth"
              >
                Sign in with Google or Github
              </button>
            </>
          )}

          <div className="text-branding-grey text-body">
            {'By signing up you agree to our '}
            <a href="https://unify.ai/privacy-policy" className="font-semibold">
              Privacy Policy
            </a>
            {' and '}
            <a href="https://unify.ai/terms-of-service" className="font-semibold">
              Terms Of Service
            </a>
            {
              '. You may also receive communication on product updates and events, which you can edit in your profile.'
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginFragment;
