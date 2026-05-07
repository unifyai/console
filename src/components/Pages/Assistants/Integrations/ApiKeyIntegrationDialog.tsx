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
import type {
  IntegrationFieldSpec,
  IntegrationProviderConfig,
} from '@/types/assistants/integration';

interface ApiKeyIntegrationDialogProps {
  open: boolean;
  /** ``add`` opens with empty fields, ``edit`` shows masked
   *  placeholders; non-empty input replaces, empty input keeps. */
  mode: 'add' | 'edit';
  provider: IntegrationProviderConfig;
  isSubmitting: boolean;
  /** Called with a map of secretKey -> new value.  Only fields the
   *  user actually filled in (after trimming) are present.  Caller
   *  persists each entry; in edit mode an empty record means the user
   *  kept everything as-is. */
  onSubmit: (changedFields: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

/**
 * Dialog for paste-and-go API-key auth strategies.  Supports both the
 * single-field ``api_key`` shape (e.g. HubSpot's Private App token) and
 * the multi-field ``api_key_multi`` shape (e.g. Matterport's Token ID +
 * Token Secret pair used to compose HTTP Basic credentials).
 *
 * All values render masked (``type="password"``) per the universal-
 * masking rule for the Integrations tab.
 */
export function ApiKeyIntegrationDialog({
  open,
  mode,
  provider,
  isSubmitting,
  onSubmit,
  onClose,
}: ApiKeyIntegrationDialogProps) {
  const fields: IntegrationFieldSpec[] = React.useMemo(() => {
    if (provider.auth.kind === 'api_key') return [provider.auth.field];
    if (provider.auth.kind === 'api_key_multi') return provider.auth.fields;
    return [];
  }, [provider]);

  const [values, setValues] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) setValues({});
  }, [open]);

  if (provider.auth.kind !== 'api_key' && provider.auth.kind !== 'api_key_multi') {
    // Type narrow — caller is responsible for picking the right dialog.
    return null;
  }

  const isEditing = mode === 'edit';
  const titlePrefix = isEditing ? 'Edit' : 'Connect';

  // Trim once per render — both the submit path and the disabled-button
  // gate use the same view of "filled" fields.
  const trimmedChanged: Record<string, string> = {};
  for (const f of fields) {
    const v = (values[f.secretKey] ?? '').trim();
    if (v !== '') trimmedChanged[f.secretKey] = v;
  }

  // Add mode requires every field — partial pastes wouldn't form a usable
  // credential.  Edit mode allows partial: untouched fields keep their
  // existing value.
  const isAddIncomplete = !isEditing && fields.some((f) => !(f.secretKey in trimmedChanged));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && Object.keys(trimmedChanged).length === 0) {
      // "Keep existing" — close without changes.
      onClose();
      return;
    }
    if (isAddIncomplete) return;
    await onSubmit(trimmedChanged);
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

          {fields.map((field) => {
            const inputId = `api-key-value-${field.secretKey}`;
            return (
              <div key={field.secretKey} className="flex flex-col gap-1.5">
                <Label htmlFor={inputId} className="text-xs">
                  {field.label}
                </Label>
                <Input
                  id={inputId}
                  type="password"
                  autoComplete="new-password"
                  value={values[field.secretKey] ?? ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [field.secretKey]: e.target.value }))
                  }
                  placeholder={isEditing ? '••••••••' : (field.placeholder ?? '')}
                  disabled={isSubmitting}
                  data-testid={`integration-api-key-input-${field.secretKey}`}
                />
                {field.helpText && (
                  <p className="text-[11px] text-muted-foreground">{field.helpText}</p>
                )}
              </div>
            );
          })}

          {isEditing && (
            <p className="text-[11px] text-muted-foreground">
              Empty inputs mean &quot;keep existing&quot;. Type to replace.
            </p>
          )}

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
              disabled={isSubmitting || isAddIncomplete}
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
