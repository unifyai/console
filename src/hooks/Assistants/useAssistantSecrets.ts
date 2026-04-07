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

function checkNameFolderConflict(name: string, existingNames: string[]): string | null {
  if (existingNames.some((n) => n.startsWith(name + '/'))) {
    return `"${name}" conflicts with an existing folder path.`;
  }
  const parts = name.split('/');
  for (let i = 1; i < parts.length; i++) {
    const prefix = parts.slice(0, i).join('/');
    if (existingNames.includes(prefix)) {
      return `"${prefix}" already exists as a secret and cannot be used as a folder.`;
    }
  }
  return null;
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
      const result = await secretActions.delete(secretToDelete.logId, ownerId, assistantId);
      if ('detail' in result) throw new Error((result as ResponseProps).detail);

      toast.success('Secret deleted.', { id: toastId });
      await fetchSecrets();
    } catch (err: any) {
      toast.error(`Failed to delete secret. Please try again.`, { id: toastId });
    }
  };

  const handleDeleteFolder = async (prefix: string) => {
    if (!assistantId || !ownerId) return;
    const matching = secrets.filter((s) => s.name === prefix || s.name.startsWith(prefix + '/'));
    if (matching.length === 0) return;

    setIsSubmitting(true);
    const toastId = toast.loading(`Deleting ${matching.length} secret(s)...`);
    let deleted = 0;
    let failed = 0;
    for (const s of matching) {
      const result = await secretActions.delete(s.logId, ownerId, assistantId);
      if ('detail' in result) failed++;
      else deleted++;
    }
    if (failed === 0) {
      toast.success(`Deleted ${deleted} secret(s).`, { id: toastId });
    } else {
      toast.warning(`Deleted ${deleted}, failed ${failed}.`, { id: toastId });
    }
    await fetchSecrets();
    setIsSubmitting(false);
  };

  const handleUploadJson = async (file: File) => {
    if (!assistantId || !ownerId) return;

    setIsSubmitting(true);
    const toastId = toast.loading('Uploading secrets from JSON...');

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('JSON must be an object. See the (i) button for accepted formats.');
      }

      const entries = Object.entries(parsed);
      if (entries.length === 0) {
        throw new Error('JSON file contains no entries.');
      }

      const payloads: SecretPayload[] = [];
      for (const [key, val] of entries) {
        if (typeof val === 'string') {
          payloads.push({ name: key, value: val });
        } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          const obj = val as Record<string, unknown>;
          if (typeof obj.value !== 'string') {
            throw new Error(`Entry "${key}": "value" must be a string.`);
          }
          payloads.push({
            name: key,
            value: obj.value,
            description: typeof obj.description === 'string' ? obj.description : undefined,
          });
        } else {
          throw new Error(`Entry "${key}": expected a string or an object with "value".`);
        }
      }

      const existingNames = secrets.map((s) => s.name);
      const validPayloads: SecretPayload[] = [];
      let skipped = 0;
      for (const payload of payloads) {
        const conflict = checkNameFolderConflict(payload.name, [
          ...existingNames,
          ...validPayloads.map((p) => p.name),
        ]);
        if (conflict) {
          skipped++;
        } else {
          validPayloads.push(payload);
        }
      }

      if (validPayloads.length === 0 && skipped > 0) {
        throw new Error(`All ${skipped} entries conflict with existing names/folders.`);
      }

      let created = 0;
      let failed = 0;
      for (const payload of validPayloads) {
        const result = await secretActions.create(assistantId, ownerId, payload);
        if ('detail' in result) {
          failed++;
        } else {
          created++;
        }
      }

      const parts: string[] = [];
      if (created > 0) parts.push(`created ${created}`);
      if (failed > 0) parts.push(`failed ${failed}`);
      if (skipped > 0) parts.push(`skipped ${skipped} conflicts`);
      if (failed === 0 && skipped === 0) {
        toast.success(`Created ${created} secret${created === 1 ? '' : 's'}.`, { id: toastId });
      } else {
        toast.warning(parts.join(', ') + '.', { id: toastId });
      }

      await fetchSecrets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse JSON file.', { id: toastId });
    } finally {
      setIsSubmitting(false);
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
        const conflict = checkNameFolderConflict(
          data.name,
          secrets.map((s) => s.name)
        );
        if (conflict) {
          toast.error(conflict, { id: toastId });
          setIsSubmitting(false);
          return;
        }
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
    handleDeleteFolder,
    handleUploadJson,
    onSubmit: formMethods.handleSubmit(onSubmit),
  };
}
