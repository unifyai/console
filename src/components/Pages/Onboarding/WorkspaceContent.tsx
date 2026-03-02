'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { User, Users, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import UnifyLogo from '@/components/Common/Misc/UnifyLogo';
import LoadingElement from '@/components/Common/Loaders/LoadingElement';
import { ResponseProps } from '@/types/common';
import { Organization } from '@/types/organization';

interface WorkspaceContentProps {
  onCreateOrg: (name: string) => Promise<Organization | ResponseProps>;
  onUpdateOnboarding: (update: {
    currentStep: string;
    stepData?: Record<string, unknown>;
  }) => Promise<void>;
  /** Server action that patches the JWT cookie and redirects. */
  onPatchSession: (
    patch: { onboardingStep?: string; mfaPending?: boolean },
    redirectTo?: string,
    extraParams?: Record<string, string>,
  ) => Promise<never>;
  /**
   * When true, the component auto-completes onboarding on mount
   * (calls onPatchSession immediately). Used when the server component
   * detects the user already has an org (e.g. joined via invite).
   */
  autoComplete?: boolean;
}

/**
 * Client component for the workspace onboarding page.
 *
 * New users choose between:
 *   - "Just for me"  → personal workspace
 *   - "For my team"  → create an organization
 *
 * The server-side page component handles auto-completing if the user already
 * has organizations (e.g. joined via invite). This client component only
 * renders when the user has no orgs yet and actually needs to pick.
 *
 * On completion we call the `onPatchSession` server action which patches
 * the JWT cookie server-side (via `cookies().set()`) and redirects — more
 * reliable than `useSession().update()` and not URL-accessible (CSRF-safe).
 */
const WorkspaceContent = ({
  onCreateOrg,
  onUpdateOnboarding,
  onPatchSession,
  autoComplete = false,
}: WorkspaceContentProps) => {
  const [choice, setChoice] = useState<'personal' | 'organization' | null>(null);
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(autoComplete);
  const autoCompleteTriggered = useRef(false);

  // Auto-complete onboarding on mount when the user already has an org.
  // Server actions can modify cookies when called from a client component,
  // but NOT during a server component render — hence this runs here.
  useEffect(() => {
    if (!autoComplete || autoCompleteTriggered.current) return;
    autoCompleteTriggered.current = true;
    onPatchSession({ onboardingStep: 'completed' }).catch(() => {
      // If the patch fails, show the normal onboarding UI
      setIsLoading(false);
    });
  }, [autoComplete, onPatchSession]);

  // Show a loading state while auto-completing
  if (autoComplete && isLoading) {
    return (
      <div className="m-auto flex items-center justify-center">
        <LoadingElement />
      </div>
    );
  }

  /**
   * Persist the onboarding step to the backend (best-effort) then call the
   * server action to patch the JWT cookie and redirect.
   */
  const completeAndRedirect = useCallback(
    async (stepData: Record<string, unknown>) => {
      try {
        await onUpdateOnboarding({ currentStep: 'completed', stepData });
      } catch {
        // Best-effort: the server-side idempotency check handles the gap.
        console.warn('[onboarding] Failed to persist step completion — will auto-complete on next visit');
      }

      // Collect current URL params (e.g. credit tokens) to forward.
      const extraParams: Record<string, string> = {};
      const current = new URLSearchParams(window.location.search);
      current.forEach((value, key) => { extraParams[key] = value; });

      await onPatchSession({ onboardingStep: 'completed' }, '/assistants', extraParams);
    },
    [onUpdateOnboarding, onPatchSession],
  );

  const handlePersonal = useCallback(async () => {
    setError(undefined);
    setIsLoading(true);
    // Selecting "personal" has no side effect — repeating is harmless.
    await completeAndRedirect({ selectedType: 'personal' });
  }, [completeAndRedirect]);

  const handleCreateOrg = useCallback(async () => {
    const trimmed = orgName.trim();
    if (!trimmed) {
      setError('Please enter an organization name.');
      return;
    }

    setError(undefined);
    setIsLoading(true);

    try {
      const result = await onCreateOrg(trimmed);

      // Check for error response
      if ('detail' in result) {
        setError((result as ResponseProps).detail);
        setIsLoading(false);
        return;
      }

      const org = result as Organization;

      // Set the workspace cookie to the new org
      await fetch('/api/session/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: String(org.id) }),
      });

      await completeAndRedirect({
        selectedType: 'organization',
        organizationId: String(org.id),
        organizationName: org.name,
      });
    } catch {
      setError('Failed to create organization. Please try again.');
      setIsLoading(false);
    }
  }, [orgName, onCreateOrg, completeAndRedirect]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="m-auto flex w-full max-w-md flex-col gap-8"
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-6">
        <div className="flex justify-center"><UnifyLogo /></div>
        <div className="text-center">
          <h1 className="text-h1 font-semibold">Welcome to Unify</h1>
          <p className="mt-2 text-body text-muted-foreground">
            How do you plan to use the platform?
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            setChoice('personal');
            setError(undefined);
          }}
          disabled={isLoading}
          className={`group flex items-center gap-4 rounded-lg border p-4 text-left transition-all
            ${choice === 'personal'
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
            }
            ${isLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
          `}
          data-testid="workspace-personal"
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full
            ${choice === 'personal' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground group-hover:text-foreground'}
          `}>
            <User className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Just for me</p>
            <p className="text-caption text-muted-foreground">
              Personal workspace for individual use
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setChoice('organization');
            setError(undefined);
          }}
          disabled={isLoading}
          className={`group flex items-center gap-4 rounded-lg border p-4 text-left transition-all
            ${choice === 'organization'
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
            }
            ${isLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
          `}
          data-testid="workspace-organization"
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full
            ${choice === 'organization' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground group-hover:text-foreground'}
          `}>
            <Users className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">For my team</p>
            <p className="text-caption text-muted-foreground">
              Create an organization to collaborate with others
            </p>
          </div>
        </button>
      </div>

      {/* Organization name input (shown when "For my team" is selected) */}
      {choice === 'organization' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-3"
        >
          <div>
            <label htmlFor="org-name" className="text-caption font-medium text-foreground">
              Organization name
            </label>
            <Input
              id="org-name"
              type="text"
              placeholder="e.g. Acme Corp"
              value={orgName}
              onChange={(e) => {
                setOrgName(e.target.value);
                setError(undefined);
              }}
              disabled={isLoading}
              autoFocus
              data-testid="org-name-input"
            />
          </div>
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <p className="text-body text-error" data-testid="workspace-error">
          {error}
        </p>
      )}

      {/* Action button */}
      {choice && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Button
            onClick={choice === 'personal' ? handlePersonal : handleCreateOrg}
            disabled={isLoading || (choice === 'organization' && !orgName.trim())}
            className="w-full"
            data-testid="workspace-continue"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {choice === 'organization' ? 'Creating organization...' : 'Setting up...'}
              </>
            ) : (
              <>
                {choice === 'organization' ? 'Create Organization' : 'Continue'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </motion.div>
      )}

      {/* Footer note */}
      <p className="text-center text-caption text-muted-foreground">
        You can always create an organization later from settings.
      </p>
    </motion.div>
  );
};

export default WorkspaceContent;
