import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LogCellViewPanel } from '@/components/Common/LogGrid/LogCellViewPanel';

describe('LogCellViewPanel', () => {
  it('wraps long primitive values within the pane', async () => {
    render(
      <div style={{ display: 'flex', height: 400, width: 384 }}>
        <LogCellViewPanel
          cells={[
            {
              cellId: '1_message',
              logId: 1,
              rowLabel: '1',
              columnId: 'message',
              value: 'a'.repeat(1_000),
            },
          ]}
          onClose={vi.fn()}
        />
      </div>
    );

    const value = await screen.findByTestId('log-cell-view-primitive');
    expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth);
    expect(getComputedStyle(value).whiteSpace).toBe('pre-wrap');
  });

  it('keeps a horizontal scroll fallback for content that cannot wrap', async () => {
    render(
      <div style={{ display: 'flex', height: 400, width: 384 }}>
        <LogCellViewPanel
          cells={[
            {
              cellId: '1_message',
              logId: 1,
              rowLabel: '1',
              columnId: 'message',
              value: 'content',
            },
          ]}
          onClose={vi.fn()}
        />
      </div>
    );

    const viewport = await screen.findByTestId('log-cell-view-panel-viewport');
    expect(getComputedStyle(viewport).overflowX).toBe('scroll');
  });

  it('uses the structured JSON renderer for object values', async () => {
    render(
      <div style={{ display: 'flex', height: 400, width: 384 }}>
        <LogCellViewPanel
          cells={[
            {
              cellId: '1_payload',
              logId: 1,
              rowLabel: '1',
              columnId: 'payload',
              value: { nested: { answer: 42 } },
            },
          ]}
          onClose={vi.fn()}
        />
      </div>
    );

    expect(await screen.findByText('nested')).toBeVisible();
    expect(screen.queryByTestId('log-cell-view-primitive')).not.toBeInTheDocument();
  });
});
