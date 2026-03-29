import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Textarea } from '@/components/UI/textarea';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Skeleton } from '@/components/UI/skeleton';
import { Loader2, Trash2, AlertTriangle, Upload, Info } from 'lucide-react';
import { useAssistantSecrets } from '@/hooks/Assistants/useAssistantSecrets';
import { Secret, SecretActions } from '@/types/assistants/secret';
import { cn } from '@/lib/utils';
import { FormProvider } from 'react-hook-form';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/UI/popover';

interface AssistantSecretsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  assistantId: string | null;
  ownerId: string | null;
  secretActions: SecretActions;
  /** Whether the current user can create/edit/delete secrets */
  canWrite?: boolean;
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
      <p className="mt-2 text-muted-foreground">Both formats can be mixed in a single file.</p>
    </PopoverContent>
  </Popover>
);

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
    handleUploadJson,
    onSubmit,
  } = useAssistantSecrets(assistantId, ownerId, secretActions);

  const [isCreating, setIsCreating] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const {
    register,
    formState: { errors, isDirty },
  } = formMethods;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadJson(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelect = (secret: Secret) => {
    handleSelectSecret(secret);
    setIsCreating(false);
  };

  const handleStartCreate = () => {
    handleNewSecret();
    setIsCreating(true);
  };

  const handleCancel = () => {
    setIsCreating(false);
  };

  // When a create submission finishes (isSubmitting transitions false while
  // still in create mode), exit create mode so the idle state is shown.
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

  const renderManager = () => (
    <div className="flex h-full">
      {/* Left Panel: Secrets List */}
      <div className="flex h-full w-1/3 flex-col border-r">
        <ScrollArea className="flex-1 p-2">
          {isLoading ? (
            <SecretsListSkeleton />
          ) : (
            <div className="space-y-1">
              {secrets.map((secret) => (
                <div
                  key={secret.logId}
                  className={cn(
                    'flex cursor-pointer items-center justify-between rounded-md p-2',
                    selectedSecret?.logId === secret.logId
                      ? 'bg-muted font-semibold'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() => handleSelect(secret)}
                >
                  <span className="text-body truncate">{secret.name}</span>
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSecret(secret);
                      }}
                      disabled={isSubmitting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {canWrite && (
          <div className="flex items-center gap-2 border-t p-2">
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
          </div>
        )}
      </div>

      {/* Right Panel: Form (only for users with write access) */}
      <div className="flex w-2/3 flex-col p-6">
        {!canWrite ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <p className="text-body">
              Secret details are only visible to the assistant owner and organization owners/admins.
            </p>
          </div>
        ) : !selectedSecret && !isCreating ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <p className="text-body">Click on New to add a secret</p>
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
    </div>
  );

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
    </Dialog>
  );
}
