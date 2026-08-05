'use client';

import { Check, Cpu, FolderTree } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { WorkflowAppIcon } from './WorkflowAppIcon';
import { WORKFLOW_CAPABILITY_COPY } from './workflowCategories';
import type { Workflow } from '@/types/workflows';

/**
 * "What it needs", shown before the install button — a checklist, not a warning.
 * Each unconnected app carries its own Connect action so the user never has to
 * leave for the integrations gallery and find their way back.
 */
export function WorkflowRequirementList({
  workflow,
  connectingSlug,
  onConnect,
}: {
  workflow: Workflow;
  connectingSlug?: string | null;
  onConnect: (canonicalSlug: string) => void;
}) {
  return (
    <div className="divide-y overflow-hidden rounded-xl border bg-card-2">
      {workflow.requirements.map((requirement) => (
        <div key={requirement.canonicalSlug} className="flex items-center gap-3 p-3">
          <WorkflowAppIcon requirement={requirement} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-title text-sm">{requirement.displayName}</p>
            <p className="text-caption">
              {requirement.connected
                ? requirement.builtin
                  ? 'Built in — always available'
                  : requirement.accountLabel
                : "Not connected — this workflow can't act until it is"}
            </p>
          </div>
          {requirement.connected ? (
            <span className="text-label text-semibold flex shrink-0 items-center gap-1.5 text-[color:var(--status-success)]">
              <Check className="h-3.5 w-3.5" />
              Connected
            </span>
          ) : (
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
          )}
        </div>
      ))}

      {workflow.capabilities.map((capability) => {
        const copy = WORKFLOW_CAPABILITY_COPY[capability];
        const CapabilityIcon = capability === 'computer' ? Cpu : FolderTree;
        return (
          <div key={capability} className="flex items-center gap-3 p-3">
            <span className="bg-muted/40 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border">
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
