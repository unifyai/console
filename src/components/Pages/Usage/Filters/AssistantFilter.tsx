'use client';

/**
 * AssistantFilter Component
 *
 * Dropdown to select a specific assistant or all assistants.
 */

import * as React from 'react';
import { Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/UI/select';
import { Assistant } from '@/types/assistants/assistant';

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
      return 'All Assistants';
    }
    const assistant = assistants.find((a) => a.agentId === value);
    if (assistant) {
      return `${assistant.firstName} ${assistant.surname}`;
    }
    return 'All Assistants';
  }, [value, assistants]);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || assistants.length === 0}>
      <SelectTrigger className="h-8 w-[180px]" data-testid="assistant-filter">
        <Users className="mr-2 h-4 w-4 shrink-0" />
        <span className="truncate">{displayText}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Assistants</SelectItem>
        {assistants.map((assistant) => (
          <SelectItem key={assistant.agentId} value={assistant.agentId}>
            {`${assistant.firstName} ${assistant.surname}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default AssistantFilter;
