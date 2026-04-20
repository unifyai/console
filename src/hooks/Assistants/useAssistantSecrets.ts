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
import { buildSortingParam, buildSearchFilterExpr } from '@/lib/client/memory';

export type SecretsSortField = 'name' | 'description';
export type SecretsSortDirection = 'asc' | 'desc';
export type SecretsSortState = {
  field: SecretsSortField;
  direction: SecretsSortDirection;
} | null;

const DEFAULT_SORT: SecretsSortState = { field: 'name', direction: 'asc' };

// Fields eligible for free-text search. Mirrors the columns exposed in the
// Secrets table (name + description). The server turns this into an Orchestra
// filter expression via `buildSearchFilterExpr`.
const SEARCH_FIELDS = ['name', 'description'];

interface SecretFormData {
  name: string;
  value: string;
  description: string;
}

export interface PendingUpload {
  fileName: string;
  rawText: string;
  parsed: Record<string, unknown>;
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
  // Start as loading unconditionally so the skeleton is visible for the full
  // duration of the first fetch. Consumers that never have an assistantId
  // won't call the fetcher, but the skeleton stays up in that edge case which
  // is fine — it's consistent with Memory/Tasks.
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = React.useState<PendingUpload | null>(null);
  // Sort and search are driven by the server just like Memory/Tasks: changing
  // either triggers a re-fetch. Sort defaults to name-asc so the initial view
  // is alphabetic. Search defaults to empty (no filter).
  const [sorting, setSorting] = React.useState<SecretsSortState>(DEFAULT_SORT);
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  const formMethods = useForm<SecretFormData>({
    defaultValues: { name: '', value: '', description: '' },
  });
  const { reset } = formMethods;

  const fetchSecrets = React.useCallback(async () => {
    if (!assistantId || !ownerId) return;
    setIsLoading(true);
    setError(null);
    try {
      const sortingParam = sorting
        ? buildSortingParam(sorting.field, sorting.direction)
        : undefined;
      const trimmedQuery = searchQuery.trim();
      const filterExprParam = trimmedQuery
        ? buildSearchFilterExpr(trimmedQuery, SEARCH_FIELDS)
        : undefined;
      const result = await secretActions.get(assistantId, ownerId, sortingParam, filterExprParam);
      if ('detail' in result) throw new Error((result as ResponseProps).detail);
      const fetched = result as Secret[];
      setSecrets(fetched);
      // Re-select the currently selected secret if it still exists (e.g. after update),
      // otherwise clear the selection (e.g. after create or delete).
      setSelectedSecret((prev) => {
        if (!prev) return null;
        return fetched.find((s) => s.logId === prev.logId) || null;
      });
    } catch (err: any) {
      setError(err.message);
      toast.error('Failed to load secrets.');
    } finally {
      setIsLoading(false);
    }
  }, [assistantId, ownerId, secretActions, sorting, searchQuery]);

  React.useEffect(() => {
    if (assistantId) {
      fetchSecrets();
    }
  }, [assistantId, fetchSecrets]);

  // Clear the cached rows and flip loading on synchronously so there's no
  // intermediate "No secrets yet" flash between the state change and the
  // effect-driven re-fetch kicking in.
  const beginRefetch = React.useCallback(() => {
    setSecrets([]);
    setIsLoading(true);
  }, []);

  // Tri-state cycle: asc → desc → null (default server order). Clicking a new
  // column resets to asc on that column. The skeleton re-appears while the
  // new ordering is fetched — mirrors Memory.
  const handleSort = React.useCallback(
    (field: SecretsSortField) => {
      beginRefetch();
      setSorting((prev) => {
        if (!prev || prev.field !== field) return { field, direction: 'asc' };
        if (prev.direction === 'asc') return { field, direction: 'desc' };
        return null;
      });
    },
    [beginRefetch]
  );

  // Search is triggered by the consumer (e.g. on Enter), not on every
  // keystroke — matches the Memory/Tasks pattern. Empty/whitespace queries
  // are treated as "clear".
  const handleSearch = React.useCallback(
    (query: string) => {
      beginRefetch();
      setSearchQuery(query.trim());
    },
    [beginRefetch]
  );

  const clearSearch = React.useCallback(() => {
    beginRefetch();
    setSearchQuery('');
  }, [beginRefetch]);

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

  const handleFileSelected = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('JSON must be an object.');
      }

      if (Object.keys(parsed).length === 0) {
        throw new Error('JSON file contains no entries.');
      }

      const fileName = file.name.replace(/\.json$/i, '');
      setPendingUpload({ fileName, rawText: text, parsed });
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse JSON file.');
    }
  };

  const cancelUploadJson = () => {
    setPendingUpload(null);
  };

  const confirmUploadJson = async (options: {
    splitKeys: boolean;
    baseFolder: string;
    secretName: string;
  }) => {
    if (!assistantId || !ownerId || !pendingUpload) return;

    setIsSubmitting(true);
    const toastId = toast.loading('Uploading secrets from JSON...');

    try {
      const prefix = options.baseFolder.replace(/\/+$/, '');
      const addPrefix = (name: string) => (prefix ? `${prefix}/${name}` : name);

      let payloads: SecretPayload[];

      if (options.splitKeys) {
        payloads = [];
        for (const [key, val] of Object.entries(pendingUpload.parsed)) {
          if (typeof val === 'string') {
            payloads.push({ name: addPrefix(key), value: val });
          } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            const obj = val as Record<string, unknown>;
            if (typeof obj.value !== 'string') {
              throw new Error(`Entry "${key}": "value" must be a string.`);
            }
            payloads.push({
              name: addPrefix(key),
              value: obj.value,
              description: typeof obj.description === 'string' ? obj.description : undefined,
            });
          } else {
            throw new Error(`Entry "${key}": expected a string or an object with "value".`);
          }
        }
      } else {
        payloads = [{ name: addPrefix(options.secretName), value: pendingUpload.rawText }];
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

      setPendingUpload(null);
      await fetchSecrets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload secrets.', { id: toastId });
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
    pendingUpload,
    handleFileSelected,
    confirmUploadJson,
    cancelUploadJson,
    sorting,
    handleSort,
    searchQuery,
    handleSearch,
    clearSearch,
    onSubmit: formMethods.handleSubmit(onSubmit),
  };
}
