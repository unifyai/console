'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import type { IntegrationProviderConfig } from '@/types/assistants/integration';

interface ApiKeyIntegrationDialogProps {
  open: boolean;
  /** ``add`` opens with empty fields, ``edit`` shows the masked
   *  placeholder; non-empty input replaces, empty input keeps. */
  mode: 'add' | 'edit';
  provider: IntegrationProviderConfig;
  isSubmitting: boolean;
  /** Called with the new value (string) or ``null`` if the user kept
   *  the existing value (``edit`` mode only).  ``add`` mode always
   *  sends a string. */
  onSubmit: (newValue: string | null) => Promise<void>;
  onClose: () => void;
}

/**
 * Dialog for the API-key auth strategy.  Single field, paste-and-save.
 * The value is always rendered as masked (``type="password"``) per the
 * universal-masking rule for the Integrations tab.
 */
export function ApiKeyIntegrationDialog({
  open,
  mode,
  provider,
  isSubmitting,
  onSubmit,
  onClose,
}: ApiKeyIntegrationDialogProps) {
  const [value, setValue] = React.useState('');

  React.useEffect(() => {
    if (open) setValue('');
  }, [open]);

  if (provider.auth.kind !== 'api_key') {
    // Type narrow — the caller is responsible for picking the right dialog.
    return null;
  }
  const field = provider.auth.field;

  const isEditing = mode === 'edit';
  const titlePrefix = isEditing ? 'Edit' : 'Connect';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && value.trim() === '') {
      // "Keep existing" — close without changes.
      onClose();
      return;
    }
    await onSubmit(value.trim());
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isSubmitting) onClose();
      }}
    >
      <DialogContent className="max-w-md" data-testid={`integration-api-key-dialog-${provider.id}`}>
        <DialogHeader>
          <DialogTitle>
            {titlePrefix} {provider.label}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 pt-1"
          data-testid="integration-api-key-form"
        >
          <p className="text-caption">
            {provider.shortDescription}
            {provider.docsUrl && (
              <>
                {' '}
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  How to set up &rarr;
                </a>
              </>
            )}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="api-key-value" className="text-xs">
              {field.label}
            </Label>
            <Input
              id="api-key-value"
              type="password"
              autoComplete="new-password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={isEditing ? '••••••••' : (field.placeholder ?? '')}
              disabled={isSubmitting}
              data-testid="integration-api-key-input"
            />
            {field.helpText && (
              <p className="text-[11px] text-muted-foreground">{field.helpText}</p>
            )}
            {isEditing && (
              <p className="text-[11px] text-muted-foreground">
                Empty input means &quot;keep existing&quot;. Type to replace.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || (!isEditing && value.trim() === '')}
              data-testid="integration-api-key-submit"
            >
              {isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
