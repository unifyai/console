'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { expressionToDerivedFunction } from '@/lib/logs/derivedColumns';
import { createDerivedColumn } from '@/lib/logs/fetch';
import { sanitizeId } from '@/lib/logs/columns';

interface LogDerivedColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  context: string;
  tableName: string;
  columns: string[];
  onCreated: () => void;
}

export function LogDerivedColumnDialog({
  open,
  onOpenChange,
  projectName,
  context,
  columns,
  onCreated,
}: LogDerivedColumnDialogProps) {
  const [name, setName] = React.useState('');
  const [expression, setExpression] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');

  const flatColumns = columns.map((c) => sanitizeId(c));

  React.useEffect(() => {
    if (!open) {
      setName('');
      setExpression('');
      setError('');
      setPending(false);
    }
  }, [open]);

  const submit = async () => {
    const key = name.trim();
    if (!key) {
      setError('Name is required');
      return;
    }
    if (!expression.trim()) {
      setError('Expression is required');
      return;
    }
    setPending(true);
    setError('');
    const tableAlias = 't';
    const equation = expressionToDerivedFunction(
      expression.trim(),
      tableAlias,
      [tableAlias],
      flatColumns
    );
    const result = await createDerivedColumn({
      projectName,
      context,
      key,
      equation,
      tableName: tableAlias,
    });
    setPending(false);
    if (!result.ok) {
      setError('Could not create derived column. Please try again.');
      return;
    }
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="log-grid-derived-dialog">
        <DialogHeader>
          <DialogTitle>Add derived column</DialogTitle>
          <DialogDescription>
            Define a formula using existing column names (e.g. score * 2).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <label className="text-caption text-muted-foreground" htmlFor="derived-name">
              Column name
            </label>
            <Input
              id="derived-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="doubled_score"
              data-testid="log-grid-derived-name"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-caption text-muted-foreground" htmlFor="derived-expr">
              Expression
            </label>
            <Input
              id="derived-expr"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="score * 2"
              className="font-mono"
              data-testid="log-grid-derived-expression"
            />
          </div>
          {error && <p className="text-caption text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={pending}
            data-testid="log-grid-derived-submit"
          >
            {pending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LogDerivedColumnTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5"
      onClick={onClick}
      data-testid="log-grid-derived-open"
    >
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      Derived
    </Button>
  );
}
