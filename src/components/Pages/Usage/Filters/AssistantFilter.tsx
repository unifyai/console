'use client';

/**
 * AssistantFilter Component
 *
 * Dropdown to select a specific assistant or all assistants.
 */

import * as React from 'react';
import { DroidIcon } from '@/components/Brand';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/UI/select';
import { Assistant } from '@/types/assistants/assistant';
import { assistantDisplayName } from '@/lib/assistants/displayName';

interface AssistantFilterProps {
  /** List of available assistants */
  assistants: Assistant[];
  /** Currently selected assistant ID or 'all' */
  value: string;
  /** Callback when selection changes */
  onChange: (value: string) => void;
  /** Whether the filter is disabled */
  disabled?: boolean;
}

export function AssistantFilter({
  assistants,
  value,
  onChange,
  disabled = false,
}: AssistantFilterProps) {
  // Get the display text for the current selection
  const displayText = React.useMemo(() => {
    if (value === 'all') {
      return 'All Teammates';
    }
    const assistant = assistants.find((a) => a.agentId === value);
    if (assistant) {
      return assistantDisplayName(assistant);
    }
    return 'All Teammates';
  }, [value, assistants]);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || assistants.length === 0}>
      <SelectTrigger className="h-8 w-full sm:w-[180px]" data-testid="assistant-filter">
        <DroidIcon className="mr-2 h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{displayText}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Teammates</SelectItem>
        {assistants.map((assistant) => (
          <SelectItem key={assistant.agentId} value={assistant.agentId}>
            {assistantDisplayName(assistant)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default AssistantFilter;
