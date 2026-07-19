'use client';

import * as React from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Loader2, Upload } from 'lucide-react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/UI/table';
import { ScrollArea, ScrollBar } from '@/components/UI/scroll-area';
import { cn } from '@/lib/utils';
import {
  DATA_IMPORT_EXTENSIONS,
  parseImportFile,
  type ParsedImportData,
} from '@/lib/logs/fileImport';
import { createLogRows } from '@/lib/logs/mutations';
import { createAssistantsContext } from '@/lib/assistants/dataContexts';
import { resolveDataTableContext, tableNameFromFilename } from '@/lib/assistants/dataBrowser';
import { toast } from 'sonner';

const PROJECT = 'Assistants';

export type DataImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * `create` — new table under cwd (requires scopePrefix + cwdSegments).
   * `append` — append rows to an existing context.
   */
  mode: 'create' | 'append';
  scopePrefix?: string;
  cwdSegments?: string[];
  locationLabel?: string;
  /** Required when mode === 'append'. */
  context?: string;
  onComplete: (context: string) => void;
};

export function DataImportDialog({
  open,
  onOpenChange,
  mode,
  scopePrefix = '',
  cwdSegments = [],
  locationLabel = '',
  context,
  onComplete,
}: DataImportDialogProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [parsed, setParsed] = React.useState<ParsedImportData | null>(null);
  const [tableName, setTableName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setFile(null);
    setParsed(null);
    setTableName('');
    setError(null);
    setUploading(false);
    setProgress(null);
  }, [open]);

  const onDrop = React.useCallback(
    async (accepted: File[]) => {
      const selected = accepted[0];
      if (!selected) return;
      setError(null);
      setParsed(null);
      setFile(selected);
      if (mode === 'create') {
        setTableName(tableNameFromFilename(selected.name));
      }
      try {
        const data = await parseImportFile(selected);
        setParsed(data);
      } catch (e: unknown) {
        console.error('Import parse failed', e);
        setFile(null);
        setParsed(null);
        setError(e instanceof Error ? e.message : 'Could not parse this file.');
      }
    },
    [mode]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => void onDrop(files),
    multiple: false,
    disabled: uploading,
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'application/x-jsonlines': ['.jsonl'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
  });

  const submit = async () => {
    if (!parsed || uploading) return;

    let targetContext = context ?? '';
    if (mode === 'create') {
      const resolved = resolveDataTableContext(scopePrefix, cwdSegments, tableName);
      if ('error' in resolved) {
        toast.error(resolved.error);
        return;
      }
      targetContext = resolved.context;
      const created = await createAssistantsContext(targetContext);
      if (!created.ok) {
        toast.error('Could not create table. Please try again.');
        return;
      }
    }
    if (!targetContext) {
      toast.error('Could not import rows. Please try again.');
      return;
    }

    setUploading(true);
    setProgress(`Uploading 0 / ${parsed.rows.length}…`);
    try {
      const result = await createLogRows({
        projectName: PROJECT,
        context: targetContext,
        entries: parsed.rows,
        onProgress: (uploaded, total) => setProgress(`Uploading ${uploaded} / ${total}…`),
      });
      if (!result.ok) {
        toast.error('Could not import rows. Please try again.');
        return;
      }
      toast.success(`Imported ${result.created} ${result.created === 1 ? 'row' : 'rows'}.`);
      onOpenChange(false);
      onComplete(targetContext);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const canSubmit =
    !!parsed &&
    !uploading &&
    !error &&
    (mode === 'append' ? !!context : !!tableName.trim() && !!scopePrefix);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] max-w-3xl flex-col"
        data-testid="data-import-dialog"
      >
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Upload file' : 'Import rows'}</DialogTitle>
        </DialogHeader>

        {mode === 'create' && locationLabel ? (
          <p className="text-caption text-muted-foreground" data-testid="data-import-location">
            Creating in {locationLabel}
          </p>
        ) : null}

        <div
          {...getRootProps()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-8 transition-colors',
            isDragActive ? 'border-primary bg-primary-tint-10' : 'hover:bg-muted/40',
            uploading && 'pointer-events-none opacity-60'
          )}
          data-testid="data-import-dropzone"
        >
          <input {...getInputProps()} data-testid="data-import-input" />
          <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-body-sm text-foreground">
            {isDragActive ? 'Drop file here' : 'Drop a file or click to browse'}
          </p>
          <p className="text-caption text-muted-foreground">
            {DATA_IMPORT_EXTENSIONS.join(', ')} · max 10MB
          </p>
        </div>

        {file && (
          <div className="flex items-center gap-2 text-sm text-foreground">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate" data-testid="data-import-filename">
              {file.name}
            </span>
          </div>
        )}

        {error && (
          <p className="text-caption text-destructive" data-testid="data-import-error" role="alert">
            {error}
          </p>
        )}

        {mode === 'create' && parsed && (
          <div className="space-y-2">
            <Label htmlFor="data-import-table-name">Table name</Label>
            <Input
              id="data-import-table-name"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              data-testid="data-import-table-name"
            />
          </div>
        )}

        {parsed && (
          <div className="min-h-0 flex-1 space-y-2">
            <p className="text-caption text-muted-foreground" data-testid="data-import-summary">
              {parsed.rows.length} {parsed.rows.length === 1 ? 'row' : 'rows'} ·{' '}
              {parsed.headers.length} {parsed.headers.length === 1 ? 'column' : 'columns'}
            </p>
            <ScrollArea className="h-48 rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {parsed.headers.map((h) => (
                      <TableHead key={h} className="whitespace-nowrap font-mono text-[11px]">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {parsed.headers.map((h) => (
                        <TableCell key={h} className="text-code-sm max-w-[12rem] truncate">
                          {row[h] == null ? '' : String(row[h])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}

        {progress && (
          <p className="text-caption inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {progress}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            data-testid="data-import-submit"
          >
            {uploading ? 'Importing…' : mode === 'create' ? 'Create table' : 'Import rows'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
