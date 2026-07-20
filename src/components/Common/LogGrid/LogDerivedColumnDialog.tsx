'use client';

import * as React from 'react';
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
import FormulaInput from '@/components/Common/Input/Formula';
import {
  derivedFunctionToExpression,
  expressionToDerivedFunction,
} from '@/lib/logs/derivedColumns';
import { createDerivedColumn, updateDerivedColumn } from '@/lib/logs/fetch';
import { sanitizeId } from '@/lib/logs/columns';

interface LogDerivedColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  context: string;
  columns: string[];
  /** When set, dialog updates this derived column instead of creating. */
  editColumn?: { key: string; equation: string } | null;
  /** Called after a successful create/update with the column key. */
  onCreated: (key: string, meta: { created: boolean }) => void;
}

export function LogDerivedColumnDialog({
  open,
  onOpenChange,
  projectName,
  context,
  columns,
  editColumn,
  onCreated,
}: LogDerivedColumnDialogProps) {
  const isEdit = Boolean(editColumn?.key);
  const [name, setName] = React.useState('');
  const [expression, setExpression] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');

  const flatColumns = React.useMemo(() => columns.map((c) => sanitizeId(c)), [columns]);
  // Orchestra equations use a synthetic `{t:col}` alias; keep it internal — never surface in autocomplete.
  const tableAlias = 't';

  const formulaOptions = React.useMemo(
    () =>
      flatColumns.map((column) => ({
        name: column,
        type: 'Column Name',
        children: [] as string[],
      })),
    [flatColumns]
  );

  React.useEffect(() => {
    if (!open) {
      setName('');
      setExpression('');
      setError('');
      setPending(false);
      return;
    }
    if (editColumn?.key) {
      setName(editColumn.key);
      // Strip the internal `t.` prefix so the editor matches what users type on create.
      setExpression(
        derivedFunctionToExpression(editColumn.equation, [tableAlias], flatColumns).replace(
          new RegExp(`\\b${tableAlias}\\.`, 'g'),
          ''
        )
      );
    }
  }, [open, editColumn, flatColumns]);

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
    if (!isEdit && flatColumns.includes(key)) {
      setError(`${key} already used as a column name.`);
      return;
    }
    setPending(true);
    setError('');
    const equation = expressionToDerivedFunction(
      expression.trim(),
      tableAlias,
      [tableAlias],
      flatColumns
    );
    const result = isEdit
      ? await updateDerivedColumn({
          projectName,
          context,
          key,
          equation,
          tableName: tableAlias,
        })
      : await createDerivedColumn({
          projectName,
          context,
          key,
          equation,
          tableName: tableAlias,
        });
    setPending(false);
    if (!result.ok) {
      setError(
        isEdit
          ? 'Could not update derived column. Please try again.'
          : 'Could not create derived column. Please try again.'
      );
      return;
    }
    onOpenChange(false);
    onCreated(key, { created: !isEdit });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="log-grid-derived-dialog">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit derived column' : 'Add derived column'}</DialogTitle>
          <DialogDescription>
            Enter a Python-style expression using existing column names as variables (e.g. score *
            2). Press Tab for suggestions.
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
              disabled={isEdit}
              data-testid="log-grid-derived-name"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-caption text-muted-foreground" htmlFor="derived-expr">
              Derived expression
            </label>
            <div data-testid="log-grid-derived-expression">
              <FormulaInput
                options={formulaOptions}
                value={expression}
                setValue={setExpression}
                placeholder="Press Tab for suggestions"
              />
            </div>
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
            {pending ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
