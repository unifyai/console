import React, { useMemo } from 'react';
import { createContext, useContextSelector } from 'use-context-selector';

export type PanelExpandContextType = {
  openKeys: Set<string>;
  setOpenKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  forceExpandAll: boolean;
  forceCollapseAll: boolean;
  toggleKey: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  expandRecursively: (paths: string[]) => void;
  collapseRecursively: (paths: string[]) => void;
};

export const PanelExpandContext = createContext<PanelExpandContextType>(null as any);

export function PanelExpandProvider({
  children,
  openKeys,
  setOpenKeys,
  forceExpandAll,
  forceCollapseAll,
  toggleKey,
  expandAll,
  collapseAll,
  expandRecursively,
  collapseRecursively,
}: React.PropsWithChildren<PanelExpandContextType>) {
  const value = useMemo(
    () => ({
      openKeys,
      setOpenKeys,
      forceExpandAll,
      forceCollapseAll,
      toggleKey,
      expandAll,
      collapseAll,
      expandRecursively,
      collapseRecursively,
    }),
    [
      openKeys,
      setOpenKeys,
      forceExpandAll,
      forceCollapseAll,
      toggleKey,
      expandAll,
      collapseAll,
      expandRecursively,
      collapseRecursively,
    ]
  );

  return <PanelExpandContext.Provider value={value}>{children}</PanelExpandContext.Provider>;
}

export function usePanelExpandContextSelector<T>(selector: (ctx: PanelExpandContextType) => T): T {
  const selected = useContextSelector(PanelExpandContext, selector);
  if (selected === undefined) {
    throw new Error('usePanelExpandContextSelector must be used within a PanelExpandProvider');
  }
  return selected;
}
