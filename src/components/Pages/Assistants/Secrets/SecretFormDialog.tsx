import { Loader2, AlertTriangle } from 'lucide-react';
import { FormProvider, type UseFormReturn } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Textarea } from '@/components/UI/textarea';

interface SecretFormData {
  name: string;
  value: string;
  description: string;
}

interface SecretFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  formMethods: UseFormReturn<SecretFormData>;
  isSubmitting: boolean;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  onClose: () => void;
}

/* Dialog-hosted create / edit form for a single secret.
   Shares the same react-hook-form state as the rest of the Secrets UI
   (via `formMethods` provided by `useAssistantSecrets`). */
export function SecretFormDialog({
  open,
  mode,
  formMethods,
  isSubmitting,
  onSubmit,
  onClose,
}: SecretFormDialogProps) {
  const {
    register,
    formState: { errors, isDirty },
  } = formMethods;

  const isEditing = mode === 'edit';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isSubmitting) onClose();
      }}
    >
      <DialogContent className="max-w-md" data-testid="secret-form-dialog">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Update secret' : 'New secret'}</DialogTitle>
        </DialogHeader>

        <FormProvider {...formMethods}>
          <form
            id="secret-form"
            onSubmit={onSubmit}
            className="flex flex-col gap-4 pt-1"
            data-testid="secret-form"
          >
            <div>
              <Label htmlFor="name" className="mb-2 block">
                Name
              </Label>
              <Input
                id="name"
                {...register('name', { required: 'Name is required' })}
                disabled={isSubmitting}
                placeholder="e.g. stripe/prod/API_KEY"
              />
              {errors.name && <p className="text-body text-error mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <Label htmlFor="value" className="mb-2 block">
                {isEditing ? 'New Value' : 'Value'}
              </Label>
              <Input
                id="value"
                type="password"
                {...register('value', isEditing ? {} : { required: 'Value is required' })}
                placeholder={isEditing ? 'Leave blank to keep existing value' : ''}
                disabled={isSubmitting}
              />
              {!isEditing && (
                <div className="border-[color:var(--status-warning)]/30 mt-2 flex items-start gap-2 rounded-md border bg-[color:var(--status-warning-bg)] p-2.5 text-[color:var(--status-warning)]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-xs">
                    This value will not be viewable after saving. Make sure it is saved elsewhere.
                  </p>
                </div>
              )}
              {errors.value && <p className="text-body text-error mt-1">{errors.value.message}</p>}
            </div>

            <div>
              <Label htmlFor="description" className="mb-2 block">
                Description
              </Label>
              <Textarea
                id="description"
                {...register('description')}
                className="min-h-[80px] resize-none"
                placeholder="Optional description…"
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !isDirty}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Save'}
              </Button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
