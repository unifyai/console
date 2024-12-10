import ResizeObserver from "resize-observer-polyfill";
import { useCallbackRef } from "./useCallbackRef";
import React, { useState, useEffect } from "react";

interface Bounds {
    height: number;
}

export function useMeasure(ref: React.RefObject<HTMLElement>) {
  const { ref: element, fn: attachRef } = useCallbackRef();
  const [bounds, setBounds] = useState<Bounds | null>(null);

  useEffect(() => {
    const onResize = ([entry]: ResizeObserverEntry[]) => {
      setBounds({
        height: entry.contentRect.height
      });
    };

    const observer = new ResizeObserver(onResize);

    if (element && element.current) {
      observer.observe(element.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [element]);

  useEffect(() => {
    attachRef(ref);
  }, [attachRef, ref]);

  return bounds;
}
