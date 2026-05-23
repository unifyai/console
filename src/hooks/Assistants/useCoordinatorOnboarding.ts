import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchCoordinatorState,
  updateCoordinatorState,
  type CoordinatorStateSnapshot,
  type CoordinatorStatePatch,
} from '@/lib/assistants/coordinatorState';

/**
 * Reads + writes the Coordinator's onboarding state row.
 *
 * The assistants page mounts this hook once it has resolved the
 * canonical workspace Coordinator. While ``state`` is undefined we
 * defer the layout decision (regular vs onboarding view) so the page
 * doesn't flash the wrong shell. Updates are optimistic at the React
 * Query cache level so picker clicks feel immediate without waiting
 * for the orchestra round-trip.
 *
 * The query key includes the coordinator id so workspace switches
 * (which surface a different coordinator) trigger a fresh read.
 */
export interface UseCoordinatorOnboardingResult {
  state: CoordinatorStateSnapshot | null;
  isLoading: boolean;
  error: string | null;
  updateState: (patch: CoordinatorStatePatch) => Promise<CoordinatorStateSnapshot | null>;
  refetch: () => Promise<void>;
}

function buildQueryKey(coordinatorId: string | number | null | undefined): readonly unknown[] {
  return ['coordinator-state', coordinatorId == null ? null : String(coordinatorId)];
}

export function useCoordinatorOnboarding(
  coordinatorId: string | number | null | undefined,
  options: { enabled?: boolean } = {}
): UseCoordinatorOnboardingResult {
  const queryClient = useQueryClient();
  const enabled = (options.enabled ?? true) && coordinatorId != null;

  const query = useQuery<CoordinatorStateSnapshot, Error>({
    queryKey: buildQueryKey(coordinatorId),
    queryFn: () => {
      if (coordinatorId == null) {
        throw new Error('Coordinator id is required to read Coordinator/State');
      }
      return fetchCoordinatorState(coordinatorId);
    },
    enabled,
    staleTime: 30 * 1000,
    // Don't retry the read indefinitely — the onboarding gate is best-effort.
    retry: 1,
  });

  const updateState = React.useCallback(
    async (patch: CoordinatorStatePatch): Promise<CoordinatorStateSnapshot | null> => {
      if (coordinatorId == null) return null;
      try {
        const next = await updateCoordinatorState(coordinatorId, patch);
        queryClient.setQueryData(buildQueryKey(coordinatorId), next);
        return next;
      } catch (err) {
        console.error('[useCoordinatorOnboarding] update failed:', err);
        toast.error('Failed to update onboarding state. Please try again.');
        return null;
      }
    },
    [coordinatorId, queryClient]
  );

  const refetch = React.useCallback(async () => {
    if (coordinatorId == null) return;
    await queryClient.invalidateQueries({ queryKey: buildQueryKey(coordinatorId) });
  }, [coordinatorId, queryClient]);

  return {
    state: query.data ?? null,
    isLoading: query.isPending && enabled,
    error: query.error?.message ?? null,
    updateState,
    refetch,
  };
}
