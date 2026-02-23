import { useState, useEffect } from 'react';

export function useTableGrouping(
  grouping: string[],
  setIsUpdatingLogs: (isUpdating: boolean) => void
) {
  const [isGroupingUpdating, setIsGroupingUpdating] = useState(false);
  const [previousGrouping, setPreviousGrouping] = useState<string[]>(grouping);

  useEffect(() => {
    if (JSON.stringify(grouping) != JSON.stringify(previousGrouping)) {
      setIsGroupingUpdating(true);
      setIsUpdatingLogs(true);
      setPreviousGrouping(grouping);
    }
  }, [grouping, previousGrouping, setIsUpdatingLogs]);

  return {
    isGroupingUpdating,
    setIsGroupingUpdating,
  };
}
