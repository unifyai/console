'use client';

import { Check, Cpu, FolderTree, HelpCircle, KeyRound } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { WorkflowAppIcon } from './WorkflowAppIcon';
import { WORKFLOW_CAPABILITY_COPY } from './workflowCategories';
import {
  requirementNeedsConnection,
  requirementNeedsSecret,
  requirementNeedsWorkspace,
  type Workflow,
  type WorkflowRequirement,
} from '@/types/workflows';

/**
 * "What it needs", shown before the install button — a checklist, not a
 * warning. Nothing here is an error: an unmet requirement is one step
 * remaining.
 *
 * The affordance follows the route, because the fix differs and offering the
 * wrong one is worse than offering none. A provider-backed app opens the
 * gallery's connect handshake; a Workspace opens the same workspace manager
 * the profile pane and the onboarding checklist open; an app gated on secrets
 * names the secrets it is waiting for and routes to where secrets are
 * entered; `undeclared` has nothing to check and renders as met; `unresolved`
 * could not be checked and says so plainly — never a fabricated green check.
 */
export function WorkflowRequirementList({
  workflow,
  connectingSlug,
  isResolving,
  onConnect,
  onConnectWorkspace,
  onSupplySecret,
}: {
  workflow: Workflow;
  connectingSlug?: string | null;
  /** True while the integrations catalogue has not answered yet. */
  isResolving?: boolean;
  onConnect: (canonicalSlug: string) => void;
  /** Opens the workspace manager — the profile and onboarding flow's own view. */
  onConnectWorkspace?: () => void;
  /** Opens wherever secrets are entered for this assistant. */
  onSupplySecret?: (requirement: WorkflowRequirement) => void;
}) {
  return (
    <div className="divide-y overflow-hidden rounded-xl border bg-card-2">
      {workflow.requirements.map((requirement) => {
        const needsConnection = requirementNeedsConnection(requirement);
        const needsWorkspace = requirementNeedsWorkspace(requirement);
        const needsSecret = requirementNeedsSecret(requirement);
        const unresolved = requirement.via === 'unresolved';
        const met = !needsConnection && !needsWorkspace && !needsSecret && !unresolved;

        // A requirement the bundle lets the user satisfy more than one way,
        // and nothing connected yet: the choice is the action, so the row
        // offers every option instead of a single Connect for whichever app
        // the bundle happened to name first.
        const choices = met || isResolving ? [] : (requirement.options ?? []);

        return (
          <div
            key={requirement.canonicalSlug}
            className="flex items-center gap-3 p-3"
            data-testid={`workflow-requirement-${requirement.canonicalSlug}`}
          >
            {isResolving ? (
              <span className="bg-muted/50 h-[34px] w-[34px] shrink-0 animate-pulse rounded-lg" />
            ) : (
              <WorkflowAppIcon requirement={requirement} size="md" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-title text-sm">
                {choices.length > 1
                  ? choices.map((choice) => choice.displayName).join(' or ')
                  : requirement.displayName}
              </p>
              {isResolving ? (
                <span className="bg-muted/50 mt-1 block h-3 w-48 animate-pulse rounded" />
              ) : (
                <p className="text-caption">
                  {choices.length > 1
                    ? 'Connect whichever you already use — any one of them works'
                    : requirementStatusCopy(requirement)}
                </p>
              )}
              {choices.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {choices.map((choice) => (
                    <button
                      key={choice.canonicalSlug}
                      type="button"
                      disabled={connectingSlug === choice.canonicalSlug}
                      onClick={() => onConnect(choice.canonicalSlug)}
                      className="text-label flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 transition hover:border-primary hover:bg-accent-soft disabled:opacity-60"
                      data-testid={`workflow-requirement-option-${choice.canonicalSlug}`}
                    >
                      <WorkflowAppIcon
                        requirement={{
                          displayName: choice.displayName,
                          iconUrl: choice.iconUrl,
                          iconComponent: choice.iconComponent,
                        }}
                        size="xs"
                      />
                      {choice.displayName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isResolving ? (
              <span className="bg-muted/50 h-5 w-20 shrink-0 animate-pulse rounded-full" />
            ) : unresolved ? (
              <span
                className="text-label flex shrink-0 items-center gap-1.5 text-muted-foreground"
                data-testid={`workflow-requirement-unresolved-${requirement.canonicalSlug}`}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Unverified
              </span>
            ) : met ? (
              <span
                className="text-label text-semibold flex shrink-0 items-center gap-1.5 text-[color:var(--status-success)]"
                data-testid={`workflow-requirement-met-${requirement.canonicalSlug}`}
              >
                <Check className="h-3.5 w-3.5" />
                {requirement.via === 'undeclared' ? 'Built in' : 'Connected'}
              </span>
            ) : /* The chips are the action; a Connect button beside them
                   would silently pick one of the choices for the user. */
            choices.length > 1 ? null : needsConnection ? (
              <Button
                type="button"
                size="sm"
                className="h-7 px-2.5 text-xs"
                disabled={connectingSlug === requirement.canonicalSlug}
                onClick={() => onConnect(requirement.canonicalSlug)}
                data-testid={`workflow-requirement-connect-${requirement.canonicalSlug}`}
              >
                Connect
              </Button>
            ) : needsWorkspace ? (
              <Button
                type="button"
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => onConnectWorkspace?.()}
                data-testid={`workflow-requirement-workspace-${requirement.canonicalSlug}`}
              >
                Connect
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={() => onSupplySecret?.(requirement)}
                data-testid={`workflow-requirement-secret-${requirement.canonicalSlug}`}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Add {requirement.missingSecrets?.length === 1 ? 'secret' : 'secrets'}
              </Button>
            )}
          </div>
        );
      })}

      {workflow.capabilities.map((capability) => {
        const copy = WORKFLOW_CAPABILITY_COPY[capability];
        const CapabilityIcon = capability === 'computer' ? Cpu : FolderTree;
        return (
          <div key={capability} className="flex items-center gap-3 p-3">
            <span className="bg-muted/40 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border">
              <CapabilityIcon className="h-4 w-4 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-title text-sm">{copy.title}</p>
              <p className="text-caption">{copy.detail}</p>
            </div>
            <span className="text-label text-semibold flex shrink-0 items-center gap-1.5 text-[color:var(--status-success)]">
              <Check className="h-3.5 w-3.5" />
              Provisioned
            </span>
          </div>
        );
      })}
    </div>
  );
}

function requirementStatusCopy(requirement: WorkflowRequirement): string {
  if (requirementNeedsWorkspace(requirement)) {
    return "No workspace connected — this workflow can't act until one is";
  }
  if (requirementNeedsConnection(requirement)) {
    return "Not connected — this workflow can't act until it is";
  }
  if (requirementNeedsSecret(requirement)) {
    const secrets = requirement.missingSecrets ?? [];
    if (secrets.length === 0) return 'Needs a credential before this workflow can act';
    return `Needs ${secrets.join(', ')} before this workflow can act`;
  }
  if (requirement.via === 'unresolved') {
    return "Couldn't check this app — see the Integrations gallery";
  }
  if (requirement.via === 'undeclared') return 'Always available — nothing to connect';
  return requirement.accountLabel ?? 'Connected';
}
