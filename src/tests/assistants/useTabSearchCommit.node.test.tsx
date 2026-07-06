import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTabSearchCommit } from '@/hooks/Assistants/useTabSearchCommit';

describe('useTabSearchCommit', () => {
  it('keeps draft and committed separate until submit', () => {
    const { result } = renderHook(() => useTabSearchCommit());

    act(() => {
      result.current.setDraft('hello');
    });
    expect(result.current.draft).toBe('hello');
    expect(result.current.committed).toBe('');

    act(() => {
      result.current.submit();
    });
    expect(result.current.draft).toBe('hello');
    expect(result.current.committed).toBe('hello');
  });

  it('clears both draft and committed', () => {
    const { result } = renderHook(() => useTabSearchCommit('saved'));

    act(() => {
      result.current.clear();
    });
    expect(result.current.draft).toBe('');
    expect(result.current.committed).toBe('');
  });

  it('syncs from an external committed query', () => {
    const { result, rerender } = renderHook(({ query }) => useTabSearchCommit(query), {
      initialProps: { query: '' },
    });

    rerender({ query: 'applied' });
    expect(result.current.draft).toBe('applied');
    expect(result.current.committed).toBe('applied');
  });
});
