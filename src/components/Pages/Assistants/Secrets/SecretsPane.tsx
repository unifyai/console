'use client';

import * as React from 'react';
import { Plus, Search, Upload, X } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/UI/alert-dialog';
import { useAssistantSecrets } from '@/hooks/Assistants/useAssistantSecrets';
import type { Secret, SecretActions } from '@/types/assistants/secret';
import { SecretsTable } from './SecretsTable';
import { SecretFormDialog } from './SecretFormDialog';
import { JsonUploadPreviewDialog } from './JsonUploadPreviewDialog';

interface SecretsPaneProps {
  ownerId: string;
  assistantId: string;
  secretActions: SecretActions;
  canWrite?: boolean;
}

type PendingDelete =
  | { type: 'secret'; secret: Secret }
  | { type: 'folder'; prefix: string; count: number };

export function SecretsPane({
  ownerId,
  assistantId,
  secretActions,
  canWrite = true,
}: SecretsPaneProps) {
  const {
    secrets,
    isLoading,
    isSubmitting,
    formMethods,
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
    onSubmit,
  } = useAssistantSecrets(assistantId, ownerId, secretActions);

  // Local controlled value for the input; we only commit the query to the
  // hook (and thus trigger a re-fetch) when the user hits Enter, matching the
  // Brain/Tasks search UX.
  const [searchValue, setSearchValue] = React.useState(searchQuery);
  React.useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);

  const submitSearch = React.useCallback(() => {
    const trimmed = searchValue.trim();
    if (trimmed) handleSearch(trimmed);
    else clearSearch();
  }, [searchValue, handleSearch, clearSearch]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchValue('');
    clearSearch();
  };

  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());
  const [dialogMode, setDialogMode] = React.useState<'create' | 'edit' | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<PendingDelete | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // When we finish submitting a form, auto-close the dialog and reset hook
  // state so the next open starts clean.
  const prevIsSubmittingRef = React.useRef(isSubmitting);
  React.useEffect(() => {
    const wasSubmitting = prevIsSubmittingRef.current;
    prevIsSubmittingRef.current = isSubmitting;
    if (dialogMode && wasSubmitting && !isSubmitting) {
      setDialogMode(null);
      handleNewSecret();
    }
  }, [isSubmitting, dialogMode, handleNewSecret]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const openCreate = () => {
    handleNewSecret();
    setDialogMode('create');
  };

  const openEdit = (secret: Secret) => {
    handleSelectSecret(secret);
    setDialogMode('edit');
  };

  const closeDialog = () => {
    if (isSubmitting) return;
    setDialogMode(null);
    handleNewSecret();
  };

  const onRequestDeleteSecret = (secret: Secret) => {
    setPendingDelete({ type: 'secret', secret });
  };

  const onRequestDeleteFolder = (prefix: string) => {
    const count = secrets.filter(
      (s) => s.name === prefix || s.name.startsWith(prefix + '/')
    ).length;
    setPendingDelete({ type: 'folder', prefix, count });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const pd = pendingDelete;
    setPendingDelete(null);
    if (pd.type === 'secret') {
      await handleDeleteSecret(pd.secret);
    } else {
      await handleDeleteFolder(pd.prefix);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteDialogTitle = pendingDelete
    ? pendingDelete.type === 'folder'
      ? `Delete ${pendingDelete.count} secret${pendingDelete.count === 1 ? '' : 's'} under "${pendingDelete.prefix}/"?`
      : `Delete secret "${pendingDelete.secret.name}"?`
    : '';

  return (
    <div className="flex h-full flex-col" data-testid="secrets-pane">
      {/* Header — search + actions */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        data-testid="secrets-header"
      >
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="h-7 w-full rounded-md border bg-transparent pl-7 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Search…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            data-testid="secrets-search"
          />
          {searchValue && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              onClick={handleClearSearch}
              data-testid="secrets-search-clear"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {canWrite && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={openCreate}
                  disabled={isSubmitting}
                  data-testid="secrets-new-button"
                  aria-label="Add new secret"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Add new secret</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  data-testid="secrets-upload-button"
                  aria-label="Upload JSON"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="end"
                className="max-w-xs whitespace-normal p-3 text-xs"
                data-testid="secrets-upload-tooltip"
              >
                <p className="mb-2 font-medium">Upload secrets from JSON file</p>
                <p className="mb-1.5 text-muted-foreground">
                  Simple &mdash; keys are secret names, values are secret values:
                </p>
                <pre className="mb-3 rounded bg-muted p-2 text-[11px] leading-relaxed">
                  {`{\n  "API_KEY": "sk-abc123",\n  "DB_URL": "postgres://..."\n}`}
                </pre>
                <p className="mb-1.5 text-muted-foreground">
                  Rich &mdash; values are objects with{' '}
                  <code className="rounded bg-muted px-1">value</code> (required) and optional{' '}
                  <code className="rounded bg-muted px-1">description</code>:
                </p>
                <pre className="rounded bg-muted p-2 text-[11px] leading-relaxed">
                  {`{\n  "API_KEY": {\n    "value": "sk-abc123",\n    "description": "Production key"\n  }\n}`}
                </pre>
                <p className="mt-2 text-muted-foreground">
                  Use <code className="rounded bg-muted px-1">/</code> in names for folder structure
                  (e.g. <code className="rounded bg-muted px-1">aws/prod/API_KEY</code>
                  ).
                </p>
                <p className="mt-1 text-muted-foreground">
                  Both formats can be mixed in a single file.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Body — table */}
      <div className="min-h-0 flex-1">
        <SecretsTable
          secrets={secrets}
          isLoading={isLoading}
          canWrite={canWrite}
          searchQuery={searchQuery}
          expandedFolders={expandedFolders}
          sorting={sorting}
          onSort={handleSort}
          onToggleFolder={toggleFolder}
          onUpdateSecret={openEdit}
          onDeleteSecret={onRequestDeleteSecret}
          onDeleteFolder={onRequestDeleteFolder}
        />
      </div>

      {/* Hidden file input for JSON uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Create / edit form */}
      <SecretFormDialog
        open={dialogMode !== null}
        mode={dialogMode ?? 'create'}
        formMethods={formMethods}
        isSubmitting={isSubmitting}
        onSubmit={onSubmit}
        onClose={closeDialog}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent data-testid="secrets-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="hover:bg-destructive/90 bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* JSON upload preview */}
      {pendingUpload && (
        <JsonUploadPreviewDialog
          pendingUpload={pendingUpload}
          isSubmitting={isSubmitting}
          onConfirm={confirmUploadJson}
          onCancel={cancelUploadJson}
        />
      )}
    </div>
  );
}
