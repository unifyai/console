'use client';

import * as React from 'react';

/**
 * Draft vs committed search state for assistant tab toolbars.
 * Filtering and server queries should read `committed`; the input binds to `draft`
 * and only promotes to `committed` on Enter (via `submit`) or clear.
 */
export function useTabSearchCommit(externalQuery = '') {
  const [draft, setDraft] = React.useState(externalQuery);
  const [committed, setCommitted] = React.useState(externalQuery);

  React.useEffect(() => {
    setDraft(externalQuery);
    setCommitted(externalQuery);
  }, [externalQuery]);

  const submit = React.useCallback(() => {
    const trimmed = draft.trim();
    setCommitted(trimmed);
    setDraft(trimmed);
  }, [draft]);

  const clear = React.useCallback(() => {
    setDraft('');
    setCommitted('');
  }, []);

  return {
    draft,
    setDraft,
    committed,
    submit,
    clear,
  };
}
