'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/UI/sheet';
import { ScrollArea } from '@/components/UI/scroll-area';
import { CopyButton } from '@/components/Common/Buttons/Copy';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { Switch } from '@/components/UI/switch';
import { Textarea } from '@/components/UI/textarea';
import { formatDetailValue } from '@/utils/assistants/brain';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/UI/alert-dialog';
import { Pencil, Trash2 } from 'lucide-react';
import type { DataField, DataRow } from './dataTypes';

const IMAGE_EXTENSIONS = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp']);
const VIDEO_EXTENSIONS = new Set(['m4v', 'mov', 'mp4', 'ogg', 'webm']);

interface DataRowDetailProps {
  row: DataRow | null;
  title: string;
  description?: string;
  fields: Record<string, DataField>;
  onSave: (updates: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

type MediaKind = 'image' | 'video';

function mediaKindFor(value: unknown): MediaKind | null {
  if (typeof value !== 'string') return null;
  if (value.startsWith('data:image/')) return 'image';

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const extension = url.pathname.split('.').pop()?.toLowerCase();
    if (extension && IMAGE_EXTENSIONS.has(extension)) return 'image';
    if (extension && VIDEO_EXTENSIONS.has(extension)) return 'video';
  } catch {
    return null;
  }

  return null;
}

function DataMediaPreview({ value, field }: { value: unknown; field: string }) {
  const kind = mediaKindFor(value);
  const [hasFailed, setHasFailed] = React.useState(false);

  React.useEffect(() => setHasFailed(false), [value]);

  if (!kind || typeof value !== 'string') return null;

  return (
    <div className="bg-muted/20 mt-2 overflow-hidden rounded-md border border-border">
      {!hasFailed && kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt={`${field} preview`}
          className="max-h-80 w-full object-contain"
          onError={() => setHasFailed(true)}
          data-testid="data-row-media-image"
        />
      ) : !hasFailed ? (
        <video
          src={value}
          controls
          preload="metadata"
          className="max-h-80 w-full"
          onError={() => setHasFailed(true)}
          data-testid="data-row-media-video"
        />
      ) : null}
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="text-caption block truncate border-t border-border px-2 py-1.5 text-primary hover:underline"
      >
        Open media
      </a>
    </div>
  );
}

function isJsonField(field: DataField, value: unknown): boolean {
  const type = field.dataType?.toLowerCase() ?? '';
  return (
    Array.isArray(value) ||
    (typeof value === 'object' && value !== null) ||
    /dict|list|object|json/.test(type)
  );
}

function isNumericField(field: DataField): boolean {
  return /^(int|integer|float|number|decimal)$/i.test(field.dataType ?? '');
}

function inputTypeFor(field: DataField): React.HTMLInputTypeAttribute {
  const type = field.dataType?.toLowerCase() ?? '';
  if (isNumericField(field)) return 'number';
  if (type === 'date') return 'date';
  if (type === 'time') return 'time';
  if (type === 'datetime' || type === 'date-time') return 'datetime-local';
  return 'text';
}

function draftValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
}

function draftValueForField(field: DataField, value: unknown): string {
  const valueAsString = draftValue(value);
  const type = field.dataType?.toLowerCase();
  if (type === 'date') return valueAsString.slice(0, 10);
  if (type === 'datetime' || type === 'date-time') return valueAsString.slice(0, 16);
  return valueAsString;
}

function FieldEditor({
  field,
  fieldInfo,
  value,
  draft,
  onChange,
  error,
}: {
  field: string;
  fieldInfo: DataField;
  value: unknown;
  draft: string | boolean;
  onChange: (value: string | boolean) => void;
  error?: string;
}) {
  const isImmutable = fieldInfo.mutable === false || fieldInfo.fieldType === 'derived_entry';
  const isJson = isJsonField(fieldInfo, value);
  const isBoolean = /^(bool|boolean)$/i.test(fieldInfo.dataType ?? '');
  const isRestrictedEnum = fieldInfo.restrict === true && (fieldInfo.enumValues?.length ?? 0) > 0;

  if (isImmutable) {
    return <span className="text-caption mt-1 block text-muted-foreground">Read-only</span>;
  }

  if (isRestrictedEnum) {
    return (
      <div className="mt-2 space-y-1.5">
        <Select value={String(draft)} onValueChange={onChange}>
          <SelectTrigger aria-label={`Edit ${field}`}>
            <SelectValue placeholder="Choose a value" />
          </SelectTrigger>
          <SelectContent>
            {fieldInfo.enumValues!.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-caption text-destructive">{error}</p>}
      </div>
    );
  }

  if (isBoolean) {
    return (
      <div className="mt-2 space-y-1.5">
        <Switch checked={Boolean(draft)} onCheckedChange={onChange} aria-label={`Edit ${field}`} />
        {error && <p className="text-caption text-destructive">{error}</p>}
      </div>
    );
  }

  const input = isJson ? (
    <Textarea
      value={String(draft)}
      onChange={(event) => onChange(event.target.value)}
      className="text-caption font-mono"
    />
  ) : (
    <Input
      type={inputTypeFor(fieldInfo)}
      step={fieldInfo.dataType?.toLowerCase() === 'int' ? '1' : 'any'}
      value={String(draft)}
      onChange={(event) => onChange(event.target.value)}
    />
  );

  return (
    <div className="mt-2 space-y-1.5">
      {input}
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  );
}

export function DataRowDetail({
  row,
  title,
  description,
  fields: fieldMetadata,
  onSave,
  onDelete,
  onClose,
}: DataRowDetailProps) {
  const [snapshot, setSnapshot] = React.useState<DataRow | null>(null);

  React.useEffect(() => {
    if (row) setSnapshot(row);
  }, [row]);

  const displayRow = row ?? snapshot;
  const fields = React.useMemo(
    () => Object.entries(displayRow?.entries ?? {}).filter(([key]) => !key.startsWith('_')),
    [displayRow]
  );
  const [isEditing, setIsEditing] = React.useState(false);
  const [drafts, setDrafts] = React.useState<Record<string, string | boolean>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const startEditing = () => {
    setDrafts(
      Object.fromEntries(
        fields.map(([key, value]) => [
          key,
          /^(bool|boolean)$/i.test(fieldMetadata[key]?.dataType ?? '')
            ? Boolean(value)
            : draftValueForField(fieldMetadata[key] ?? {}, value),
        ])
      )
    );
    setErrors({});
    setIsEditing(true);
  };

  const discardChanges = () => {
    setErrors({});
    setIsEditing(false);
  };

  const saveChanges = async () => {
    const updates: Record<string, unknown> = {};
    const nextErrors: Record<string, string> = {};

    for (const [key, value] of fields) {
      const fieldInfo = fieldMetadata[key] ?? {};
      if (fieldInfo.mutable === false || fieldInfo.fieldType === 'derived_entry') continue;

      const draft = drafts[key];
      let nextValue: unknown = draft;
      try {
        if (isJsonField(fieldInfo, value)) {
          nextValue = JSON.parse(String(draft));
        } else if (isNumericField(fieldInfo)) {
          nextValue = Number(draft);
          if (!Number.isFinite(nextValue)) throw new Error('Enter a valid number.');
        }
      } catch (error) {
        nextErrors[key] = error instanceof Error ? error.message : 'Enter valid JSON.';
        continue;
      }

      if (JSON.stringify(nextValue) !== JSON.stringify(value)) updates[key] = nextValue;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    if (Object.keys(updates).length === 0) {
      discardChanges();
      return;
    }

    setErrors({});
    setIsSaving(true);
    try {
      await onSave(updates);
      setIsEditing(false);
    } catch (error) {
      setErrors({
        rowError: error instanceof Error ? error.message : 'Unable to save this row.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRow = async () => {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await onDelete();
      setIsDeleteDialogOpen(false);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete this row.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Sheet
      open={!!row}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full max-w-[min(100vw,42rem)] flex-col"
        data-testid="data-row-detail"
        onAnimationEnd={() => {
          if (!row) setSnapshot(null);
        }}
      >
        <SheetHeader className="shrink-0">
          <div className="flex items-start justify-between gap-3 pr-7">
            <div className="min-w-0">
              <SheetTitle className="break-all">{title}</SheetTitle>
              <SheetDescription>
                {description ?? `${fields.length} ${fields.length === 1 ? 'field' : 'fields'}`}
              </SheetDescription>
            </div>
            {!isEditing && (
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  aria-label="Delete row"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete row
                </Button>
                <Button variant="outline" size="sm" onClick={startEditing}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit row
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="mt-4 min-h-0 flex-1">
          <dl className="space-y-4 pr-4" data-testid="data-row-detail-fields">
            {fields.map(([key, value]) => {
              const formatted = formatDetailValue(key, value);
              return (
                <div key={key} className="group/field">
                  <dt className="text-title flex items-center justify-between gap-3">
                    <span className="min-w-0 break-all">{key}</span>
                    {!isEditing && (
                      <div className="flex shrink-0 items-center gap-1">
                        {formatted !== '—' && (
                          <CopyButton
                            content={formatted}
                            tooltipContent="Copy value"
                            className="h-5 w-5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/field:opacity-100"
                          />
                        )}
                        {fieldMetadata[key]?.mutable !== false &&
                          fieldMetadata[key]?.fieldType !== 'derived_entry' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/field:opacity-100"
                              onClick={startEditing}
                              aria-label={`Edit ${key}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                      </div>
                    )}
                  </dt>
                  <dd className="text-caption mt-1">
                    {isEditing ? (
                      <FieldEditor
                        field={key}
                        fieldInfo={fieldMetadata[key] ?? {}}
                        value={value}
                        draft={drafts[key] ?? draftValueForField(fieldMetadata[key] ?? {}, value)}
                        onChange={(next) => setDrafts((current) => ({ ...current, [key]: next }))}
                        error={errors[key]}
                      />
                    ) : (
                      <>
                        <pre className="bg-muted/30 max-w-full whitespace-pre-wrap break-words rounded-md border border-border p-2 font-mono text-[11px] leading-relaxed text-foreground">
                          {formatted}
                        </pre>
                        <DataMediaPreview value={value} field={key} />
                      </>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </ScrollArea>
        {isEditing && (
          <SheetFooter className="mt-4 shrink-0 border-t pt-3">
            {errors.rowError && (
              <p className="text-caption mr-auto text-destructive">{errors.rowError}</p>
            )}
            <Button variant="outline" onClick={discardChanges} disabled={isSaving}>
              Discard changes
            </Button>
            <Button onClick={() => void saveChanges()} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this row?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the row from {title}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-caption text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void deleteRow();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete row'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
