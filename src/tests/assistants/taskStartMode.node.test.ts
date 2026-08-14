import { describe, expect, it } from 'vitest';
import { getTaskCardFields } from '@/utils/assistants/tasks';
import type { TaskRow } from '@/types/assistants/brain';

/**
 * How a definition says it starts, read from the row rather than from a
 * `type` column: unify stores a single start time in `schedule`, an event
 * shape in `trigger`, and a cadence in `repeat`, and any of the three is a
 * standing answer to "what makes this run?".
 */
function taskRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    taskId: 1,
    name: 'Daily briefing',
    description: 'Compose and deliver the morning briefing.',
    priority: 'normal',
    status: 'scheduled',
    ...overrides,
  } as TaskRow;
}

function fieldValue(row: TaskRow, label: string): string {
  const field = getTaskCardFields(row).find((entry) => entry.label === label);
  return String(field?.value ?? '');
}

describe('how a task reports what starts it', () => {
  it('calls a repeat-only definition scheduled, not on demand', () => {
    const row = taskRow({
      repeat: [{ frequency: 'weekly', weekdays: ['MO', 'TU'], timeOfDay: '08:30:00' }],
    });
    expect(fieldValue(row, 'Type')).toBe('Scheduled');
    expect(fieldValue(row, 'Cadence')).toContain('Every week on Mon, Tue');
  });

  it('keeps a triggered definition triggered even when it also repeats', () => {
    const row = taskRow({
      trigger: { medium: 'email' },
      repeat: [{ frequency: 'daily' }],
    });
    expect(fieldValue(row, 'Type')).toBe('Triggered');
  });

  it('reserves on demand for a definition nothing starts by itself', () => {
    expect(fieldValue(taskRow(), 'Type')).toBe('On demand');
  });
});
