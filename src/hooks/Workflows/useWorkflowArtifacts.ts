'use client';

import * as React from 'react';
import { fetchWorkflowContent } from '@/lib/client/workflows';
import { contentRowToArtifact } from '@/utils/workflows/workflowRows';
import {
  mockWorkflowArtifacts,
  shouldUseMockWorkflows,
} from '@/utils/assistants/workflow-mock-data';
import type { WorkflowArtifact } from '@/types/workflows';

/**
 * The published artifacts of one workflow — what its procedures, claims,
 * tasks and functions actually say — read from the public Builtins content
 * context so the drawer can preview any of them before an install. Fetched
 * once per slug and kept for the session; the catalogue only changes on a
 * deploy.
 */
export function useWorkflowArtifacts(slug: string | null, { enabled = true } = {}) {
  const [bySlug, setBySlug] = React.useState<Record<string, WorkflowArtifact[]>>({});
  const [loadingSlug, setLoadingSlug] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled || !slug || slug in bySlug) return;
    if (shouldUseMockWorkflows()) {
      setBySlug((current) => ({ ...current, [slug]: mockWorkflowArtifacts(slug) }));
      return;
    }
    let cancelled = false;
    setLoadingSlug(slug);
    void (async () => {
      let artifacts: WorkflowArtifact[] = [];
      try {
        const rows = await fetchWorkflowContent(slug);
        artifacts = rows.flatMap((row) => {
          const artifact = contentRowToArtifact(row);
          return artifact ? [artifact] : [];
        });
      } catch (error) {
        console.error('Failed to load workflow artifacts', error);
      }
      if (cancelled) return;
      setBySlug((current) => ({ ...current, [slug]: artifacts }));
      setLoadingSlug((current) => (current === slug ? null : current));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, slug, bySlug]);

  return {
    artifacts: slug ? (bySlug[slug] ?? []) : [],
    isLoading: !!slug && loadingSlug === slug,
  };
}
