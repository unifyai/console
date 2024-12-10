import { useState, useCallback, RefObject } from "react";

export function useCallbackRef() {
  const [ref, setRef] = useState<RefObject<HTMLElement> | null>(null);
  const fn = useCallback((node: RefObject<HTMLElement>) => {
    setRef(node);
  }, []);

  return { ref, fn };
}
