'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import HallowButton from './HallowButton';
import UnifyLogo from '@/components/Common/Misc/UnifyLogo';

interface PreviewLoginProps {
  callbackUrl?: string;
}

/**
 * Preview-environment sign-in panel.
 *
 * Active only on slug-tagged Cloud Run preview revisions (the parent
 * page picks this fragment based on ``isPreviewHost``). Lets a Unify
 * team member sign in with just their ``@unify.ai`` email — the route
 * at ``/api/auth/preview-signin`` mints a pre-auth token, then standard
 * NextAuth credentials sign-in mints the real session cookie.
 */
const PreviewLoginFragment = ({ callbackUrl }: PreviewLoginProps) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setIsLoading(true);

    try {
      const preRes = await fetch('/api/auth/preview-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const preData = await preRes.json();

      if (!preRes.ok || !preData.preAuthToken) {
        setError(preData.message ?? 'Preview sign-in failed.');
        setIsLoading(false);
        return;
      }

      const result = await signIn('credentials', {
        email,
        password: '',
        preAuthToken: preData.preAuthToken,
        redirect: false,
        callbackUrl: callbackUrl ?? '/',
      });

      if (result?.error) {
        setError('Sign-in failed. Token may have expired — try again.');
        setIsLoading(false);
        return;
      }

      // ``signIn`` returns a URL built from ``NEXTAUTH_URL`` (the canonical
      // custom domain), but the session cookie was minted on the slug host.
      // Navigate same-origin so the cookie travels with the request and the
      // user lands on the slug, not on canonical.
      const target = callbackUrl?.startsWith('/') ? callbackUrl : '/';
      window.location.href = `${window.location.origin}${target}`;
    } catch {
      setError('Network error. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap">
      <div className="flex flex-1 flex-col gap-14">
        <div className="flex flex-col gap-4">
          <div className="flex justify-center">
            <UnifyLogo />
          </div>
          <h1 className="text-center text-4xl leading-[1] tracking-[-0.02em] text-gray-800 dark:text-white sm:text-5xl">
            Preview environment
          </h1>
          <p className="text-body-muted text-center">
            Sign in with your @unify.ai address to test this branch.
          </p>
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleLogin}>
          {error && (
            <div className="text-red-500" data-testid="preview-error">
              {error}
            </div>
          )}
          <input
            type="email"
            required
            autoFocus
            placeholder="you@unify.ai"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            data-testid="preview-email"
            className="rounded-md border border-[var(--border-light)] bg-transparent px-4 py-3 text-base outline-none focus:border-gray-500"
          />
          <HallowButton type="submit" disabled={isLoading || !email}>
            {isLoading ? 'Signing in…' : 'Sign in (preview)'}
          </HallowButton>
        </form>
      </div>
    </div>
  );
};

export default PreviewLoginFragment;
