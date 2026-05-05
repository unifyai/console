/**
 * useUnreadDocumentTitle
 *
 * Reflects the workspace-wide total of unread chat messages in the browser
 * tab title, mirroring the convention used by messaging apps (`(3) Unify
 * Console: …`).
 *
 * Inputs:
 *   - `unreadCounts`: the per-assistant unread map produced by
 *     `useAssistantChatStream`. Values are summed; the prefix is omitted
 *     when the total is zero.
 *
 * Behaviour:
 *   - Only applies the prefix while the user is on the assistants page
 *     (`/assistants` or a sub-route). On any other route the hook is a
 *     no-op and any prefix it had previously applied is stripped, so
 *     navigating away from the page (or arriving on a different page
 *     while this hook is mounted higher up the tree) never leaks an
 *     unread count into an unrelated section's title.
 *   - Strips any pre-existing `(N) ` prefix before applying a new one so
 *     repeated runs don't compound (`((3) (5) Title …)`).
 *   - Watches `<title>` with a MutationObserver and re-applies the prefix
 *     whenever the title is overwritten externally (e.g. by Next.js
 *     `metadata` on route change), so the badge survives client-side
 *     navigation within the assistants page.
 *   - Restores the base (un-prefixed) title on unmount.
 */
import * as React from 'react';
import { usePathname } from 'next/navigation';

const PREFIX_RE = /^\(\d+\)\s+/;
const ASSISTANTS_PATH_RE = /^\/assistants(\/|$)/;

const stripPrefix = (title: string): string => title.replace(PREFIX_RE, '');

export function useUnreadDocumentTitle(unreadCounts: Record<string, number>): void {
  const pathname = usePathname();
  const onAssistantsPage = !!pathname && ASSISTANTS_PATH_RE.test(pathname);

  const total = React.useMemo(
    () =>
      Object.values(unreadCounts).reduce(
        (sum, n) => sum + (Number.isFinite(n) && n > 0 ? n : 0),
        0
      ),
    [unreadCounts]
  );

  // Effective total: the prefix is suppressed entirely when the user isn't
  // on the assistants page, even if unread messages have accumulated in
  // the hook's state from a parent that stayed mounted.
  const effectiveTotal = onAssistantsPage ? total : 0;

  // Read the latest total from the MutationObserver without re-binding it
  // on every count change.
  const totalRef = React.useRef(effectiveTotal);
  totalRef.current = effectiveTotal;

  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    let suppressNextObservedChange = false;

    const apply = () => {
      const baseTitle = stripPrefix(document.title);
      const nextTitle = totalRef.current > 0 ? `(${totalRef.current}) ${baseTitle}` : baseTitle;
      if (document.title !== nextTitle) {
        suppressNextObservedChange = true;
        document.title = nextTitle;
      }
    };

    apply();

    const titleEl = document.querySelector('title');
    let observer: MutationObserver | null = null;
    if (titleEl) {
      observer = new MutationObserver(() => {
        if (suppressNextObservedChange) {
          suppressNextObservedChange = false;
          return;
        }
        apply();
      });
      observer.observe(titleEl, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    return () => {
      observer?.disconnect();
      const baseTitle = stripPrefix(document.title);
      if (document.title !== baseTitle) document.title = baseTitle;
    };
  }, [effectiveTotal]);
}
