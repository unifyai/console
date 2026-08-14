'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
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
import { cn } from '@/lib/utils';
import type { LogCellEditorDescriptor } from './editorTypes';
import { isImeComposing } from '@/utils/keyboard';

/** Matches RHS panel edit cap — grow with content up to this, then scroll. */
const CELL_EDIT_MAX_HEIGHT_PX = 320;
const RESIZE_HANDLE_SIZE = 10;

export type LogCellInlineEditorProps = {
  anchorEl: HTMLElement;
  draftText: string;
  fieldLabel: string;
  editor?: LogCellEditorDescriptor;
  onCommit: (draft: string) => Promise<boolean>;
  onCancel: () => void;
  /** Scroll container to listen on for reposition / cancel when scrolled away. */
  scrollParent?: HTMLElement | null;
};

type Box = { top: number; left: number; width: number; height: number };

function measureAnchor(el: HTMLElement): Box {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: Math.max(rect.width, 80),
    height: Math.max(rect.height, 28),
  };
}

/**
 * Excel-style overlay editor pinned to a grid cell's top-left.
 * Portal + fixed positioning so expansion is not clipped by table overflow.
 */
export function LogCellInlineEditor({
  anchorEl,
  draftText,
  fieldLabel,
  editor = { kind: 'textarea' },
  onCommit,
  onCancel,
  scrollParent,
}: LogCellInlineEditorProps) {
  const [draft, setDraft] = React.useState(draftText);
  const [isSaving, setIsSaving] = React.useState(false);
  const [box, setBox] = React.useState<Box>(() => measureAnchor(anchorEl));
  const [userSized, setUserSized] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const shellRef = React.useRef<HTMLDivElement>(null);
  const skipCommitRef = React.useRef(false);
  const commitInFlightRef = React.useRef(false);
  const placeCaretAtEndRef = React.useRef(true);
  const draftRef = React.useRef(draft);
  draftRef.current = draft;
  const draftTextRef = React.useRef(draftText);
  draftTextRef.current = draftText;

  const reposition = React.useCallback(() => {
    if (!anchorEl.isConnected) {
      onCancel();
      return;
    }
    const next = measureAnchor(anchorEl);
    setBox((prev) => {
      if (userSized) {
        return { ...prev, top: next.top, left: next.left };
      }
      return {
        top: next.top,
        left: next.left,
        width: Math.max(next.width, prev.width),
        height: Math.max(next.height, prev.height),
      };
    });
  }, [anchorEl, onCancel, userSized]);

  React.useEffect(() => {
    reposition();
    const onScrollOrResize = () => reposition();
    window.addEventListener('resize', onScrollOrResize);
    scrollParent?.addEventListener('scroll', onScrollOrResize, { passive: true });
    // Also listen on document scrollable ancestors via capture on window scroll.
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      scrollParent?.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [reposition, scrollParent]);

  // Auto-grow height with content up to max (unless user dragged larger).
  React.useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el || userSized) return;

    el.style.height = 'auto';
    el.style.overflowY = 'hidden';
    const contentH = el.scrollHeight;
    const nextH = Math.min(
      Math.max(contentH, measureAnchor(anchorEl).height),
      CELL_EDIT_MAX_HEIGHT_PX
    );
    if (contentH > CELL_EDIT_MAX_HEIGHT_PX) {
      el.style.overflowY = 'auto';
    }
    setBox((prev) => (prev.height === nextH ? prev : { ...prev, height: nextH }));

    if (placeCaretAtEndRef.current) {
      placeCaretAtEndRef.current = false;
      const end = el.value.length;
      el.focus();
      try {
        el.setSelectionRange(end, end);
      } catch {
        /* some browsers reject selection on certain inputs */
      }
      if (el.scrollHeight > el.clientHeight) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [draft, anchorEl, userSized]);

  const cancelEdit = React.useCallback(() => {
    skipCommitRef.current = true;
    onCancel();
  }, [onCancel]);

  const commitEdit = React.useCallback(
    async (nextDraft = draftRef.current) => {
      if (isSaving || commitInFlightRef.current) return;
      if (skipCommitRef.current) {
        skipCommitRef.current = false;
        return;
      }
      const current = nextDraft;
      if (current === draftTextRef.current) {
        onCancel();
        return;
      }
      commitInFlightRef.current = true;
      setIsSaving(true);
      const ok = await onCommit(current);
      setIsSaving(false);
      commitInFlightRef.current = false;
      if (ok) onCancel();
    },
    [isSaving, onCancel, onCommit]
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (isImeComposing(event)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelEdit();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      void commitEdit();
    }
  };

  const onResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startW = box.width;
    const startH = box.height;
    const minW = measureAnchor(anchorEl).width;
    const minH = measureAnchor(anchorEl).height;

    const onMove = (ev: PointerEvent) => {
      setUserSized(true);
      setBox((prev) => ({
        ...prev,
        width: Math.max(minW, startW + (ev.clientX - startX)),
        height: Math.max(
          minH,
          Math.min(CELL_EDIT_MAX_HEIGHT_PX * 2, startH + (ev.clientY - startY))
        ),
      }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      // Refocus textarea after drag so blur-commit still works on click-away.
      inputRef.current?.focus();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={shellRef}
      className={cn(
        'fixed z-[200] flex flex-col overflow-hidden rounded border border-primary bg-background shadow-md',
        'font-mono text-[12px]'
      )}
      style={{
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
        minWidth: measureAnchor(anchorEl).width,
        minHeight: measureAnchor(anchorEl).height,
      }}
      data-testid="log-grid-inline-editor"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {editor.kind === 'select' ? (
        <Select
          value={draft}
          onValueChange={(next) => {
            setDraft(next);
            if (editor.commitOnChange) void commitEdit(next);
          }}
          disabled={isSaving}
        >
          <SelectTrigger
            className="h-full rounded-none border-0 bg-transparent px-2.5 font-mono text-[12px] shadow-none focus:ring-0"
            data-testid="log-grid-inline-editor-select"
          >
            <SelectValue placeholder="Choose a value" />
          </SelectTrigger>
          <SelectContent>
            {editor.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : editor.kind === 'switch' ? (
        <div className="flex h-full items-center px-2.5">
          <Switch
            checked={draft.trim().toLowerCase() === 'true'}
            onCheckedChange={(checked) => {
              const next = String(checked);
              setDraft(next);
              if (editor.commitOnChange) void commitEdit(next);
            }}
            disabled={isSaving}
            data-testid="log-grid-inline-editor-switch"
            aria-label={`Edit ${fieldLabel}`}
          />
        </div>
      ) : editor.kind === 'text' ? (
        <Input
          ref={inputRef as React.Ref<HTMLInputElement>}
          type={editor.inputType ?? 'text'}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => void commitEdit()}
          disabled={isSaving}
          className="h-full min-h-0 rounded-none border-0 bg-transparent px-2.5 py-1.5 font-mono text-[12px] leading-snug shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label={`Edit ${fieldLabel}`}
          data-testid="log-grid-inline-editor-input"
        />
      ) : (
        <Textarea
          ref={inputRef as React.Ref<HTMLTextAreaElement>}
          value={draft}
          rows={1}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => void commitEdit()}
          disabled={isSaving}
          className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-2.5 py-1.5 font-mono text-[12px] leading-snug shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{ scrollbarWidth: 'thin', height: '100%' }}
          aria-label={`Edit ${fieldLabel}`}
          data-testid="log-grid-inline-editor-textarea"
        />
      )}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize editor"
        className="absolute bottom-0 right-0 cursor-se-resize touch-none bg-transparent"
        style={{ width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE }}
        onPointerDown={onResizePointerDown}
        onMouseDown={(e) => {
          // Keep focus on textarea; prevent blur-commit mid-resize.
          e.preventDefault();
        }}
        data-testid="log-grid-inline-editor-resize"
      />
    </div>,
    document.body
  );
}
