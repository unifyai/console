'use client';

import * as React from 'react';
import { listProviderIntegrationDefinitionsBySlugs } from '@/lib/client/integrations';
import { logicalAppKey } from '@/lib/client/provider-resolution';
import type { IntegrationDefinition } from '@/types/integrations';

/**
 * The slugs worth asking the gallery about for one requirement.
 *
 * The gallery is queried by exact `canonical_app_slug`, and one app can be
 * stored under either spelling of a compound name: a Composio connection
 * reports `google_calendar` while the toolkit it came from is
 * `googlecalendar`. A bundle naming the wrong one of the two got no row back
 * and rendered "couldn't check this app" about an app sitting in the gallery,
 * with a Connect button that had nothing to connect. `logicalAppKey` is the
 * same equivalence the gallery itself uses to fold those rows together.
 */
function candidateSlugs(slug: string): string[] {
  const logical = logicalAppKey({ canonicalAppSlug: slug });
  return logical === slug ? [slug] : [slug, logical];
}

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
}): {
  bySlug: Record<string, IntegrationDefinition | null>;
  /** True while a required slug still has no answer either way. */
  isResolving: boolean;
  /**
   * Drop a slug's answer so the next render resolves it again.
   *
   * An answer here is cached until something says it is stale, and a
   * connection landing is exactly that. Without this the shelf kept showing
   * "not connected" for an app the user had just connected, until a hard
   * reload — the drawer knew, and the cards behind it did not.
   */
  forget: (slug: string) => void;
} {
  const [bySlug, setBySlug] = React.useState<Record<string, IntegrationDefinition | null>>({});

  const forget = React.useCallback((slug: string) => {
    setBySlug((current) => {
      if (!(slug in current)) return current;
      const next = { ...current };
      delete next[slug];
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    const missing = slugs.filter((slug) => !knownSlugs.has(slug) && !(slug in bySlug));
    if (missing.length === 0) return;

    let cancelled = false;
    void (async () => {
      // One request for every missing slug, not one per slug. Each of those
      // was a full detail fetch that also pulled up to 500 tool rows for an
      // app whose tools no workflow surface renders — eight requirements
      // meant eight of them, the slowest measured at forty seconds.
      const found = await listProviderIntegrationDefinitionsBySlugs({
        ownerScope: 'assistant',
        assistantId: Number.isNaN(Number(assistantId)) ? assistantId : Number(assistantId),
        slugs: missing.flatMap(candidateSlugs),
      }).catch(() => [] as Awaited<ReturnType<typeof listProviderIntegrationDefinitionsBySlugs>>);
      if (cancelled) return;
      // Indexed under both the slug the gallery stores and the logical key
      // that folds its spellings together, so a requirement matches whichever
      // of the two the bundle happens to name.
      const byCanonical = new Map<string, IntegrationDefinition>();
      for (const item of found) {
        byCanonical.set(item.canonicalSlug, item);
        const logical = logicalAppKey({
          canonicalAppSlug: item.canonicalSlug,
          displayName: item.displayName,
        });
        if (!byCanonical.has(logical)) byCanonical.set(logical, item);
      }
      // A slug the gallery does not know is recorded as `null` rather than
      // left absent, so it reads as answered-and-absent instead of being
      // asked for again on every render.
      setBySlug((current) => ({
        ...current,
        ...Object.fromEntries(
          missing.map((slug) => [
            slug,
            candidateSlugs(slug)
              .map((candidate) => byCanonical.get(candidate))
              .find(Boolean) ?? null,
          ])
        ),
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, slugs, knownSlugs, bySlug, assistantId]);

  // Outstanding until every required slug is either in the base map or has
  // been answered here — including answered with `null`. Without this the
  // shelf called itself resolved the moment the *browse* page landed and
  // rendered every not-yet-fetched app as "Couldn't check this app" for a
  // few seconds, which is a verdict it did not have.
  const isResolving = React.useMemo(
    () => enabled && slugs.some((slug) => !knownSlugs.has(slug) && !(slug in bySlug)),
    [enabled, slugs, knownSlugs, bySlug]
  );

  return { bySlug, isResolving, forget };
}
