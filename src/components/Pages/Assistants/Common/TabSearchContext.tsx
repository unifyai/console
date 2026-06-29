'use client';

import * as React from 'react';

interface TabSearchContextValue {
  registerFocusHandler: (scopeId: string, handler: (() => void) | null) => void;
  setActiveSearchScope: (scopeId: string) => void;
  focusActiveTabSearch: () => void;
}

const TabSearchContext = React.createContext<TabSearchContextValue | null>(null);

export function TabSearchProvider({ children }: { children: React.ReactNode }) {
  const handlersRef = React.useRef(new Map<string, () => void>());
  const activeScopeRef = React.useRef('chat');

  const registerFocusHandler = React.useCallback(
    (scopeId: string, handler: (() => void) | null) => {
      if (handler) handlersRef.current.set(scopeId, handler);
      else handlersRef.current.delete(scopeId);
    },
    []
  );

  const setActiveSearchScope = React.useCallback((scopeId: string) => {
    activeScopeRef.current = scopeId;
  }, []);

  const focusActiveTabSearch = React.useCallback(() => {
    handlersRef.current.get(activeScopeRef.current)?.();
  }, []);

  const value = React.useMemo(
    () => ({ registerFocusHandler, setActiveSearchScope, focusActiveTabSearch }),
    [registerFocusHandler, setActiveSearchScope, focusActiveTabSearch]
  );

  return <TabSearchContext.Provider value={value}>{children}</TabSearchContext.Provider>;
}

export function useTabSearchRegistration(
  inputRef: React.RefObject<HTMLInputElement | null>,
  scopeId: string
) {
  const ctx = React.useContext(TabSearchContext);

  React.useEffect(() => {
    if (!ctx || !scopeId) return;
    ctx.registerFocusHandler(scopeId, () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => ctx.registerFocusHandler(scopeId, null);
  }, [ctx, inputRef, scopeId]);
}

export function useTabSearchScope(scopeId: string) {
  const ctx = React.useContext(TabSearchContext);
  React.useEffect(() => {
    if (!ctx || !scopeId) return;
    ctx.setActiveSearchScope(scopeId);
  }, [ctx, scopeId]);
}

export function useTabSearchFocus() {
  const ctx = React.useContext(TabSearchContext);
  return ctx?.focusActiveTabSearch ?? (() => {});
}
