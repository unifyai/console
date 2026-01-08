/**
 * useStateContainer Hook
 *
 * A shared hook that manages the state container pattern used by all test harnesses.
 * This pattern exposes internal component state to test code via a mutable ref.
 *
 * Usage:
 *   const stateContainerRef = useRef<StateContainer | null>(null);
 *
 *   function MyHarnessInner({ stateContainerRef }) {
 *     const [value, setValue] = useState(0);
 *
 *     useStateContainer(stateContainerRef, () => ({
 *       getValue: () => value,
 *       setValue: (v) => setValue(v),
 *     }), [value, setValue]);
 *
 *     return <div>{value}</div>;
 *   }
 */
import { useEffect, useMemo, DependencyList, MutableRefObject } from 'react';

/**
 * Manages the state container pattern used by test harnesses.
 *
 * This hook:
 * 1. Memoizes the container builder based on dependencies
 * 2. Updates the ref in useEffect to capture latest state
 * 3. Sets the ref immediately on first render for synchronous access
 *
 * @param ref - Mutable ref that will hold the state container
 * @param builder - Function that builds the state container object
 * @param deps - Dependencies array (should include all state values and handlers)
 * @returns The built state container (for convenience)
 *
 * @example
 * ```tsx
 * interface StateContainer {
 *   getTabs: () => Tab[];
 *   addTab: (name: string) => void;
 * }
 *
 * function TabHarnessInner({ stateContainerRef }) {
 *   const [tabs, setTabs] = useState<Tab[]>([]);
 *
 *   const addTab = useCallback((name: string) => {
 *     setTabs(prev => [...prev, { id: Date.now(), name }]);
 *   }, []);
 *
 *   useStateContainer(stateContainerRef, () => ({
 *     getTabs: () => tabs,
 *     addTab,
 *   }), [tabs, addTab]);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useStateContainer<T>(
  ref: MutableRefObject<T | null>,
  builder: () => T,
  deps: DependencyList
): T {
  // Memoize the container based on dependencies
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const container = useMemo(builder, deps);

  // Update ref in effect to capture latest state on every render
  useEffect(() => {
    ref.current = container;
  });

  // Also set immediately for first render (before effects run)
  // This ensures synchronous access works from the test's perspective
  if (!ref.current) {
    ref.current = container;
  }

  return container;
}

/**
 * Creates a builder function pattern for state containers.
 * This is a helper for when you want to define the container structure
 * outside the component.
 *
 * @example
 * ```tsx
 * const buildContainer = createStateContainerBuilder({
 *   getTabs: (state) => state.tabs,
 *   addTab: (state, actions) => actions.addTab,
 * });
 *
 * function TabHarnessInner({ stateContainerRef }) {
 *   const [tabs, setTabs] = useState([]);
 *   const addTab = useCallback((name) => { ... }, []);
 *
 *   useStateContainer(
 *     stateContainerRef,
 *     () => buildContainer({ tabs }, { addTab }),
 *     [tabs, addTab]
 *   );
 * }
 * ```
 */
export function createStateContainerBuilder<
  TState extends Record<string, unknown>,
  TActions extends Record<string, (...args: unknown[]) => unknown>,
  TContainer,
>(
  builderFn: (state: TState, actions: TActions) => TContainer
): (state: TState, actions: TActions) => TContainer {
  return builderFn;
}

export default useStateContainer;
