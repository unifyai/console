import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";

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
 */
const ExpandContext = createContext<ExpandContextType | null>(null);

interface ExpandProviderProps {
  children: ReactNode;
}

/**
 * ExpandProvider:
 *  - Wrap your <Selection> or root component with <ExpandProvider>.
 *  - Manages global expand/collapse for DictionaryView, ListView, etc.
 */
export function ExpandProvider({ children }: ExpandProviderProps) {
  // A set of open "paths" representing which nodes are individually expanded.
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

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
      console.log(`[ExpandContext:toggleKey] Start toggle for path: ${path}`, {
        forceExpandAll,
        forceCollapseAll,
        currentOpenKeys: Array.from(openKeys),
      });

      // If we're in "forceExpandAll" or "forceCollapseAll" mode, skip toggling 
      if (forceExpandAll) {
        console.log('[ExpandContext:toggleKey] Toggle skipped - forceExpandAll is true');
        return;
      }
      if (forceCollapseAll) {
        console.log('[ExpandContext:toggleKey] Toggle skipped - forceCollapseAll is true');
        return;
      }

      setOpenKeys((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          console.log(`[ExpandContext:toggleKey] Removing path: ${path}`);
          next.delete(path);
        } else {
          console.log(`[ExpandContext:toggleKey] Adding path: ${path}`);
          next.add(path);
        }
        console.log('[ExpandContext:toggleKey] New openKeys state:', Array.from(next));
        return next;
      });
    },
    [forceExpandAll, forceCollapseAll, openKeys]
  );

  /**
   * expandAll: sets "forceExpandAll = true" and "forceCollapseAll = false"
   * so that all potential items are open (though for some views,
   * we may gather all subpaths and store them in openKeys or rely on the 
   * dictionary-level logic to do a single pass recursion).
   */
  const expandAll = useCallback(() => {
    console.log('[ExpandContext:expandAll] Expanding all globally');
    setForceCollapseAll(false);
    setForceExpandAll(true);
    setOpenKeys(new Set()); // clear openKeys, as everything is considered open anyway
  }, []);

  /**
   * collapseAll: sets "forceCollapseAll = true" and "forceExpandAll = false"
   * so that everything is considered closed. 
   * We'll also clear openKeys since forcibly collapsed items won't appear open.
   */
  const collapseAll = useCallback(() => {
    console.log('[ExpandContext:collapseAll] Collapsing all globally');
    setForceExpandAll(false);
    setForceCollapseAll(true);
    setOpenKeys(new Set()); // none explicitly open
  }, []);

  // Add effect to log state changes
  React.useEffect(() => {
    console.log('[ExpandContext:state] State updated:', {
      forceExpandAll,
      forceCollapseAll,
      openKeysCount: openKeys.size,
      openKeys: Array.from(openKeys),
    });
  }, [forceExpandAll, forceCollapseAll, openKeys]);

  const value: ExpandContextType = {
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
 * useExpandContext:  consumer hook
 */
export function useExpandContext() {
  const ctx = useContext(ExpandContext);
  if (!ctx) {
    throw new Error("useExpandContext must be used within an <ExpandProvider>.");
  }
  return ctx;
}