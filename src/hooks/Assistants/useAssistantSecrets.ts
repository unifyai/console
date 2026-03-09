import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Secret, SecretPayload, SecretActions } from '@/types/assistants/secret';
import { ResponseProps } from '@/types/common';

export function useAssistantSecrets(assistantId: string | null, secretActions: SecretActions) {
  const [secrets, setSecrets] = React.useState<Secret[]>([]);
  const [selectedSecret, setSelectedSecret] = React.useState<Secret | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const formMethods = useForm<SecretPayload>({
    defaultValues: { name: '', value: '', description: '' },
  });
  const { reset, setValue } = formMethods;

  const fetchSecrets = React.useCallback(async () => {
    if (!assistantId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await secretActions.get(assistantId);
      if ('detail' in result) throw new Error((result as ResponseProps).detail);
      const sortedSecrets = (result as Secret[]).sort((a, b) => a.name.localeCompare(b.name));
      setSecrets(sortedSecrets);
      setSelectedSecret(sortedSecrets[0] || null);
    } catch (err: any) {
      setError(err.message);
      toast.error('Failed to load secrets.');
    } finally {
      setIsLoading(false);
    }
  }, [assistantId, secretActions]);

  React.useEffect(() => {
    if (assistantId) {
      fetchSecrets();
    }
  }, [assistantId, fetchSecrets]);

  React.useEffect(() => {
    if (selectedSecret) {
      reset({
        name: selectedSecret.name,
        value: selectedSecret.value,
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
    if (!assistantId) return;
    const toastId = toast.loading(`Deleting secret "${secretToDelete.name}"...`);
    try {
      const result = await secretActions.delete(assistantId, secretToDelete.logId);
      if ('detail' in result) throw new Error((result as ResponseProps).detail);

      toast.success('Secret deleted.', { id: toastId });
      await fetchSecrets(); // Refresh the list
    } catch (err: any) {
      toast.error(`Failed to delete secret. Please try again.`, { id: toastId });
    }
  };

  const onSubmit = async (data: SecretPayload) => {
    if (!assistantId || selectedSecret) return; // Only allow creation

    setIsSubmitting(true);
    const toastId = toast.loading('Creating secret...');

    try {
      const result = await secretActions.create(assistantId, data);
      if ('detail' in result) throw new Error((result as ResponseProps).detail);

      toast.success('Secret created.', { id: toastId });
      await fetchSecrets(); // Refresh and select the first secret
    } catch (err: any) {
      toast.error(`Failed to create secret. Please try again.`, { id: toastId });
    } finally {
      setIsSubmitting(false);
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
