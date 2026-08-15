'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Textarea } from '@/components/UI/textarea';
import UnifyLogo from '@/components/Common/Misc/UnifyLogo';
import { ResponseProps } from '@/types/common';
import { clearFirstTouch, firstTouchAttribution, readFirstTouch } from '@/utils/user/firstTouch';

export const HEARD_ABOUT_CHANNELS = [
  {
    id: 'outbound_email',
    label: 'Outbound email',
    description: 'Cold email or outreach campaign',
  },
  {
    id: 'referral',
    label: 'Referral / invite link',
    description: 'Someone shared a Unify referral link',
  },
  {
    id: 'friend',
    label: 'Friend or colleague',
    description: 'Word of mouth, not a formal invite',
  },
  {
    id: 'social',
    label: 'Social media',
    description: 'X, LinkedIn, Discord, etc.',
  },
  {
    id: 'github',
    label: 'GitHub',
    description: 'Repo, issue, or star',
  },
  {
    id: 'search',
    label: 'Search',
    description: 'Google, Bing, or similar',
  },
  {
    id: 'content',
    label: 'Content',
    description: 'Blog, podcast, YouTube, or article',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Something else',
  },
] as const;

export type HeardAboutChannel = (typeof HEARD_ABOUT_CHANNELS)[number]['id'];

const DETAIL_CHANNELS: ReadonlySet<HeardAboutChannel> = new Set([
  'outbound_email',
  'referral',
  'friend',
  'other',
]);

interface HeardAboutContentProps {
  /** Resolves to `null` on success, or a `{ detail }` failure reason. */
  onUpdateOnboarding: (update: {
    currentStep: string;
    stepData?: Record<string, unknown>;
  }) => Promise<ResponseProps | null>;
  /** Server action that patches the JWT cookie and redirects. */
  onPatchSession: (
    patch: { onboardingStep?: string; mfaPending?: boolean },
    redirectTo?: string,
    extraParams?: Record<string, string>
  ) => Promise<never>;
}

/**
 * First account-onboarding step: how the user heard about Unify.
 *
 * Sends the self-reported channel together with the browser's remembered
 * first touch (UTMs, external referrer, landing URL), so observed and
 * claimed attribution land in the same `step_data` row.
 *
 * Advances to workspace_setup and stays on /login/onboarding so the
 * workspace picker renders next.
 */
const HeardAboutContent = ({ onUpdateOnboarding, onPatchSession }: HeardAboutContentProps) => {
  const [channel, setChannel] = useState<HeardAboutChannel | null>(null);
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const showDetail = channel !== null && DETAIL_CHANNELS.has(channel);
  const detailRequired = channel === 'other';

  const handleContinue = useCallback(async () => {
    if (!channel) {
      setError('Please select an option.');
      return;
    }
    const trimmed = detail.trim();
    if (detailRequired && trimmed.length < 2) {
      setError('Please add a short note about how you found us.');
      return;
    }

    setError(undefined);
    setIsLoading(true);

    const firstTouch = readFirstTouch();
    let failure: ResponseProps | null;
    try {
      failure = await onUpdateOnboarding({
        currentStep: 'workspace_setup',
        stepData: {
          heardAbout: channel,
          ...(trimmed ? { heardAboutDetail: trimmed.slice(0, 500) } : {}),
          ...(firstTouch ? firstTouchAttribution(firstTouch) : {}),
        },
      });
    } catch {
      failure = { detail: 'Failed to save. Please try again.' };
    }

    if (failure) {
      setError(failure.detail);
      setIsLoading(false);
      return;
    }

    clearFirstTouch();
    await onPatchSession({ onboardingStep: 'workspace_setup' }, '/login/onboarding');
  }, [channel, detail, detailRequired, onUpdateOnboarding, onPatchSession]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="m-auto flex w-full max-w-md flex-col gap-8"
    >
      <div className="flex flex-col items-center gap-6">
        <div className="flex justify-center">
          <UnifyLogo />
        </div>
        <div className="text-center">
          <h1 className="text-h1 font-semibold">How did you hear about us?</h1>
          <p className="text-body mt-2 text-muted-foreground">
            This helps us understand what&apos;s working. One quick answer, then you&apos;re in.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2" data-testid="heard-about-options">
        {HEARD_ABOUT_CHANNELS.map((option) => {
          const selected = channel === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setChannel(option.id);
                setError(undefined);
              }}
              disabled={isLoading}
              className={`group flex items-center gap-4 rounded-lg border p-3 text-left transition-all ${
                selected
                  ? 'border-primary bg-primary-tint-5 ring-1 ring-primary'
                  : 'hover:bg-muted/50 border-border hover:border-primary-tint-50'
              } ${isLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} `}
              data-testid={`heard-about-${option.id}`}
            >
              <div className="flex-1">
                <p className="font-medium text-foreground">{option.label}</p>
                <p className="text-caption text-muted-foreground">{option.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {showDetail && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-2"
        >
          <label htmlFor="heard-about-detail" className="text-caption font-medium text-foreground">
            {detailRequired ? 'Tell us more' : 'Anything else? (optional)'}
          </label>
          <Textarea
            id="heard-about-detail"
            placeholder={
              channel === 'outbound_email'
                ? 'e.g. email about Unify / Stargazer'
                : channel === 'friend'
                  ? 'e.g. who told you'
                  : 'A few words is enough'
            }
            value={detail}
            onChange={(e) => {
              setDetail(e.target.value);
              setError(undefined);
            }}
            disabled={isLoading}
            rows={3}
            maxLength={500}
            data-testid="heard-about-detail"
          />
        </motion.div>
      )}

      {error && (
        <p className="text-body text-error" data-testid="heard-about-error">
          {error}
        </p>
      )}

      <Button
        onClick={handleContinue}
        disabled={isLoading || !channel}
        className="w-full"
        data-testid="heard-about-continue"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </motion.div>
  );
};

export default HeardAboutContent;
