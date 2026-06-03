'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import type { Assistant } from '@/types/assistants/assistant';
import type { SpaceSummary } from '@/types/spaces/space';
import { currentSpaceIds, type ContextRoot } from '@/lib/assistants/scope';

export const MEMORY_DESTINATION_ALL = 'all';
export const MEMORY_DESTINATION_PERSONAL = 'personal';

export type MemoryDestinationValue =
  | typeof MEMORY_DESTINATION_ALL
  | typeof MEMORY_DESTINATION_PERSONAL
  | `space:${number}`;

interface DestinationDropdownProps {
  assistant: Assistant;
  value: MemoryDestinationValue;
  onValueChange: (value: MemoryDestinationValue) => void;
}

async function fetchAssistantSpaces(assistantId: string): Promise<SpaceSummary[]> {
  const response = await fetch(`/api/assistant/${assistantId}/spaces`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load spaces');
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Unexpected spaces response');
  }
  return data as SpaceSummary[];
}

export function memoryDestinationRoot(value: MemoryDestinationValue): ContextRoot | null {
  if (value === MEMORY_DESTINATION_ALL) return null;
  if (value === MEMORY_DESTINATION_PERSONAL) return { kind: 'personal' };

  const spaceId = Number(value.slice('space:'.length));
  return { kind: 'space', spaceId };
}

export function DestinationDropdown({ assistant, value, onValueChange }: DestinationDropdownProps) {
  const spaceIds = useMemo(() => currentSpaceIds(assistant), [assistant]);

  const { data: spaces = [] } = useQuery({
    queryKey: ['assistant-spaces', assistant.agentId, spaceIds.join(',')],
    queryFn: () => fetchAssistantSpaces(assistant.agentId),
    enabled: spaceIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const spaceNames = useMemo(() => {
    return new Map(spaces.map((space) => [space.spaceId, space.name]));
  }, [spaces]);

  if (spaceIds.length === 0) {
    return null;
  }

  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as MemoryDestinationValue)}>
      <SelectTrigger
        className="h-7 w-[8.5rem] shrink-0 px-2 text-xs"
        aria-label="Memory destination"
        data-testid="memory-destination-dropdown"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={MEMORY_DESTINATION_ALL} data-testid="memory-destination-all">
          All
        </SelectItem>
        <SelectItem value={MEMORY_DESTINATION_PERSONAL} data-testid="memory-destination-personal">
          Personal
        </SelectItem>
        {spaceIds.map((spaceId) => (
          <SelectItem
            key={spaceId}
            value={`space:${spaceId}`}
            data-testid={`memory-destination-space-${spaceId}`}
          >
            {spaceNames.get(spaceId) ?? `Space ${spaceId}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
