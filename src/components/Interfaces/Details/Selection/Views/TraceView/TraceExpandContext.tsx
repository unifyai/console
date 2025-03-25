import React, {
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useMemo
} from "react";
import { createContext, useContextSelector } from "use-context-selector";

/**
 * The shape of our TraceExpandContext's value. We store:
 *   - openKeys: A Set of all currently expanded "path" strings.
 *   - forceExpandAll: Boolean that, when true, indicates "expand everything possible."
 *   - forceCollapseAll: Boolean that, when true, indicates "collapse everything possible."
 *   - toggleKey: Allows toggling an individual path string if not forced open.
 *   - expandAll: Turns on "forceExpandAll" (and sets forceCollapseAll to false).
 *   - collapseAll: Turns on "forceCollapseAll" (and sets forceExpandAll to false).
 *   - setOpenKeys: Allows direct updates to the openKeys set.
 *   - expandRecursively: Expands all paths in the provided array.
 *   - collapseRecursively: Collapses all paths in the provided array.
 */
type TraceExpandContextType = {
  openKeys: Set<string>;
  setOpenKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  forceExpandAll: boolean;
  forceCollapseAll: boolean;
  toggleKey: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  expandRecursively: (paths: string[]) => void;
  collapseRecursively: (paths: string[]) => void;
  instanceId: string;
};

/**
 * The actual React Context object, with a placeholder.
 * We'll throw an error if used outside of a provider.
 * 
 * We're using use-context-selector to optimize re-renders.
 * Components will only re-render when the specific parts of the context they use change.
 */
const TraceExpandContext = createContext<TraceExpandContextType>({
  openKeys: new Set(),
  setOpenKeys: () => {},
  forceExpandAll: false,
  forceCollapseAll: false,
  toggleKey: () => {},
  expandAll: () => {},
  collapseAll: () => {},
  expandRecursively: () => {},
  collapseRecursively: () => {},
  instanceId: ""
});

// Export TraceExpandContext to allow direct access when needed
export { TraceExpandContext };

interface TraceExpandProviderProps {
  children: ReactNode;
}

// Generate a random ID for debugging context instances
function generateRandomId() {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * TraceExpandProvider:
 *  - Used specifically within TraceView
 *  - Manages global expand/collapse for DictionaryView, ListView, etc. within traces
 */
export function TraceExpandProvider({ children }: TraceExpandProviderProps) {
  // Create a stable instance ID for this context provider
  const instanceId = useMemo(() => generateRandomId(), []);
  
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
   * we may gather all subpaths and store them in openKeys or rely on the 
   * dictionary-level logic to do a single pass recursion).
   */
  const expandAll = useCallback(() => {
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
    setForceExpandAll(false);
    setForceCollapseAll(true);
    setOpenKeys(new Set()); // none explicitly open
  }, []);

  /**
   * expandRecursively: adds all paths in the provided array to openKeys.
   */
  const expandRecursively = useCallback((paths: string[]) => {
    if (paths.length === 0) return;
    
    setOpenKeys((prev) => {
      const next = new Set(prev);
      paths.forEach(p => next.add(p));
      return next;
    });
  }, []);

  /**
   * collapseRecursively: removes all paths in the provided array from openKeys.
   */
  const collapseRecursively = useCallback((paths: string[]) => {
    if (paths.length === 0) return;
    
    setOpenKeys((prev) => {
      const next = new Set(prev);
      paths.forEach(p => next.delete(p));
      return next;
    });
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => {
    return {
      openKeys,
      setOpenKeys,
      forceExpandAll,
      forceCollapseAll,
      toggleKey,
      expandAll,
      collapseAll,
      expandRecursively,
      collapseRecursively,
      instanceId
    };
  }, [
    openKeys, 
    forceExpandAll, 
    forceCollapseAll, 
    toggleKey, 
    expandAll, 
    collapseAll, 
    expandRecursively, 
    collapseRecursively,
    instanceId
  ]);

  return (
    <TraceExpandContext.Provider value={value}>
      {children}
    </TraceExpandContext.Provider>
  );
}

/**
 * useTraceExpandContextSelector: selective context consumer hook
 * 
 * This hook lets components subscribe to only the specific parts of the context they need,
 * reducing unnecessary re-renders when other parts of the context change.
 * 
 * @param selector A function that extracts the needed value from the context
 * @returns The selected value from the context
 */
export function useTraceExpandContextSelector<T>(selector: (ctx: TraceExpandContextType) => T): T {
  return useContextSelector(TraceExpandContext, selector);
}

/**
 * useTraceExpandContext: consumer hook for backward compatibility
 * 
 * This hook returns the entire context and should be used sparingly.
 * Prefer useTraceExpandContextSelector when possible to minimize re-renders.
 */
export function useTraceExpandContext() {
  return useContextSelector(TraceExpandContext, ctx => ctx);
} 