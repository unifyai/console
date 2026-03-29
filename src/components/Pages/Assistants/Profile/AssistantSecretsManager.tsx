import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Textarea } from '@/components/UI/textarea';
import { Skeleton } from '@/components/UI/skeleton';
import {
  Loader2,
  Trash2,
  AlertTriangle,
  Upload,
  Info,
  Folder,
  KeyRound,
  PanelRightClose,
  PanelRightOpen,
  ChevronRight,
} from 'lucide-react';
import { useAssistantSecrets } from '@/hooks/Assistants/useAssistantSecrets';
import { Secret, SecretActions } from '@/types/assistants/secret';
import { cn } from '@/lib/utils';
import { FormProvider } from 'react-hook-form';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/UI/popover';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/UI/accordion';
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
import { buildNestedDropdownTree } from '@/utils/interfaces/common';
import { TreeNode } from '@/types/common';

interface AssistantSecretsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  assistantId: string | null;
  ownerId: string | null;
  secretActions: SecretActions;
  canWrite?: boolean;
}

type PendingDelete =
  | { type: 'secret'; secret: Secret }
  | { type: 'folder'; prefix: string; count: number };

const TREE_INDENT = 12;

function collectFolderPaths(node: TreeNode): string[] {
  const paths: string[] = [];
  for (const child of Object.values(node.children)) {
    if (Object.keys(child.children).length > 0) {
      paths.push(child.path.endsWith('/') ? child.path.slice(0, -1) : child.path);
      paths.push(...collectFolderPaths(child));
    }
  }
  return paths;
}

const SecretsListSkeleton = () => (
  <div className="space-y-2">
    {[...Array(5)].map((_, i) => (
      <Skeleton key={i} className="h-9 w-full bg-muted" />
    ))}
  </div>
);

const JsonFormatInfo = () => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
        <Info className="h-3.5 w-3.5" />
      </Button>
    </PopoverTrigger>
    <PopoverContent side="top" className="w-80 text-xs">
      <p className="mb-2 font-medium">Accepted JSON formats</p>
      <p className="mb-1.5 text-muted-foreground">
        Simple &mdash; keys are secret names, values are secret values:
      </p>
      <pre className="mb-3 rounded bg-muted p-2 text-[11px] leading-relaxed">
        {`{\n  "API_KEY": "sk-abc123",\n  "DB_URL": "postgres://..."\n}`}
      </pre>
      <p className="mb-1.5 text-muted-foreground">
        Rich &mdash; values are objects with <code className="rounded bg-muted px-1">value</code>{' '}
        (required) and optional <code className="rounded bg-muted px-1">name</code>,{' '}
        <code className="rounded bg-muted px-1">description</code>:
      </p>
      <pre className="rounded bg-muted p-2 text-[11px] leading-relaxed">
        {`{\n  "API_KEY": {\n    "value": "sk-abc123",\n    "description": "Production key"\n  }\n}`}
      </pre>
      <p className="mt-2 text-muted-foreground">
        Use <code className="rounded bg-muted px-1">/</code> in names for folder structure (e.g.{' '}
        <code className="rounded bg-muted px-1">aws/prod/API_KEY</code>).
      </p>
      <p className="mt-1 text-muted-foreground">Both formats can be mixed in a single file.</p>
    </PopoverContent>
  </Popover>
);

function SecretTreeRow({
  node,
  depth,
  secretsByName,
  selectedSecret,
  conflictNames,
  onSelect,
  onRequestDeleteSecret,
  onRequestDeleteFolder,
  canWrite,
  isSubmitting,
}: {
  node: TreeNode;
  depth: number;
  secretsByName: Map<string, Secret>;
  selectedSecret: Secret | null;
  conflictNames: Set<string>;
  onSelect: (secret: Secret) => void;
  onRequestDeleteSecret: (secret: Secret) => void;
  onRequestDeleteFolder: (prefix: string) => void;
  canWrite: boolean;
  isSubmitting: boolean;
}) {
  const entries = Object.entries(node.children).sort(([a], [b]) => a.localeCompare(b));
  const hasKids = entries.length > 0;
  const fullPath = node.path.endsWith('/') ? node.path.slice(0, -1) : node.path;
  const label = fullPath.split('/').filter(Boolean).pop() || fullPath;
  const secret = secretsByName.get(fullPath);
  const isConflict = conflictNames.has(fullPath);
  const isSelected = selectedSecret?.name === fullPath;

  if (!hasKids && secret) {
    return (
      <div
        className={cn(
          'flex cursor-pointer items-center gap-1 rounded px-1 py-0.5',
          isSelected ? 'bg-primary/10 font-medium' : 'hover:bg-muted/50'
        )}
        style={{ paddingLeft: depth * TREE_INDENT + 16 }}
        onClick={() => onSelect(secret)}
        title={fullPath}
      >
        <KeyRound className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="whitespace-nowrap text-xs">{label}</span>
        {canWrite && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRequestDeleteSecret(secret);
            }}
            disabled={isSubmitting}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  if (!hasKids) return null;

  return (
    <AccordionItem value={fullPath} className="border-0">
      <AccordionTrigger hideChevron className="h-7 py-0 hover:no-underline">
        <div
          className="hover:bg-muted/50 flex w-full items-center gap-1 rounded px-1"
          style={{ paddingLeft: depth * TREE_INDENT }}
        >
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
          <Folder className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="whitespace-nowrap text-xs" title={fullPath}>
            {label}
          </span>
          {isConflict && (
            <span title="A secret with this name also exists — rename it to resolve the conflict">
              <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
            </span>
          )}
          {canWrite && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRequestDeleteFolder(fullPath);
              }}
              disabled={isSubmitting}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent outerClassName="py-0" className="p-0">
        {isConflict && secret && (
          <div
            className={cn(
              'flex cursor-pointer items-center gap-1 rounded px-1 py-0.5',
              isSelected ? 'bg-primary/10 font-medium' : 'hover:bg-muted/50'
            )}
            style={{ paddingLeft: (depth + 1) * TREE_INDENT + 16 }}
            onClick={() => onSelect(secret)}
            title={`${fullPath} (secret — conflicts with folder)`}
          >
            <KeyRound className="h-3 w-3 shrink-0 text-amber-500" />
            <span className="whitespace-nowrap text-xs text-amber-600 dark:text-amber-400">
              {label}
            </span>
            <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-amber-500" />
            {canWrite && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestDeleteSecret(secret);
                }}
                disabled={isSubmitting}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
        {entries.map(([, child]) => (
          <SecretTreeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            secretsByName={secretsByName}
            selectedSecret={selectedSecret}
            conflictNames={conflictNames}
            onSelect={onSelect}
            onRequestDeleteSecret={onRequestDeleteSecret}
            onRequestDeleteFolder={onRequestDeleteFolder}
            canWrite={canWrite}
            isSubmitting={isSubmitting}
          />
        ))}
      </AccordionContent>
    </AccordionItem>
  );
}

export function AssistantSecretsManager({
  isOpen,
  onClose,
  assistantId,
  ownerId,
  secretActions,
  canWrite = true,
}: AssistantSecretsManagerProps) {
  const {
    secrets,
    selectedSecret,
    isLoading,
    isSubmitting,
    formMethods,
    handleSelectSecret,
    handleNewSecret,
    handleDeleteSecret,
    handleDeleteFolder,
    handleUploadJson,
    onSubmit,
  } = useAssistantSecrets(assistantId, ownerId, secretActions);

  const [isCreating, setIsCreating] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [pendingDelete, setPendingDelete] = React.useState<PendingDelete | null>(null);
  const [expandedFolders, setExpandedFolders] = React.useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const {
    register,
    formState: { errors, isDirty },
  } = formMethods;

  const secretsByName = React.useMemo(() => new Map(secrets.map((s) => [s.name, s])), [secrets]);

  const conflictNames = React.useMemo(() => {
    const names = secrets.map((s) => s.name);
    const conflicts = new Set<string>();
    for (const name of names) {
      if (secrets.some((s) => s.name.startsWith(name + '/'))) {
        conflicts.add(name);
      }
    }
    return conflicts;
  }, [secrets]);

  const filteredSecrets = React.useMemo(() => {
    if (!searchQuery) return secrets;
    const q = searchQuery.toLowerCase();
    return secrets.filter((s) => s.name.toLowerCase().includes(q));
  }, [secrets, searchQuery]);

  const tree = React.useMemo(
    () => buildNestedDropdownTree(filteredSecrets.map((s) => s.name)),
    [filteredSecrets]
  );

  React.useEffect(() => {
    if (searchQuery) {
      setExpandedFolders(collectFolderPaths(tree));
    } else {
      setExpandedFolders([]);
    }
  }, [searchQuery, tree]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUploadJson(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSelect = (secret: Secret) => {
    handleSelectSecret(secret);
    setIsCreating(false);
    setDetailOpen(true);
  };

  const handleStartCreate = () => {
    handleNewSecret();
    setIsCreating(true);
    setDetailOpen(true);
  };

  const handleCancel = () => {
    setIsCreating(false);
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

  const prevIsSubmittingRef = React.useRef(isSubmitting);
  React.useEffect(() => {
    const wasSubmitting = prevIsSubmittingRef.current;
    prevIsSubmittingRef.current = isSubmitting;
    if (isCreating && wasSubmitting && !isSubmitting) {
      setIsCreating(false);
    }
  }, [isSubmitting, isCreating]);

  const isEditing = !!selectedSecret;
  const showEmptyState = !isLoading && secrets.length === 0 && !isCreating;

  const renderEmptyState = () => (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <h3 className="text-h2">No secret found</h3>
      {canWrite && (
        <div className="mt-4 flex items-center gap-2">
          <Button variant="outline" onClick={handleStartCreate}>
            Add a secret
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload JSON
          </Button>
          <JsonFormatInfo />
        </div>
      )}
    </div>
  );

  const renderLeftPane = () => (
    <div className={cn('flex h-full flex-col', detailOpen ? 'w-1/3 border-r' : 'w-full')}>
      <div className="border-b p-2">
        <Input
          placeholder="Search secrets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      <div className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <SecretsListSkeleton />
        ) : (
          <Accordion
            type="multiple"
            value={expandedFolders}
            onValueChange={setExpandedFolders}
            className="w-max min-w-full"
          >
            {Object.entries(tree.children)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([, child]) => (
                <SecretTreeRow
                  key={child.path}
                  node={child}
                  depth={0}
                  secretsByName={secretsByName}
                  selectedSecret={selectedSecret}
                  conflictNames={conflictNames}
                  onSelect={handleSelect}
                  onRequestDeleteSecret={onRequestDeleteSecret}
                  onRequestDeleteFolder={onRequestDeleteFolder}
                  canWrite={canWrite}
                  isSubmitting={isSubmitting}
                />
              ))}
          </Accordion>
        )}
      </div>
      <div className="flex items-center gap-2 border-t p-2">
        {canWrite && (
          <>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleStartCreate}
              disabled={isSubmitting}
            >
              New
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              title="Upload secrets from JSON file"
            >
              <Upload className="h-4 w-4" />
            </Button>
            <JsonFormatInfo />
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-7 w-7 text-muted-foreground', !canWrite && 'ml-auto')}
          onClick={() => setDetailOpen((prev) => !prev)}
          title={detailOpen ? 'Hide detail pane' : 'Show detail pane'}
        >
          {detailOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );

  const renderRightPane = () => {
    if (!detailOpen) return null;
    return (
      <div className="flex w-2/3 flex-col p-6">
        {!canWrite ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <p className="text-body">
              Secret details are only visible to the assistant owner and organization owners/admins.
            </p>
          </div>
        ) : !selectedSecret && !isCreating ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <p className="text-body">Select a secret or click New to add one</p>
          </div>
        ) : (
          <FormProvider {...formMethods}>
            <form onSubmit={onSubmit} id="secret-form" className="flex flex-1 flex-col">
              <div className="flex-1 space-y-4">
                <div>
                  <Label htmlFor="name" className="mb-2 block">
                    Name
                  </Label>
                  <Input
                    id="name"
                    {...register('name', { required: 'Name is required' })}
                    disabled={isSubmitting}
                  />
                  {errors.name && (
                    <p className="text-body text-error mt-1">{errors.name.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="value" className="mb-2 block">
                    {isEditing ? 'New Value' : 'Value'}
                  </Label>
                  <Input
                    id="value"
                    type="password"
                    {...register('value', isEditing ? {} : { required: 'Value is required' })}
                    placeholder={isEditing ? 'Enter new value to replace current...' : ''}
                    disabled={isSubmitting}
                  />
                  {!isEditing && (
                    <div className="mt-2 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-2.5 text-yellow-600 dark:text-yellow-400">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="text-xs">
                        This value will not be viewable after saving. Make sure it is saved
                        elsewhere.
                      </p>
                    </div>
                  )}
                  {errors.value && (
                    <p className="text-body text-error mt-1">{errors.value.message}</p>
                  )}
                </div>
                <div className="flex flex-1 flex-col">
                  <Label htmlFor="description" className="mb-2 block">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    className="flex-1 resize-none"
                    placeholder="Optional description..."
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-4">
                {isCreating && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                )}
                <Button type="submit" form="secret-form" disabled={isSubmitting || !isDirty}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditing ? 'Save Changes' : 'Save'}
                </Button>
              </div>
            </form>
          </FormProvider>
        )}
      </div>
    );
  };

  const renderManager = () => (
    <div className="flex h-full">
      {renderLeftPane()}
      {renderRightPane()}
    </div>
  );

  const deleteDialogTitle = pendingDelete
    ? pendingDelete.type === 'folder'
      ? `Delete ${pendingDelete.count} secret${pendingDelete.count === 1 ? '' : 's'} under "${pendingDelete.prefix}/"?`
      : `Delete secret "${pendingDelete.secret.name}"?`
    : '';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex h-[90vh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle>Manage secrets</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : showEmptyState ? (
            renderEmptyState()
          ) : (
            renderManager()
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />
      </DialogContent>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
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
    </Dialog>
  );
}
