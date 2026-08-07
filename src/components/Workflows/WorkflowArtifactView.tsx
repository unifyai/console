'use client';

import * as React from 'react';
import { ArrowLeft, ChevronRight, Clock3 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Badge } from '@/components/UI/badge';
import { ScrollArea } from '@/components/UI/scroll-area';
import { SheetTitle } from '@/components/UI/sheet';
import { AssistantMarkdown } from '@/components/Pages/Assistants/Common/AssistantMarkdown';
import { WORKFLOW_SURFACES } from './workflowCategories';
import type { WorkflowArtifact, WorkflowSurfaceKind } from '@/types/workflows';

/**
 * One bundled artifact, read inside the workflow drawer.
 *
 * Deliberately not a Sheet of its own. Two stacked drawers put two overlays and
 * two close buttons on screen for what is one act of reading, and the reader has
 * to work out which layer they are in. This is a panel the drawer swaps to and
 * slides, so there is only ever one drawer, with a back arrow.
 *
 * The body is the published curated copy from the Builtins shelf. After an
 * install the planted row is the live copy and may diverge (the user owns it);
 * its own page — not this preview — is where edits happen and show.
 */
export function WorkflowArtifactView({
  artifact,
  isLoading,
  onBack,
  onNavigate,
}: {
  artifact: WorkflowArtifact | null;
  /** True while the workflow's artifacts are still arriving. */
  isLoading?: boolean;
  onBack: () => void;
  /** Opens the rail section where this artifact's kind lives. */
  onNavigate?: (kind: WorkflowSurfaceKind) => void;
}) {
  const surface = artifact ? WORKFLOW_SURFACES[artifact.kind] : null;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="workflow-artifact-view">
      <header className="flex items-center gap-2 border-b p-3.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onBack}
          aria-label="Back to the workflow"
          data-testid="workflow-artifact-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <SheetTitle className="text-h3 truncate">
            {artifact?.name ?? 'Loading preview'}
          </SheetTitle>
          {surface && (
            <p className="text-caption mt-0.5">
              {surface.label.replace(/s$/, '')} · lives in {surface.livesIn}
            </p>
          )}
        </div>
        {artifact?.schedule && (
          <Badge
            variant="outline"
            className="shrink-0 gap-1 rounded-full text-[10.5px] text-muted-foreground"
          >
            <Clock3 className="h-3 w-3" />
            {artifact.schedule}
          </Badge>
        )}
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4 sm:p-5">
          {isLoading && !artifact ? (
            <p className="text-body-muted">Loading the published copy…</p>
          ) : artifact?.body ? (
            <AssistantMarkdown>{artifact.body}</AssistantMarkdown>
          ) : (
            <p className="text-body-muted">
              Nothing published for this item yet — open it where it lives instead.
            </p>
          )}
        </div>
      </ScrollArea>

      {artifact && onNavigate && (
        <footer className="flex items-center justify-end border-t p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onNavigate(artifact.kind)}
            data-testid="workflow-artifact-open-section"
          >
            Open in {surface?.livesIn}
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </footer>
      )}
    </div>
  );
}
