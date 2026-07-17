'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { currentTeamIds, type ContextRoot } from '@/lib/assistants/scope';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import type { Assistant } from '@/types/assistants/assistant';
import type { SharedTeamSummary } from '@/types/teams/sharedTeam';
import {
  isManagedOrgWideTeam,
  resolveManagedTeamDisplayName,
  resolveManagedTeamImageUrl,
} from '@/utils/teams/managedTeamDisplay';

export interface BrainScopeOption {
  key: string;
  label: string;
  /** null = merged view across every readable root. */
  root: ContextRoot | null;
  imageUrl?: string | null;
  isOrgWideSharing?: boolean;
}

interface UseBrainScopeFilterOptions {
  /**
   * Externally-pinned scope (e.g. the team workspace pins a team root). When
   * set, the filter is hidden and the pinned root is used verbatim.
   */
  fixedRoot?: ContextRoot | null;
  /**
   * Whether the merged "All" scope is offered. Panes reading through the
   * federated logs endpoint get an exact cross-root merge and include it.
   */
  includeAll?: boolean;
}

export interface BrainScopeFilterState {
  /** The root to hand to the pane's data hook (null = merged). */
  root: ContextRoot | null;
  options: BrainScopeOption[];
  activeKey: string;
  setActiveKey: (key: string) => void;
  /** True when the ownership control should render (assistant view with teams). */
  showFilter: boolean;
}

async function fetchAssistantTeams(assistantId: string): Promise<SharedTeamSummary[]> {
  const response = await fetch(`/api/assistant/${assistantId}/teams`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load teams');
  }
  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Unexpected teams response');
  }
  return data as SharedTeamSummary[];
}

/**
 * Per-pane scope selection for assistants that belong to shared teams: the
 * pane defaults to the full merged picture (or Personal where merging is not
 * meaningful) and one click focuses the personal root or any single team's
 * `Teams/{id}/…` contexts. Hidden for teamless assistants and for panes whose
 * scope is pinned from outside (team selections).
 */
export function useBrainScopeFilter(
  assistant: Assistant,
  { fixedRoot = null, includeAll = true }: UseBrainScopeFilterOptions = {}
): BrainScopeFilterState {
  const { activeWorkspace } = useWorkspace();
  const orgName = activeWorkspace?.type === 'organization' ? activeWorkspace.name : null;
  const orgImage =
    activeWorkspace?.type === 'organization' ? (activeWorkspace.image ?? null) : null;

  const teamIds = React.useMemo(() => currentTeamIds(assistant), [assistant]);
  const { data: fetchedTeams = [] } = useQuery({
    queryKey: ['assistant-teams', assistant.agentId, teamIds.join(',')],
    queryFn: () => fetchAssistantTeams(String(assistant.agentId)),
    enabled: teamIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const options = React.useMemo<BrainScopeOption[]>(() => {
    const teamsById = new Map<number, SharedTeamSummary>();
    for (const summary of assistant.teamSummaries ?? []) {
      teamsById.set(summary.teamId, summary);
    }
    for (const team of fetchedTeams) {
      const existing = teamsById.get(team.teamId);
      teamsById.set(team.teamId, existing ? { ...existing, ...team } : team);
    }

    const teamOptions = teamIds.map((teamId) => {
      const summary = teamsById.get(teamId) ?? {
        teamId,
        name: `Team ${teamId}`,
        description: null,
      };
      const label = resolveManagedTeamDisplayName(summary, orgName);
      const isOrgWideSharing = isManagedOrgWideTeam(summary);
      return {
        key: `team-${teamId}`,
        label,
        root: { kind: 'team', teamId } as ContextRoot,
        imageUrl: resolveManagedTeamImageUrl(summary, orgImage),
        isOrgWideSharing,
      };
    });

    const baseOptions: BrainScopeOption[] = includeAll
      ? [{ key: 'all', label: 'All', root: null }]
      : [];
    return [
      ...baseOptions,
      { key: 'personal', label: 'Personal', root: { kind: 'personal' } },
      ...teamOptions,
    ];
  }, [assistant.teamSummaries, fetchedTeams, includeAll, orgImage, orgName, teamIds]);

  const defaultKey = includeAll ? 'all' : 'personal';
  const [activeKey, setActiveKey] = React.useState(defaultKey);

  // A different assistant means different teams; start over from the default.
  const assistantId = assistant.agentId;
  const previousAssistantIdRef = React.useRef(assistantId);
  React.useEffect(() => {
    if (previousAssistantIdRef.current !== assistantId) {
      previousAssistantIdRef.current = assistantId;
      setActiveKey(defaultKey);
    }
  }, [assistantId, defaultKey]);

  const hasTeams = teamIds.length > 0;
  const showFilter = fixedRoot == null && hasTeams;

  const resolvedKey = options.some((option) => option.key === activeKey) ? activeKey : defaultKey;
  const activeOption = options.find((option) => option.key === resolvedKey);

  return {
    root: fixedRoot != null || !showFilter ? fixedRoot : (activeOption?.root ?? null),
    options,
    activeKey: resolvedKey,
    setActiveKey,
    showFilter,
  };
}
