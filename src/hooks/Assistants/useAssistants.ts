import * as React from 'react';
import { Assistant, AssistantActions, AssistantUpdatePayload } from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { isGcsPhoto } from '@/utils/assistants/gcs-utils';
import {
  canonicalizeAssistantList,
  type CoordinatorWorkspaceScope,
} from '@/lib/assistants/coordinatorIdentity';
import {
  fetchAssistants,
  fetchMediaSignedUrls,
  getEarliestSignedUrlExpiryMs,
  MEDIA_SIGNED_URL_EXPIRY_BUFFER_MS,
  readCachedMediaSignedUrls,
  seedMediaSignedUrls,
} from '@/lib/client/assistant';

/**
 * Refresh-scheduler safety bounds.
 *
 * `MIN_REFRESH_DELAY_MS` keeps us from busy-looping if the earliest
 * expiry is already in the past (or within the buffer) — the scheduler
 * still gives the network a moment to breathe before refetching.
 *
 * `MAX_REFRESH_DELAY_MS` caps `setTimeout` so a single absurdly-long
 * signed-URL TTL (e.g. an hour) doesn't postpone re-evaluation past
 * the point we'd want to react to a clock skew or visibility-change.
 */
const MIN_REFRESH_DELAY_MS = 5_000;
const MAX_REFRESH_DELAY_MS = 30 * 60 * 1000;

/** GCS-backed media paths on an assistant that participate in the
 *  signed-URL refresh dance. Pulled out so the scheduler and the
 *  refresh fn agree on what's in scope. */
function collectMediaPaths(assistants: ReadonlyArray<Assistant>): string[] {
  const paths = new Set<string>();
  for (const a of assistants) {
    if (a.profilePhoto && isGcsPhoto(a.profilePhoto)) paths.add(a.profilePhoto);
    if (a.profileVideo && isGcsPhoto(a.profileVideo)) paths.add(a.profileVideo);
  }
  return Array.from(paths);
}

export function useAssistants(
  allActions: AssistantActions,
  workspace: CoordinatorWorkspaceScope,
  currentUserId: string | null
) {
  const { assistant: assistantActions } = allActions;

  const [assistants, setAssistants] = React.useState<Assistant[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const assistantsRef = React.useRef<Assistant[]>([]);

  React.useEffect(() => {
    assistantsRef.current = assistants;
  }, [assistants]);

  const isOrgContext = workspace.type === 'organization';

  const fetchAssistantsWithDetails = React.useCallback(
    async (shouldShowLoadingToast = true) => {
      setIsLoading(true);
      setError(null);

      let toastId: string | number | undefined;
      if (shouldShowLoadingToast) {
        toastId = toast.loading('Refreshing assistants...');
      }

      try {
        const listResult = await fetchAssistants(workspace, true, { currentUserId });

        if (typeof listResult === 'object' && listResult !== null && 'detail' in listResult) {
          // Specifically handle 403 Forbidden as a non-error state (user is not approved)
          if ((listResult as any).status === 403) {
            setAssistants([]); // Treat as an empty list, not an error
            setError(null);
            setIsLoading(false);
            if (toastId) toast.dismiss(toastId);
            return;
          }
          // For all other errors, throw to be caught below
          throw new Error((listResult as ResponseProps).detail || 'Failed to fetch assistants.');
        }
        if (!Array.isArray(listResult)) {
          const detail =
            typeof listResult === 'object' && listResult !== null && 'detail' in listResult
              ? (listResult as any).detail
              : 'Invalid response format';
          throw new Error(`Invalid response format received for assistants: ${detail}`);
        }

        const normalizedAssistants = canonicalizeAssistantList(listResult, {
          currentUserId,
          pinCanonicalCoordinatorFirst: isOrgContext,
          workspace,
        });

        const validAssistants = normalizedAssistants
          .filter((a) => a && a.agentId && a.firstName)
          .map((assistant) => ({
            ...assistant,
            isCoordinator: assistant.isCoordinator === true,
          }));
        if (validAssistants.length !== normalizedAssistants.length) {
          /* no-op */
        }

        // Seed the shared cache with any existing signed URLs we already hold
        // locally so refreshes can immediately rehydrate unchanged media.
        const existingSignedUrlsByPath: Record<string, string> = {};
        assistantsRef.current.forEach((assistant) => {
          if (assistant.profilePhoto && assistant.signedProfilePhotoUrl) {
            existingSignedUrlsByPath[assistant.profilePhoto] = assistant.signedProfilePhotoUrl;
          }
          if (assistant.profileVideo && assistant.signedProfileVideoUrl) {
            existingSignedUrlsByPath[assistant.profileVideo] = assistant.signedProfileVideoUrl;
          }
        });
        if (Object.keys(existingSignedUrlsByPath).length > 0) {
          seedMediaSignedUrls(existingSignedUrlsByPath);
        }

        // Build media path references for URL resolution.
        const pathToAgentField: {
          path: string;
          agentId: string;
          field: 'signedProfilePhotoUrl' | 'signedProfileVideoUrl';
        }[] = [];

        validAssistants.forEach((assistant) => {
          if (assistant.profilePhoto && isGcsPhoto(assistant.profilePhoto)) {
            pathToAgentField.push({
              path: assistant.profilePhoto,
              agentId: assistant.agentId,
              field: 'signedProfilePhotoUrl',
            });
          }
          if (assistant.profileVideo && isGcsPhoto(assistant.profileVideo)) {
            pathToAgentField.push({
              path: assistant.profileVideo,
              agentId: assistant.agentId,
              field: 'signedProfileVideoUrl',
            });
          }
        });

        const allMediaPaths = Array.from(new Set(pathToAgentField.map((entry) => entry.path)));
        const cachedSignedUrls = readCachedMediaSignedUrls(allMediaPaths);
        const existingAssistantsById = new Map(
          assistantsRef.current.map((assistant) => [assistant.agentId, assistant])
        );

        // Step 2: Set the core data immediately, but hydrate any signed URLs
        // already available in cache so images render without delay.
        const assistantsWithImmediateSignedUrls = validAssistants.map((assistant) => {
          const existingAssistant = existingAssistantsById.get(assistant.agentId);
          const signedProfilePhotoUrl =
            (assistant.profilePhoto ? cachedSignedUrls[assistant.profilePhoto] : undefined) ||
            (existingAssistant && existingAssistant.profilePhoto === assistant.profilePhoto
              ? existingAssistant.signedProfilePhotoUrl
              : undefined);
          const signedProfileVideoUrl =
            (assistant.profileVideo ? cachedSignedUrls[assistant.profileVideo] : undefined) ||
            (existingAssistant && existingAssistant.profileVideo === assistant.profileVideo
              ? existingAssistant.signedProfileVideoUrl
              : undefined);

          return {
            ...assistant,
            ...(signedProfilePhotoUrl ? { signedProfilePhotoUrl } : {}),
            ...(signedProfileVideoUrl ? { signedProfileVideoUrl } : {}),
          };
        });

        setAssistants(assistantsWithImmediateSignedUrls);
        setIsLoading(false);
        if (toastId) toast.dismiss(toastId);

        // Step 3: Resolve only media paths still missing from cache.
        const unresolvedPaths = allMediaPaths.filter((path) => !cachedSignedUrls[path]);
        if (unresolvedPaths.length > 0) {
          fetchMediaSignedUrls(unresolvedPaths).then((signedUrlMap) => {
            const urlUpdates = new Map<
              string,
              { signedProfilePhotoUrl?: string; signedProfileVideoUrl?: string }
            >();

            pathToAgentField.forEach(({ path, agentId, field }) => {
              const signedUrl = signedUrlMap[path];
              if (!signedUrl) return;
              const existing = urlUpdates.get(agentId) || {};
              existing[field] = signedUrl;
              urlUpdates.set(agentId, existing);
            });

            if (urlUpdates.size > 0) {
              setAssistants((currentAssistants) =>
                currentAssistants.map((assistant) => {
                  const updates = urlUpdates.get(assistant.agentId);
                  return updates ? { ...assistant, ...updates } : assistant;
                })
              );
            }
          });
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : 'An unknown error occurred while fetching assistants.';
        setError(errorMsg);
        setAssistants([]);
        setIsLoading(false);
        if (toastId) {
          toast.error('Failed to load assistants', { id: toastId });
        } else if (shouldShowLoadingToast) {
          toast.error('Failed to load assistants');
        }
      }
    },
    [currentUserId, isOrgContext, workspace]
  );

  React.useEffect(() => {
    fetchAssistantsWithDetails(false);
  }, [fetchAssistantsWithDetails]);

  /**
   * Pre-emptive signed-URL refresh.
   *
   * GCS signed URLs have a TTL on the order of minutes. Once a URL
   * expires, any *new* `<img>` element created against it (e.g. a
   * freshly-streamed chat bubble's avatar) hits a 403 from GCS and
   * Radix's `AvatarImage` falls back to initials — even though the
   * already-decoded photo on existing bubbles keeps rendering from
   * the browser image cache. The result is the "photo disappears for
   * new messages until I reload" behaviour.
   *
   * Rather than retry per-img on error, we re-mint the URLs centrally
   * just before they expire and patch them back onto the in-memory
   * assistants list, so every consumer always sees a fresh URL.
   */
  const refreshSignedUrls = React.useCallback(async () => {
    const paths = collectMediaPaths(assistantsRef.current);
    if (paths.length === 0) return;

    let urlMap: Record<string, string>;
    try {
      urlMap = await fetchMediaSignedUrls(paths);
    } catch {
      // Swallow — the next assistants change (or visibilitychange)
      // will give us another shot. We deliberately don't toast since
      // this runs in the background and a transient failure shouldn't
      // surface to the user.
      return;
    }

    setAssistants((current) =>
      current.map((assistant) => {
        const photo = assistant.profilePhoto ? urlMap[assistant.profilePhoto] : undefined;
        const video = assistant.profileVideo ? urlMap[assistant.profileVideo] : undefined;
        if (!photo && !video) return assistant;
        return {
          ...assistant,
          ...(photo ? { signedProfilePhotoUrl: photo } : {}),
          ...(video ? { signedProfileVideoUrl: video } : {}),
        };
      })
    );
  }, []);

  // Keep a ref to the latest refresh fn so the visibilitychange
  // listener (mounted once) and the timer always invoke the current
  // closure without re-binding.
  const refreshSignedUrlsRef = React.useRef(refreshSignedUrls);
  React.useEffect(() => {
    refreshSignedUrlsRef.current = refreshSignedUrls;
  }, [refreshSignedUrls]);

  // Arm a timer for the soonest pending expiry. Re-runs whenever the
  // assistants list mutates (incl. after a refresh patches it), so
  // the timer naturally re-arms against the new earliest expiry.
  React.useEffect(() => {
    const paths = collectMediaPaths(assistants);
    if (paths.length === 0) return;
    const earliestExpiryMs = getEarliestSignedUrlExpiryMs(paths);
    if (earliestExpiryMs === null) return;

    const refreshAtMs = earliestExpiryMs - MEDIA_SIGNED_URL_EXPIRY_BUFFER_MS;
    const delayMs = Math.min(
      Math.max(refreshAtMs - Date.now(), MIN_REFRESH_DELAY_MS),
      MAX_REFRESH_DELAY_MS
    );

    const handle = setTimeout(() => {
      void refreshSignedUrlsRef.current();
    }, delayMs);

    return () => clearTimeout(handle);
  }, [assistants]);

  // Browsers throttle (and on some platforms, suspend) timers in
  // backgrounded tabs, so a tab that wakes up after a long sleep can
  // miss its scheduled refresh. Re-check on visibility change and
  // refresh immediately if we're already inside the buffer window.
  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const paths = collectMediaPaths(assistantsRef.current);
      if (paths.length === 0) return;
      const earliestExpiryMs = getEarliestSignedUrlExpiryMs(paths);
      if (earliestExpiryMs === null) return;
      if (Date.now() + MEDIA_SIGNED_URL_EXPIRY_BUFFER_MS >= earliestExpiryMs) {
        void refreshSignedUrlsRef.current();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const deleteAssistant = React.useCallback(
    async (assistantToDelete: Assistant): Promise<boolean> => {
      const assistantId = assistantToDelete.agentId;
      const displayName = `${assistantToDelete.firstName} ${assistantToDelete.surname}`;

      const toastId = toast.loading(`Ending contract for ${displayName}...`);

      try {
        const deleteResult = await assistantActions.delete(assistantId);
        if (deleteResult.detail) {
          throw new Error(deleteResult.detail || 'Failed to delete assistant record.');
        }

        setAssistants((prev) => prev.filter((a) => a.agentId !== assistantId));
        toast.success(`${displayName} removed from team.`, { id: toastId });
        return true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'An unknown error occurred.';
        toast.error(`Failed to remove ${displayName}`, { id: toastId });
        return false;
      }
    },
    [assistantActions]
  );

  const updateAssistantProfile = React.useCallback(
    async (id: string, payload: Partial<AssistantUpdatePayload>): Promise<boolean> => {
      const toastId = toast.loading('Updating profile...');
      try {
        const result = await assistantActions.update(id, payload);
        if (result && 'detail' in result && result.detail) {
          throw new Error((result as ResponseProps).detail);
        }

        // Immediately update non-URL fields
        setAssistants((prev) => prev.map((a) => (a.agentId === id ? { ...a, ...payload } : a)));

        // If media paths changed, refresh signed URLs for the affected fields.
        const updatedMediaPaths = [
          ...(payload.profilePhoto && isGcsPhoto(payload.profilePhoto)
            ? [payload.profilePhoto]
            : []),
          ...(payload.profileVideo && isGcsPhoto(payload.profileVideo)
            ? [payload.profileVideo]
            : []),
        ];

        if (updatedMediaPaths.length > 0) {
          fetchMediaSignedUrls(updatedMediaPaths).then((urlMap) => {
            setAssistants((current) =>
              current.map((assistant) => {
                if (assistant.agentId !== id) return assistant;

                const signedProfilePhotoUrl = payload.profilePhoto
                  ? urlMap[payload.profilePhoto]
                  : undefined;
                const signedProfileVideoUrl = payload.profileVideo
                  ? urlMap[payload.profileVideo]
                  : undefined;

                return {
                  ...assistant,
                  ...(signedProfilePhotoUrl ? { signedProfilePhotoUrl } : {}),
                  ...(signedProfileVideoUrl ? { signedProfileVideoUrl } : {}),
                };
              })
            );
          });
        }

        toast.success('Profile updated.', { id: toastId });
        return true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Profile update failed`, { id: toastId });
        return false;
      }
    },
    [assistantActions]
  );

  return {
    assistants,
    setAssistants,
    isLoading,
    error,
    refreshAssistants: fetchAssistantsWithDetails,
    deleteAssistant,
    updateAssistantProfile,
  };
}
