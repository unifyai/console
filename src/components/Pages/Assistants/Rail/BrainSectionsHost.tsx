'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { SectionBodySkeleton } from '@/components/Common/Loaders/Skeletons';
import type { Assistant } from '@/types/assistants/assistant';

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

interface BrainSectionsHostProps {
  assistant: Assistant;
  activeSectionId: string;
  onManageContacts: () => void;
}

function BrainPaneFallback() {
  return <SectionBodySkeleton className="h-full" />;
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
}: BrainSectionsHostProps) {
  const brainProps = {
    assistant,
    ownerId: assistant.userId,
    assistantId: assistant.agentId,
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

  const renderPane = (sectionId: BrainSectionId) => {
    switch (sectionId) {
      case 'contacts':
        return <ContactsPane {...brainProps} onManageContacts={onManageContacts} />;
      case 'functions':
        return <FunctionsPane {...brainProps} />;
      case 'guidance':
        return <DocLibraryPane {...brainProps} kind="guidance" />;
      case 'knowledge':
        return <DocLibraryPane {...brainProps} kind="knowledge" />;
      case 'data':
        return <DataPane {...brainProps} />;
      case 'transcripts':
        return <TranscriptsPane {...brainProps} />;
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
              <React.Suspense fallback={<BrainPaneFallback />}>
                {renderPane(sectionId)}
              </React.Suspense>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
