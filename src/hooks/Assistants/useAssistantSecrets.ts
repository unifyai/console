import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Secret,
  SecretPayload,
  SecretUpdatePayload,
  SecretActions,
} from '@/types/assistants/secret';
import { ResponseProps } from '@/types/common';

interface SecretFormData {
  name: string;
  value: string;
  description: string;
}

export function useAssistantSecrets(
  assistantId: string | null,
  ownerId: string | null,
  secretActions: SecretActions
) {
  const [secrets, setSecrets] = React.useState<Secret[]>([]);
  const [selectedSecret, setSelectedSecret] = React.useState<Secret | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const formMethods = useForm<SecretFormData>({
    defaultValues: { name: '', value: '', description: '' },
  });
  const { reset } = formMethods;

  const fetchSecrets = React.useCallback(async () => {
    if (!assistantId || !ownerId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await secretActions.get(assistantId, ownerId);
      if ('detail' in result) throw new Error((result as ResponseProps).detail);
      const sortedSecrets = (result as Secret[]).sort((a, b) => a.name.localeCompare(b.name));
      setSecrets(sortedSecrets);
      // Re-select the currently selected secret if it still exists (e.g. after update),
      // otherwise clear the selection (e.g. after create or delete).
      setSelectedSecret((prev) => {
        if (!prev) return null;
        return sortedSecrets.find((s) => s.logId === prev.logId) || null;
      });
    } catch (err: any) {
      setError(err.message);
      toast.error('Failed to load secrets.');
    } finally {
      setIsLoading(false);
    }
  }, [assistantId, ownerId, secretActions]);

  React.useEffect(() => {
    if (assistantId) {
      fetchSecrets();
    }
  }, [assistantId, fetchSecrets]);

  React.useEffect(() => {
    if (selectedSecret) {
      reset({
        name: selectedSecret.name,
        value: '',
        description: selectedSecret.description || '',
      });
    } else {
      reset({ name: '', value: '', description: '' });
    }
  }, [selectedSecret, reset]);

  const handleSelectSecret = (secret: Secret) => {
    setSelectedSecret(secret);
  };

  const handleNewSecret = () => {
    setSelectedSecret(null);
    reset({ name: '', value: '', description: '' });
  };

  const handleDeleteSecret = async (secretToDelete: Secret) => {
    if (!assistantId || !ownerId) return;
    const toastId = toast.loading(`Deleting secret "${secretToDelete.name}"...`);
    try {
      const result = await secretActions.delete(secretToDelete.logId, ownerId);
      if ('detail' in result) throw new Error((result as ResponseProps).detail);

      toast.success('Secret deleted.', { id: toastId });
      await fetchSecrets();
    } catch (err: any) {
      toast.error(`Failed to delete secret. Please try again.`, { id: toastId });
    }
  };

  const onSubmit = async (data: SecretFormData) => {
    if (!assistantId || !ownerId) return;

    setIsSubmitting(true);

    if (selectedSecret) {
      const toastId = toast.loading('Updating secret...');
      try {
        const payload: SecretUpdatePayload = {};
        if (data.name !== selectedSecret.name) payload.name = data.name;
        if (data.value) payload.value = data.value;
        if (data.description !== (selectedSecret.description || ''))
          payload.description = data.description;

        if (Object.keys(payload).length === 0) {
          toast.dismiss(toastId);
          setIsSubmitting(false);
          return;
        }

        const result = await secretActions.update(selectedSecret.logId, ownerId, payload);
        if ('detail' in result) throw new Error((result as ResponseProps).detail);

        toast.success('Secret updated.', { id: toastId });
        await fetchSecrets();
      } catch (err: any) {
        toast.error(`Failed to update secret. Please try again.`, { id: toastId });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const toastId = toast.loading('Creating secret...');
      try {
        const payload: SecretPayload = {
          name: data.name,
          value: data.value,
          description: data.description || undefined,
        };
        const result = await secretActions.create(assistantId, ownerId, payload);
        if ('detail' in result) throw new Error((result as ResponseProps).detail);

        toast.success('Secret created.', { id: toastId });
        await fetchSecrets();
      } catch (err: any) {
        toast.error(`Failed to create secret. Please try again.`, { id: toastId });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return {
    secrets,
    selectedSecret,
    isLoading,
    isSubmitting,
    error,
    formMethods,
    fetchSecrets,
    handleSelectSecret,
    handleNewSecret,
    handleDeleteSecret,
    onSubmit: formMethods.handleSubmit(onSubmit),
  };
}
