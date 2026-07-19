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

export type DataColumnNameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialName?: string;
  submitLabel: string;
  testId: string;
  onSubmit: (name: string) => Promise<void> | void;
};

export function DataColumnNameDialog({
  open,
  onOpenChange,
  title,
  initialName = '',
  submitLabel,
  testId,
  onSubmit,
}: DataColumnNameDialogProps) {
  const [name, setName] = React.useState(initialName);
  const [saving, setSaving] = React.useState(false);
  const openedAtRef = React.useRef(0);

  React.useEffect(() => {
    if (open) {
      setName(initialName);
      openedAtRef.current = Date.now();
    }
  }, [open, initialName]);

  const ignoreStaleOutside = React.useCallback(() => {
    return Date.now() - openedAtRef.current < 400;
  }, []);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onSubmit(trimmed);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm"
        data-testid={testId}
        onPointerDownOutside={(event) => {
          if (ignoreStaleOutside()) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (ignoreStaleOutside()) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`${testId}-input`}>Column name</Label>
          <Input
            id={`${testId}-input`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            data-testid={`${testId}-input`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
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
            data-testid={`${testId}-submit`}
          >
            {saving ? 'Saving…' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
