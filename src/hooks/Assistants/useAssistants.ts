import * as React from 'react';
import { Assistant, AssistantActions, AssistantUpdatePayload } from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { isGcsPhoto } from '@/utils/assistants/gcs-utils';
import {
  fetchAssistants,
  fetchMediaSignedUrls,
  readCachedMediaSignedUrls,
  seedMediaSignedUrls,
} from '@/lib/client/assistant';

export function useAssistants(allActions: AssistantActions, isOrgContext: boolean) {
  const { assistant: assistantActions } = allActions;

  const [assistants, setAssistants] = React.useState<Assistant[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const assistantsRef = React.useRef<Assistant[]>([]);

  React.useEffect(() => {
    assistantsRef.current = assistants;
  }, [assistants]);

  const fetchAssistantsWithDetails = React.useCallback(
    async (shouldShowLoadingToast = true) => {
      setIsLoading(true);
      setError(null);

      let toastId: string | number | undefined;
      if (shouldShowLoadingToast) {
        toastId = toast.loading('Refreshing assistants...');
      }

      try {
        const listResult = await fetchAssistants(isOrgContext);

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

        const validAssistants = listResult.filter((a) => a && a.agentId && a.firstName);
        if (validAssistants.length !== listResult.length) {
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
    [isOrgContext]
  );

  React.useEffect(() => {
    fetchAssistantsWithDetails(false);
  }, [fetchAssistantsWithDetails]);

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
