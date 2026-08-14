'use client';

import * as React from 'react';
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
import { createAssistantsContext } from '@/lib/assistants/dataContexts';
import { resolveDataTableContext } from '@/lib/assistants/dataBrowser';
import { toast } from 'sonner';
import { isImeComposing } from '@/utils/keyboard';

export type DataCreateTableDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Scope prefix e.g. `{owner}/{assistant}/` or `Teams/{id}/`. */
  scopePrefix: string;
  cwdSegments: string[];
  /** Human-readable path for the create location, e.g. `Personal / Data / Sales`. */
  locationLabel: string;
  onCreated: (context: string) => void;
};

export function DataCreateTableDialog({
  open,
  onOpenChange,
  scopePrefix,
  cwdSegments,
  locationLabel,
  onCreated,
}: DataCreateTableDialogProps) {
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setName('');
  }, [open]);

  const submit = async () => {
    if (saving) return;
    const resolved = resolveDataTableContext(scopePrefix, cwdSegments, name);
    if ('error' in resolved) {
      toast.error(resolved.error);
      return;
    }
    setSaving(true);
    try {
      const result = await createAssistantsContext(resolved.context);
      if (!result.ok) {
        toast.error('Could not create table. Please try again.');
        return;
      }
      onOpenChange(false);
      onCreated(resolved.context);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="data-create-table-dialog">
        <DialogHeader>
          <DialogTitle>New table</DialogTitle>
        </DialogHeader>
        <p className="text-caption text-muted-foreground" data-testid="data-create-table-location">
          Creating in {locationLabel}
        </p>
        <div className="space-y-2">
          <Label htmlFor="data-create-table-name">Name</Label>
          <Input
            id="data-create-table-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Leads or Folder/Leads"
            autoFocus
            data-testid="data-create-table-name"
            onKeyDown={(e) => {
              if (isImeComposing(e)) return;
              if (e.key === 'Enter') void submit();
            }}
          />
          <p className="text-caption text-muted-foreground">
            To create a new folder, include it in the name (e.g. Inbound/Leads).
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={saving || !name.trim()}
            data-testid="data-create-table-submit"
          >
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
