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
import { sanitizeId } from '@/lib/logs/columns';
import { isDataFieldEditable, coerceFieldDraft, type DataField, type DataRow } from './dataTypes';

const IMAGE_EXTENSIONS = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp']);
const VIDEO_EXTENSIONS = new Set(['m4v', 'mov', 'mp4', 'ogg', 'webm']);

interface DataRowDetailProps {
  row: DataRow | null;
  title: string;
  description?: string;
  fields: Record<string, DataField>;
  /** When set, open directly in edit mode for this field only. */
  initialEditField?: string | null;
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
  const isImmutable = !isDataFieldEditable(fieldInfo);
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
  initialEditField = null,
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
  const hasEditableFields = fields.some(([key]) => isDataFieldEditable(fieldMetadata[key] ?? {}));
  /** `null` = not editing; `'all'` = full row; otherwise only listed field keys. */
  const [editingFields, setEditingFields] = React.useState<'all' | string[] | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, string | boolean>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const isEditing = editingFields !== null;

  const buildDraftsForKeys = React.useCallback(
    (keys: string[]) =>
      Object.fromEntries(
        keys.map((key) => {
          const value = displayRow?.entries[key];
          return [
            key,
            /^(bool|boolean)$/i.test(fieldMetadata[key]?.dataType ?? '')
              ? Boolean(value)
              : draftValueForField(fieldMetadata[key] ?? {}, value),
          ];
        })
      ),
    [displayRow?.entries, fieldMetadata]
  );

  const startEditingRow = () => {
    const keys = fields
      .map(([key]) => key)
      .filter((key) => isDataFieldEditable(fieldMetadata[key] ?? {}));
    setDrafts(buildDraftsForKeys(keys));
    setErrors({});
    setEditingFields('all');
  };

  const startEditingField = (fieldKey: string) => {
    if (!isDataFieldEditable(fieldMetadata[fieldKey] ?? {})) return;
    setDrafts(buildDraftsForKeys([fieldKey]));
    setErrors({});
    setEditingFields([fieldKey]);
  };

  const resolveEntryKey = React.useCallback(
    (columnOrField: string): string | null => {
      const sanitized = sanitizeId(columnOrField);
      if (fields.some(([key]) => key === sanitized)) return sanitized;
      if (fields.some(([key]) => key === columnOrField)) return columnOrField;
      const lower = sanitized.toLowerCase();
      const match = fields.find(([key]) => key.toLowerCase() === lower);
      return match?.[0] ?? null;
    },
    [fields]
  );

  const appliedInitialEditRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!row) {
      appliedInitialEditRef.current = null;
      setEditingFields(null);
      setDrafts({});
      setErrors({});
      return;
    }
    if (!initialEditField) return;

    const token = `${row.logId}:${initialEditField}`;
    if (appliedInitialEditRef.current === token) return;
    appliedInitialEditRef.current = token;

    const key = resolveEntryKey(initialEditField);
    if (!key || !isDataFieldEditable(fieldMetadata[key] ?? {})) {
      setEditingFields(null);
      return;
    }
    setDrafts(
      Object.fromEntries([
        [
          key,
          /^(bool|boolean)$/i.test(fieldMetadata[key]?.dataType ?? '')
            ? Boolean(row.entries[key])
            : draftValueForField(fieldMetadata[key] ?? {}, row.entries[key]),
        ],
      ])
    );
    setErrors({});
    setEditingFields([key]);
  }, [row, initialEditField, fieldMetadata, resolveEntryKey]);

  const discardChanges = () => {
    setErrors({});
    setEditingFields(null);
  };

  const isFieldBeingEdited = (key: string) =>
    editingFields === 'all' || (Array.isArray(editingFields) && editingFields.includes(key));

  const saveChanges = async () => {
    const updates: Record<string, unknown> = {};
    const nextErrors: Record<string, string> = {};
    const keysToSave =
      editingFields === 'all'
        ? fields.map(([key]) => key)
        : (editingFields ?? []).filter((key) => fields.some(([k]) => k === key));

    for (const key of keysToSave) {
      const value = displayRow?.entries[key];
      const fieldInfo = fieldMetadata[key] ?? {};
      if (!isDataFieldEditable(fieldInfo)) continue;

      const draft = drafts[key];
      try {
        const nextValue = coerceFieldDraft(fieldInfo, String(draft ?? ''), value);
        if (JSON.stringify(nextValue) !== JSON.stringify(value)) updates[key] = nextValue;
      } catch (error) {
        nextErrors[key] =
          error instanceof Error ? error.message : 'Invalid value. Please check the format.';
      }
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
      setEditingFields(null);
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
        className="flex flex-col"
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
                  className="hover:bg-destructive/10 text-destructive hover:text-destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  aria-label="Delete row"
                  data-testid="data-row-detail-delete"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete row
                </Button>
                {hasEditableFields && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEditingRow}
                    data-testid="data-row-detail-edit"
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit row
                  </Button>
                )}
              </div>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="mt-4 min-h-0 flex-1">
          <dl className="space-y-4 pr-4" data-testid="data-row-detail-fields">
            {fields.map(([key, value]) => {
              const formatted = formatDetailValue(key, value);
              const editingThis = isFieldBeingEdited(key);
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
                        {isDataFieldEditable(fieldMetadata[key] ?? {}) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/field:opacity-100"
                            onClick={() => startEditingField(key)}
                            aria-label={`Edit ${key}`}
                            data-testid={`data-row-detail-edit-field-${key}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </dt>
                  <dd className="text-caption mt-1">
                    {editingThis ? (
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
              className="hover:bg-destructive/90 bg-destructive text-destructive-foreground"
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
