"use client";

import React, {
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useMemo
} from "react";
import { createContext, useContextSelector } from "use-context-selector";

/**
 * The shape of our ExpandContext's value. We store:
 *   - openKeys: A Set of all currently expanded "path" strings.
 *   - forceExpandAll: Boolean that, when true, indicates "expand everything possible."
 *   - forceCollapseAll: Boolean that, when true, indicates "collapse everything possible."
 *   - toggleKey: Allows toggling an individual path string if not forced open.
 *   - expandAll: Turns on "forceExpandAll" (and sets forceCollapseAll to false).
 *   - collapseAll: Turns on "forceCollapseAll" (and sets forceExpandAll to false).
 *   - setOpenKeys: Allows direct updates to the openKeys set.
 */
type ExpandContextType = {
  openKeys: Set<string>;
  setOpenKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  forceExpandAll: boolean;
  forceCollapseAll: boolean;
  toggleKey: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
};

/**
 * The actual React Context object, with a placeholder.
 * We'll throw an error if used outside of a provider.
 * 
 * We're using use-context-selector to optimize re-renders.
 * Components will only re-render when the specific parts of the context they use change.
 */
const ExpandContext = createContext<ExpandContextType>({
  openKeys: new Set(),
  setOpenKeys: () => {},
  forceExpandAll: false,
  forceCollapseAll: false,
  toggleKey: () => {},
  expandAll: () => {},
  collapseAll: () => {}
});

// Export ExpandContext to allow direct access when needed
export { ExpandContext };

interface ExpandProviderProps {
  children: ReactNode;
  defaultOpenKeys?: Set<string>;
}

/**
 * ExpandProvider:
 *  - Wrap your <Selection> or root component with <ExpandProvider>.
 *  - Manages global expand/collapse for DictionaryView, ListView, etc.
 */
export function ExpandProvider({ 
  children, 
  defaultOpenKeys = new Set() 
}: ExpandProviderProps) {
  // A set of open "paths" representing which nodes are individually expanded.
  const [openKeys, setOpenKeys] = useState<Set<string>>(defaultOpenKeys);

  // If forceExpandAll is true => everything is considered open.
  const [forceExpandAll, setForceExpandAll] = useState<boolean>(false);

  // If forceCollapseAll is true => everything is considered closed.
  const [forceCollapseAll, setForceCollapseAll] = useState<boolean>(false);

  /**
   * toggleKey:
   *  - If we're forcing all open, toggling doesn't do anything.
   *  - If we're forcing all closed, toggling doesn't do anything (since everything is collapsed).
   *  - Otherwise, toggling adds/removes the path from openKeys.
   */
  const toggleKey = useCallback(
    (path: string) => {
      // If we're in "forceExpandAll" or "forceCollapseAll" mode, skip toggling
      if (forceExpandAll) {
        return;
      }
      if (forceCollapseAll) {
        return;
      }

      setOpenKeys((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
    },
    [forceExpandAll, forceCollapseAll]
  );

  /**
   * expandAll: sets "forceExpandAll = true" and "forceCollapseAll = false"
   * so that all potential items are open (though for some views,
   * we may gather all subpaths and store them in openKeys).
   */
  const expandAll = useCallback(() => {
    setForceCollapseAll(false);
    setForceExpandAll(true);
  }, []);

  /**
   * collapseAll: sets "forceCollapseAll = true" and "forceExpandAll = false"
   * so that everything is considered closed. 
   * We'll also clear openKeys since forcibly collapsed items won't appear open.
   */
  const collapseAll = useCallback(() => {
    setForceExpandAll(false);
    setForceCollapseAll(true);
    setOpenKeys(new Set()); // none explicitly open
  }, []);

  const value = {
    openKeys,
    setOpenKeys,
    forceExpandAll,
    forceCollapseAll,
    toggleKey,
    expandAll,
    collapseAll,
  };

  return (
    <ExpandContext.Provider value={value}>
      {children}
    </ExpandContext.Provider>
  );
}

/**
 * useExpandContextSelector: selective context consumer hook
 * 
 * This hook lets components subscribe to only the specific parts of the context they need,
 * reducing unnecessary re-renders when other parts of the context change.
 * 
 * @param selector A function that extracts the needed value from the context
 * @returns The selected value from the context
 */
export function useExpandContextSelector<T>(selector: (ctx: ExpandContextType) => T): T {
  return useContextSelector(ExpandContext, selector);
}

/**
 * useExpandContext: consumer hook for backward compatibility
 * 
 * This hook returns the entire context and should be used sparingly.
 * Prefer useExpandContextSelector when possible to minimize re-renders.
 */
export function useExpandContext() {
  return useContextSelector(ExpandContext, ctx => ctx);
}