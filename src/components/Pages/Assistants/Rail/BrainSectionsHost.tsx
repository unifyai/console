'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { SectionBodySkeleton } from '@/components/Common/Loaders/Skeletons';
import { ContactsPane } from '../Contacts/ContactsPane';
import { FunctionsPane } from '../Functions/FunctionsPane';
import { DocLibraryPane } from '../DocLibrary/DocLibraryPane';
import { DataPane } from '../Data/DataPane';
import type { Assistant } from '@/types/assistants/assistant';

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

/**
 * Renders every brain-view pane at once (hidden when inactive) so tab switches
 * do not unmount hooks and trigger redundant refetches.
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

  const panes: Record<BrainSectionId, React.ReactNode> = {
    contacts: <ContactsPane {...brainProps} onManageContacts={onManageContacts} />,
    functions: <FunctionsPane {...brainProps} />,
    guidance: <DocLibraryPane {...brainProps} kind="guidance" />,
    knowledge: <DocLibraryPane {...brainProps} kind="knowledge" />,
    data: <DataPane {...brainProps} />,
    transcripts: (
      <React.Suspense fallback={<SectionBodySkeleton className="h-full" />}>
        <TranscriptsPane {...brainProps} />
      </React.Suspense>
    ),
  };

  return (
    <>
      {BRAIN_SECTION_IDS.map((sectionId) => {
        const isActive = activeSectionId === sectionId;
        return (
          <div
            key={sectionId}
            className={cn('h-full min-h-0', !isActive && 'hidden')}
            data-testid={`brain-section-${sectionId}`}
            data-active={isActive || undefined}
            aria-hidden={!isActive}
          >
            {panes[sectionId]}
          </div>
        );
      })}
    </>
  );
}
