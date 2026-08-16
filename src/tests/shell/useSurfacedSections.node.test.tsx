import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSurfacedSections, SURFACED_HOLD_MS } from '@/hooks/Shell/useSurfacedSections';
import { SURFACED_CAP } from '@/utils/shell/railLayout';
import type { SectionActivityMap } from '@/types/shell/rail';

/**
 * Promotion is cheap to get right; retirement is not. These pin the timing
 * rules the rail depends on — a row must not vanish the instant a task
 * finishes, must not retire under an open menu, and must not reshuffle when a
 * second section goes live.
 */
const UNPINNED = ['workflows', 'integrations', 'data'];

const live = (...ids: string[]): SectionActivityMap =>
  Object.fromEntries(ids.map((id) => [id, { active: true }]));

function setup(initial: {
  activity?: SectionActivityMap;
  activeSectionId?: string | null;
  frozen?: boolean;
}) {
  return renderHook(
    (props: { activity?: SectionActivityMap; activeSectionId?: string | null; frozen?: boolean }) =>
      useSurfacedSections({
        activity: props.activity,
        unpinned: UNPINNED,
        activeSectionId: props.activeSectionId ?? null,
        frozen: props.frozen ?? false,
      }),
    {
      initialProps: {
        activity: initial.activity,
        activeSectionId: initial.activeSectionId ?? null,
        frozen: initial.frozen ?? false,
      },
    }
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSurfacedSections — promotion', () => {
  it('promotes a live section immediately', () => {
    const { result } = setup({ activity: live('workflows') });
    expect(result.current).toEqual(['workflows']);
  });

  it('appends later arrivals so the first row never shifts', () => {
    const { result, rerender } = setup({ activity: live('integrations') });
    expect(result.current).toEqual(['integrations']);

    rerender({ activity: live('integrations', 'workflows'), activeSectionId: null, frozen: false });
    expect(result.current).toEqual(['integrations', 'workflows']);
  });

  it('never holds more than the cap', () => {
    const { result } = setup({ activity: live('workflows', 'integrations', 'data') });
    expect(result.current).toHaveLength(SURFACED_CAP);
  });
});

describe('useSurfacedSections — retirement', () => {
  it('keeps a row through the hold window after its activity clears', () => {
    const { result, rerender } = setup({ activity: live('workflows') });

    rerender({ activity: {}, activeSectionId: null, frozen: false });
    expect(result.current).toEqual(['workflows']);

    act(() => {
      vi.advanceTimersByTime(SURFACED_HOLD_MS - 1_000);
    });
    expect(result.current).toEqual(['workflows']);

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current).toEqual([]);
  });

  it('cancels the hold when activity returns before it expires', () => {
    const { result, rerender } = setup({ activity: live('workflows') });

    rerender({ activity: {}, activeSectionId: null, frozen: false });
    act(() => {
      vi.advanceTimersByTime(SURFACED_HOLD_MS / 2);
    });

    rerender({ activity: live('workflows'), activeSectionId: null, frozen: false });
    act(() => {
      vi.advanceTimersByTime(SURFACED_HOLD_MS);
    });
    expect(result.current).toEqual(['workflows']);
  });

  it('retires nothing while a menu or the editor is open', () => {
    const { result, rerender } = setup({ activity: live('workflows') });

    rerender({ activity: {}, activeSectionId: null, frozen: true });
    act(() => {
      vi.advanceTimersByTime(SURFACED_HOLD_MS * 3);
    });
    expect(result.current).toEqual(['workflows']);

    rerender({ activity: {}, activeSectionId: null, frozen: false });
    act(() => {
      vi.advanceTimersByTime(SURFACED_HOLD_MS + 1_000);
    });
    expect(result.current).toEqual([]);
  });

  it('drops a section the moment it is opened, since the layout shows it anyway', () => {
    const { result, rerender } = setup({ activity: live('workflows') });

    rerender({ activity: live('workflows'), activeSectionId: 'workflows', frozen: false });
    expect(result.current).toEqual([]);
  });

  it('frees a capped slot for a waiting section once a row retires', () => {
    const { result, rerender } = setup({
      activity: live('workflows', 'integrations', 'data'),
    });
    expect(result.current).toEqual(['workflows', 'integrations']);

    rerender({ activity: live('integrations', 'data'), activeSectionId: null, frozen: false });
    act(() => {
      vi.advanceTimersByTime(SURFACED_HOLD_MS + 1_000);
    });
    expect(result.current).toEqual(['integrations', 'data']);
  });
});
