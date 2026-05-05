import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ChatSidePanelProps {
  /**
   * Called when the user dismisses the panel via the Escape key. The
   * primary toggle (info button / actions footer) is owned by the parent
   * and is the main way to close — Escape is just a keyboard nicety.
   */
  onClose: () => void;
  /** Tailwind width override; defaults to a comfortable inspector width. */
  className?: string;
  /**
   * Inline style override. Used by the actions panel to wire a
   * user-resizable width via a CSS variable (so the override only
   * applies above the `sm` breakpoint where it's a real side panel).
   */
  style?: React.CSSProperties;
  /** Optional test id for e2e selectors. */
  testId?: string;
  /**
   * Accessible label for the panel (since there's no visible title).
   * Defaults to "Side panel".
   */
  ariaLabel?: string;
  children: React.ReactNode;
}

/**
 * In-flow side panel that lives **inside** the chat container's middle
 * row — between the chat sub-header and the actions footer — rather than
 * as a portaled dialog. Always shares the chat's flex row so the chat
 * stays visible behind it on desktop, and the chat's sub-header + actions
 * footer stay visible above and below it on every viewport.
 *
 * Width responsiveness — driven entirely by Tailwind, no JS resize logic:
 *
 *  - **Mobile (< sm)**: `w-full`. With `flex-shrink-0` the panel claims
 *    the entire flex row, collapsing the chat sibling to 0 width — so
 *    the panel reads as a full-width "subview" while the sub-header (with
 *    the toggle button) and actions footer stay visible as the surrounding
 *    chrome.
 *  - **Desktop (>= sm)**: `sm:w-[380px]`. Panel takes a fixed inspector
 *    width and the chat shrinks beside it but stays fully interactive
 *    (scroll, search, type, call).
 *
 * Has no title or close chrome of its own: parents toggle it via their
 * existing affordances (the chat-tab Info button for the assistant info
 * panel, the chat-tab actions footer for the live-actions panel). An
 * Escape-key shortcut is included for keyboard users.
 */
export function ChatSidePanel({
  onClose,
  className,
  style,
  testId,
  ariaLabel = 'Side panel',
  children,
}: ChatSidePanelProps) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Don't steal Escape from open inputs / popovers
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside
      className={cn(
        'relative flex w-full flex-shrink-0 flex-col overflow-hidden border-l bg-background duration-200 animate-in fade-in slide-in-from-right-4 sm:w-[380px]',
        className
      )}
      style={style}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      {children}
    </aside>
  );
}
