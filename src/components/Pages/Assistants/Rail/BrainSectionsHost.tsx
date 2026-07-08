'use client';

import * as React from 'react';
import { AssistantSectionSkeleton } from '@/components/Common/Loaders/Skeletons';
import { cn } from '@/lib/utils';
import type { Assistant } from '@/types/assistants/assistant';
import type { ContextRoot } from '@/lib/assistants/scope';

const ContactsPane = React.lazy(() =>
  import('../Contacts/ContactsPane').then((m) => ({ default: m.ContactsPane }))
);
const FunctionsPane = React.lazy(() =>
  import('../Functions/FunctionsPane').then((m) => ({ default: m.FunctionsPane }))
);
const DocLibraryPane = React.lazy(() =>
  import('../DocLibrary/DocLibraryPane').then((m) => ({ default: m.DocLibraryPane }))
);
const DataPane = React.lazy(() =>
  import('../Data/DataPane').then((m) => ({ default: m.DataPane }))
);
const TranscriptsPane = React.lazy(() =>
  import('../Transcripts/TranscriptsPane').then((m) => ({ default: m.TranscriptsPane }))
);

const BRAIN_SECTION_IDS = [
  'contacts',
  'transcripts',
  'knowledge',
  'functions',
  'guidance',
  'data',
] as const;

type BrainSectionId = (typeof BRAIN_SECTION_IDS)[number];

const preloadBrainPaneById = {
  contacts: () => import('../Contacts/ContactsPane'),
  functions: () => import('../Functions/FunctionsPane'),
  guidance: () => import('../DocLibrary/DocLibraryPane'),
  knowledge: () => import('../DocLibrary/DocLibraryPane'),
  data: () => import('../Data/DataPane'),
  transcripts: () => import('../Transcripts/TranscriptsPane'),
} satisfies Record<BrainSectionId, () => Promise<unknown>>;

interface BrainSectionsHostProps {
  assistant: Assistant;
  activeSectionId: string;
  onManageContacts: () => void;
  isActiveSurface?: boolean;
}

/**
 * Brain panes load on first visit and stay mounted (hidden when inactive) so tab
 * switches do not refetch, while the initial /assistants load avoids pulling
 * every pane into the first bundle.
 */
export function BrainSectionsHost({
  assistant,
  activeSectionId,
  onManageContacts,
  isActiveSurface = true,
}: BrainSectionsHostProps) {
  // Team-owned assistants have no personal root: every brain surface is
  // pinned to the owning team's shared root (mirrors TeamBrainSectionsHost).
  const ownerTeamId = assistant.ownerTeamId ?? null;
  const fixedRoot = React.useMemo<ContextRoot | null>(
    () => (ownerTeamId !== null ? { kind: 'team', teamId: ownerTeamId } : null),
    [ownerTeamId]
  );
  const brainProps = {
    assistant,
    ownerId: assistant.userId,
    assistantId: assistant.agentId,
    root: fixedRoot,
  };

  const [mountedSections, setMountedSections] = React.useState<Set<BrainSectionId>>(() => {
    const initial = new Set<BrainSectionId>();
    if (BRAIN_SECTION_IDS.includes(activeSectionId as BrainSectionId)) {
      initial.add(activeSectionId as BrainSectionId);
    }
    return initial;
  });

  React.useEffect(() => {
    if (!BRAIN_SECTION_IDS.includes(activeSectionId as BrainSectionId)) return;
    const sectionId = activeSectionId as BrainSectionId;
    setMountedSections((current) => {
      if (current.has(sectionId)) return current;
      const next = new Set(current);
      next.add(sectionId);
      return next;
    });
  }, [activeSectionId]);

  React.useEffect(() => {
    if (!BRAIN_SECTION_IDS.includes(activeSectionId as BrainSectionId)) return;
    void preloadBrainPaneById[activeSectionId as BrainSectionId]();
  }, [activeSectionId]);

  React.useEffect(() => {
    if (!isActiveSurface) return;
    const handle = window.setTimeout(() => {
      BRAIN_SECTION_IDS.forEach((sectionId) => {
        void preloadBrainPaneById[sectionId]();
      });
    }, 0);
    return () => window.clearTimeout(handle);
  }, [isActiveSurface]);

  const renderPane = (sectionId: BrainSectionId, sectionActive: boolean) => {
    const paneEnabled = sectionActive && isActiveSurface;
    switch (sectionId) {
      case 'contacts':
        return (
          <ContactsPane {...brainProps} onManageContacts={onManageContacts} enabled={paneEnabled} />
        );
      case 'functions':
        return <FunctionsPane {...brainProps} isActiveSurface={sectionActive && isActiveSurface} />;
      case 'guidance':
        return <DocLibraryPane {...brainProps} kind="guidance" enabled={paneEnabled} />;
      case 'knowledge':
        return <DocLibraryPane {...brainProps} kind="knowledge" enabled={paneEnabled} />;
      case 'data':
        return <DataPane {...brainProps} enabled={paneEnabled} />;
      case 'transcripts':
        return <TranscriptsPane {...brainProps} enabled={paneEnabled} />;
      default:
        return null;
    }
  };

  return (
    <>
      {BRAIN_SECTION_IDS.map((sectionId) => {
        const isActive = activeSectionId === sectionId;
        const isMounted = mountedSections.has(sectionId);
        return (
          <div
            key={sectionId}
            className={cn('h-full min-h-0', !isActive && 'hidden')}
            data-testid={`brain-section-${sectionId}`}
            data-active={isActive || undefined}
            aria-hidden={!isActive}
          >
            {isMounted ? (
              <React.Suspense
                fallback={<AssistantSectionSkeleton sectionId={sectionId} className="h-full" />}
              >
                {renderPane(sectionId, isActive)}
              </React.Suspense>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
