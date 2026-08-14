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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { DATA_COLUMN_TYPE_OPTIONS, type DataColumnType } from './dataTypes';
import { isImeComposing } from '@/utils/keyboard';

export type DataColumnNameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialName?: string;
  submitLabel: string;
  testId: string;
  /** When set, require a data-type selection and pass it to onSubmit. */
  showDataType?: boolean;
  onSubmit: (name: string, dataType?: DataColumnType) => Promise<void> | void;
};

export function DataColumnNameDialog({
  open,
  onOpenChange,
  title,
  initialName = '',
  submitLabel,
  testId,
  showDataType = false,
  onSubmit,
}: DataColumnNameDialogProps) {
  const [name, setName] = React.useState(initialName);
  const [dataType, setDataType] = React.useState<DataColumnType | ''>('');
  const [saving, setSaving] = React.useState(false);
  const openedAtRef = React.useRef(0);

  React.useEffect(() => {
    if (open) {
      setName(initialName);
      setDataType('');
      openedAtRef.current = Date.now();
    }
  }, [open, initialName]);

  const ignoreStaleOutside = React.useCallback(() => {
    return Date.now() - openedAtRef.current < 400;
  }, []);

  const canSubmit = Boolean(name.trim()) && (!showDataType || Boolean(dataType));

  const submit = async () => {
    const trimmed = name.trim();
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      if (showDataType) {
        if (!dataType) return;
        await onSubmit(trimmed, dataType);
      } else {
        await onSubmit(trimmed);
      }
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
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${testId}-input`}>Column name</Label>
            <Input
              id={`${testId}-input`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              data-testid={`${testId}-input`}
              onKeyDown={(e) => {
                if (isImeComposing(e)) return;
                if (e.key === 'Enter') void submit();
              }}
            />
          </div>
          {showDataType ? (
            <div className="space-y-2">
              <Label htmlFor={`${testId}-type`}>Data type</Label>
              <Select
                value={dataType || undefined}
                onValueChange={(value) => setDataType(value as DataColumnType)}
              >
                <SelectTrigger id={`${testId}-type`} data-testid={`${testId}-type`}>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {DATA_COLUMN_TYPE_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      data-testid={`${testId}-type-option-${option.value}`}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
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
            disabled={saving || !canSubmit}
            data-testid={`${testId}-submit`}
          >
            {saving ? 'Saving…' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
