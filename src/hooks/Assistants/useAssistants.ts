import * as React from 'react';
import { Assistant, AssistantActions, AssistantUpdatePayload } from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { isGcsPhoto } from '@/utils/assistants/gcs-utils';

export function useAssistants(allActions: AssistantActions) {
  const { assistant: assistantActions, photo: photoActions } = allActions;

  const [assistants, setAssistants] = React.useState<Assistant[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchAssistantsWithDetails = React.useCallback(
    async (shouldShowLoadingToast = true) => {
      setIsLoading(true);
      setError(null);

      let toastId: string | number | undefined;
      if (shouldShowLoadingToast) {
        toastId = toast.loading('Refreshing assistants...');
      }

      try {
        // Step 1: Fetch the core assistant data first
        const listResult = await assistantActions.list();

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

        // Step 2: Set the core data immediately for a fast UI render
        setAssistants(validAssistants);
        setIsLoading(false);
        if (toastId) toast.dismiss(toastId);

        // Step 3: Batch fetch all signed URLs in the background, then update once
        // This prevents multiple setAssistants calls which would cause cascading re-renders
        const urlFetchPromises: Promise<{
          agentId: string;
          signedProfilePhotoUrl?: string;
          signedProfileVideoUrl?: string;
        } | null>[] = [];

        validAssistants.forEach((assistant) => {
          const photoPromise =
            assistant.profilePhoto && isGcsPhoto(assistant.profilePhoto)
              ? photoActions.download(assistant.profilePhoto).then((result) => ({
                  agentId: assistant.agentId,
                  signedProfilePhotoUrl: result.signedUrl,
                }))
              : null;

          const videoPromise =
            assistant.profileVideo && isGcsPhoto(assistant.profileVideo)
              ? photoActions.download(assistant.profileVideo).then((result) => ({
                  agentId: assistant.agentId,
                  signedProfileVideoUrl: result.signedUrl,
                }))
              : null;

          if (photoPromise) urlFetchPromises.push(photoPromise);
          if (videoPromise) urlFetchPromises.push(videoPromise);
        });

        // Only proceed if there are URLs to fetch
        if (urlFetchPromises.length > 0) {
          Promise.allSettled(urlFetchPromises).then((results) => {
            // Collect all successful URL updates
            const urlUpdates = new Map<
              string,
              { signedProfilePhotoUrl?: string; signedProfileVideoUrl?: string }
            >();

            results.forEach((result) => {
              if (result.status === 'fulfilled' && result.value) {
                const { agentId, signedProfilePhotoUrl, signedProfileVideoUrl } = result.value;
                const existing = urlUpdates.get(agentId) || {};
                if (signedProfilePhotoUrl) {
                  existing.signedProfilePhotoUrl = signedProfilePhotoUrl;
                }
                if (signedProfileVideoUrl) {
                  existing.signedProfileVideoUrl = signedProfileVideoUrl;
                }
                urlUpdates.set(agentId, existing);
              }
            });

            // Single batched update for all URLs
            if (urlUpdates.size > 0) {
              setAssistants((currentAssistants) =>
                currentAssistants.map((a) => {
                  const updates = urlUpdates.get(a.agentId);
                  return updates ? { ...a, ...updates } : a;
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
    [assistantActions, photoActions]
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

        // If a photo was part of the payload, refresh its URL
        if (payload.profilePhoto && isGcsPhoto(payload.profilePhoto)) {
          const res = await photoActions.download(payload.profilePhoto);
          if (res.signedUrl) {
            setAssistants((current) =>
              current.map((a) =>
                a.agentId === id ? { ...a, signedProfilePhotoUrl: res.signedUrl } : a
              )
            );
          }
        }

        toast.success('Profile updated.', { id: toastId });
        return true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Profile update failed`, { id: toastId });
        return false;
      }
    },
    [assistantActions, photoActions]
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
