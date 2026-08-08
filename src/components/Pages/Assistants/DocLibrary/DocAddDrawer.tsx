'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/UI/sheet';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import { AssistantMarkdown } from '../Common/AssistantMarkdown';
import type { DocLibraryKind } from './docLibraryKind';

const STARTER_BODY: Record<DocLibraryKind, string> = {
  guidance:
    '# Playbook title\n\n## Overview\nWhen to use this playbook.\n\n## Steps\n1. First step\n2. Second step',
};

interface DocAddDrawerProps {
  open: boolean;
  kind: DocLibraryKind;
  onClose: () => void;
  /**
   * Persists the document. When omitted, the drawer surfaces a generic toast
   * and closes — the form stays visible so the surface matches the design,
   * but nothing is written (mock / read-only contexts).
   */
  onSave?: (draft: { title: string; body: string }) => void;
}

export function DocAddDrawer({ open, kind, onClose, onSave }: DocAddDrawerProps) {
  const [tab, setTab] = React.useState<'write' | 'preview'>('write');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState(STARTER_BODY[kind]);

  React.useEffect(() => {
    if (open) {
      setTab('write');
      setTitle('');
      setBody(STARTER_BODY[kind]);
    }
  }, [open, kind]);

  const titleLabel = 'Title';
  const titlePlaceholder = 'e.g. Issue triage';

  const handleSave = () => {
    onSave?.({ title: title.trim(), body });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex flex-col" data-testid="doc-add-drawer">
        <SheetHeader className="shrink-0">
          <SheetDescription className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent-soft-foreground">
            New {kind}
          </SheetDescription>
          <SheetTitle>Add {kind}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="doc-add-title" className="text-title">
              {titleLabel}
            </label>
            <input
              id="doc-add-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={titlePlaceholder}
              className="h-9 w-full rounded-md border bg-card px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              data-testid="doc-add-title"
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTab('write')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  tab === 'write'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setTab('preview')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  tab === 'preview'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Preview
              </button>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                Markdown
              </span>
            </div>
            {tab === 'write' ? (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                className="text-code-sm min-h-[18rem] w-full flex-1 resize-none rounded-md border bg-card p-3 leading-relaxed focus:border-primary focus:outline-none"
                data-testid="doc-add-body"
              />
            ) : (
              <div className="min-h-[18rem] flex-1 overflow-y-auto rounded-md border bg-card p-3">
                <AssistantMarkdown>{body || '_Nothing to preview yet._'}</AssistantMarkdown>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="mt-4 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="doc-add-cancel">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!title.trim()}
            data-testid="doc-add-save"
          >
            <Check className="h-3.5 w-3.5" />
            Save {kind}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
