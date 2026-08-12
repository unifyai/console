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
const KnowledgePane = React.lazy(() =>
  import('../Knowledge/KnowledgePane').then((m) => ({ default: m.KnowledgePane }))
);
const DataPane = React.lazy(() =>
  import('../Data/DataPane').then((m) => ({ default: m.DataPane }))
);
const TranscriptsPane = React.lazy(() =>
  import('../Transcripts/TranscriptsPane').then((m) => ({ default: m.TranscriptsPane }))
);
const TasksPane = React.lazy(() =>
  import('../Tasks/TasksPane').then((m) => ({ default: m.TasksPane }))
);

const TEAM_SECTION_IDS = [
  'tasks',
  'contacts',
  'transcripts',
  'knowledge',
  'functions',
  'guidance',
  'data',
] as const;

type TeamSectionId = (typeof TEAM_SECTION_IDS)[number];

export function isTeamBrainSectionId(sectionId: string): sectionId is TeamSectionId {
  return (TEAM_SECTION_IDS as readonly string[]).includes(sectionId);
}

interface TeamBrainSectionsHostProps {
  /**
   * Identity carrier for the shared fetch layer. Every read is pinned to the
   * explicit team root, so the carrier only satisfies the panes' `assistant`
   * prop contract — any org assistant works; a team member is preferred.
   */
  carrierAssistant: Assistant | null;
  teamId: number;
  activeSectionId: string;
  isActiveSurface?: boolean;
}

/**
 * Team-scoped twin of `BrainSectionsHost`: renders the same section panes
 * pinned to the team's shared `Teams/{teamId}/…` contexts instead of an
 * assistant's personal root. Panes stay mounted after first visit so section
 * switches do not refetch.
 */
export function TeamBrainSectionsHost({
  carrierAssistant,
  teamId,
  activeSectionId,
  isActiveSurface = true,
}: TeamBrainSectionsHostProps) {
  const root = React.useMemo<ContextRoot>(() => ({ kind: 'team', teamId }), [teamId]);

  const [mountedSections, setMountedSections] = React.useState<Set<TeamSectionId>>(() => {
    const initial = new Set<TeamSectionId>();
    if (isTeamBrainSectionId(activeSectionId)) {
      initial.add(activeSectionId);
    }
    return initial;
  });

  React.useEffect(() => {
    if (!isTeamBrainSectionId(activeSectionId)) return;
    setMountedSections((current) => {
      if (current.has(activeSectionId)) return current;
      const next = new Set(current);
      next.add(activeSectionId);
      return next;
    });
  }, [activeSectionId]);

  if (!carrierAssistant) {
    return (
      <div
        className="text-body-muted flex h-full items-center justify-center px-6 text-center"
        data-testid="team-brain-no-carrier"
      >
        Team memory appears here once the team has an AI teammate.
      </div>
    );
  }

  const paneProps = {
    assistant: carrierAssistant,
    ownerId: carrierAssistant.userId,
    assistantId: carrierAssistant.agentId,
    root,
  };

  const renderPane = (sectionId: TeamSectionId, sectionActive: boolean) => {
    const paneEnabled = sectionActive && isActiveSurface;
    switch (sectionId) {
      case 'tasks':
        return (
          <TasksPane {...paneProps} isVisible={sectionActive} isActiveSurface={isActiveSurface} />
        );
      case 'contacts':
        return <ContactsPane {...paneProps} enabled={paneEnabled} />;
      case 'functions':
        return <FunctionsPane {...paneProps} isActiveSurface={paneEnabled} />;
      case 'guidance':
        return <DocLibraryPane {...paneProps} enabled={paneEnabled} />;
      case 'knowledge':
        return <KnowledgePane {...paneProps} enabled={paneEnabled} />;
      case 'data':
        return <DataPane {...paneProps} enabled={paneEnabled} />;
      case 'transcripts':
        return <TranscriptsPane {...paneProps} enabled={paneEnabled} />;
    }
  };

  return (
    <>
      {TEAM_SECTION_IDS.map((sectionId) => {
        const isActive = activeSectionId === sectionId;
        const isMounted = mountedSections.has(sectionId);
        return (
          <div
            key={sectionId}
            className={cn('h-full min-h-0', !isActive && 'hidden')}
            data-testid={`team-brain-section-${sectionId}`}
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
