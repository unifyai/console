import { useEffect, useState } from 'react';

export const useDimensionsTracker = (divRef?: any) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    if (divRef && divRef.current) {
      observer.observe(divRef.current);
    }

    if (!divRef && document.body) {
      observer.observe(document.body);
    }

    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return dimensions;
};
