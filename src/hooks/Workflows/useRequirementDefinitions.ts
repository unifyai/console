'use client';

import * as React from 'react';
import { getProviderIntegrationDetails } from '@/lib/client/integrations';
import type { IntegrationDefinition } from '@/types/integrations';

/**
 * Gallery definitions for requirement slugs the browse catalogue does not
 * happen to carry.
 *
 * The integrations catalogue loads one alphabetical page plus the pinned
 * connected/needs-attention apps — plenty for browsing, but a workflow may
 * require an unconnected app that sorts far past the first page (Gmail in a
 * ~1k-row catalogue), and resolving against that partial map once rendered a
 * real app as "Built in". Each slug the base map lacks is fetched directly,
 * once; a slug the gallery genuinely does not know stays `null` so the
 * requirement renders as unverifiable rather than refetching forever.
 */
export function useRequirementDefinitions({
  assistantId,
  slugs,
  knownSlugs,
  enabled = true,
}: {
  assistantId: string;
  /** Requirement slugs the shelf currently shows. */
  slugs: string[];
  /** Slugs the base catalogue already resolves — never refetched here. */
  knownSlugs: Set<string>;
  enabled?: boolean;
}): Record<string, IntegrationDefinition | null> {
  const [bySlug, setBySlug] = React.useState<Record<string, IntegrationDefinition | null>>({});

  React.useEffect(() => {
    if (!enabled) return;
    const missing = slugs.filter((slug) => !knownSlugs.has(slug) && !(slug in bySlug));
    if (missing.length === 0) return;

    let cancelled = false;
    void Promise.all(
      missing.map(async (slug) => {
        try {
          const detail = await getProviderIntegrationDetails({
            ownerScope: 'assistant',
            assistantId: Number.isNaN(Number(assistantId)) ? assistantId : Number(assistantId),
            canonicalSlug: slug,
          });
          return [slug, detail] as const;
        } catch {
          return [slug, null] as const;
        }
      })
    ).then((entries) => {
      if (cancelled || entries.length === 0) return;
      setBySlug((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, slugs, knownSlugs, bySlug, assistantId]);

  return bySlug;
}
