'use client';

/**
 * AssistantFilter Component
 *
 * Dropdown to select a specific assistant or all assistants.
 */

import * as React from 'react';
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

function MartianOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 5h10v3h3v5h-3v6h-4v-4h-2v4H7v-6H4V8h3V5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </svg>
  );
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
      return 'All Martians';
    }
    const assistant = assistants.find((a) => a.agentId === value);
    if (assistant) {
      return assistantDisplayName(assistant);
    }
    return 'All Martians';
  }, [value, assistants]);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || assistants.length === 0}>
      <SelectTrigger className="h-8 w-full sm:w-[180px]" data-testid="assistant-filter">
        <MartianOutlineIcon className="mr-2 h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{displayText}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Martians</SelectItem>
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
