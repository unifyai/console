/**
 * P2-H: Selection Panel Behavior Tests
 *
 * Tests selection panel behaviors including cell data display,
 * view modes, and entry management.
 *
 * Covers behaviors from BEHAVIORS.md:
 * - H1: Show selection
 * - H2: Multiple selections
 * - H3: Expand entry
 * - H4: Collapse entry
 * - H5: Expand all
 * - H6: Collapse all
 * - H7: View mode - Raw
 * - H8: View mode - Markdown
 * - H9: View mode - Trace
 * - H10: View mode - Chat
 * - H11: View mode - Image
 * - H12: View mode - Diff
 * - H13: Reorder entries
 * - H14: Audio playback
 * - H15: PDF rendering
 * - H16: Matrix view
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  renderSelectionPanel,
  createMockCells,
  createMockImageCell,
  createMockAudioCell,
  createMockTraceCell,
  createMockChatCell,
  createMockMatrixCell,
} from '../fixtures/selectionPanelTestHarness';

// =============================================================================
// P2-H: Selection Panel
// =============================================================================

describe('P2-H: Selection Panel', () => {
  // =========================================================================
  // H1: Show selection
  // =========================================================================
  describe('H1: Show selection', () => {
    it('renders panel with selected cell', async () => {
      const cells = createMockCells(1);
      renderSelectionPanel({ initialSelectedCells: cells });

      await waitFor(() => {
        expect(screen.getByTestId('selection-panel-container')).toBeInTheDocument();
      });

      expect(screen.getByTestId(`entry-${cells[0].id}`)).toBeInTheDocument();
    });

    it('shows cell column name', async () => {
      const cells = createMockCells(1);
      renderSelectionPanel({ initialSelectedCells: cells });

      await waitFor(() => {
        expect(screen.getByText('Column 1')).toBeInTheDocument();
      });
    });

    it('shows empty state when no selection', async () => {
      renderSelectionPanel({ initialSelectedCells: [] });

      await waitFor(() => {
        expect(screen.getByTestId('empty-selection')).toBeInTheDocument();
        expect(screen.getByText('No cells selected')).toBeInTheDocument();
      });
    });

    it('shows selection count in header', async () => {
      const cells = createMockCells(3);
      renderSelectionPanel({ initialSelectedCells: cells });

      await waitFor(() => {
        expect(screen.getByText('Selection (3)')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // H2: Multiple selections
  // =========================================================================
  describe('H2: Multiple selections', () => {
    it('renders multiple entries in accordion', async () => {
      const cells = createMockCells(3);
      renderSelectionPanel({ initialSelectedCells: cells });

      await waitFor(() => {
        expect(screen.getByTestId('entries-container')).toBeInTheDocument();
      });

      expect(screen.getByTestId('entry-cell-1')).toBeInTheDocument();
      expect(screen.getByTestId('entry-cell-2')).toBeInTheDocument();
      expect(screen.getByTestId('entry-cell-3')).toBeInTheDocument();
    });

    it('can expand individual entries', async () => {
      const user = userEvent.setup();
      const cells = createMockCells(3);
      const { getExpandedEntries } = renderSelectionPanel({ initialSelectedCells: cells });

      await waitFor(() => {
        expect(screen.getByTestId('entries-container')).toBeInTheDocument();
      });

      expect(getExpandedEntries()).toHaveLength(0);

      await user.click(screen.getByTestId('toggle-cell-1'));

      await waitFor(() => {
        expect(getExpandedEntries()).toContain('cell-1');
      });
    });
  });

  // =========================================================================
  // H3: Expand entry
  // =========================================================================
  describe('H3: Expand entry', () => {
    it('clicking expand shows entry content', async () => {
      const user = userEvent.setup();
      const onExpandEntry = vi.fn();
      const cells = createMockCells(1);
      renderSelectionPanel({
        initialSelectedCells: cells,
        callbacks: { onExpandEntry },
      });

      await waitFor(() => {
        expect(screen.getByTestId('entry-cell-1')).toBeInTheDocument();
      });

      // Content not visible initially
      expect(screen.queryByTestId('content-cell-1')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('toggle-cell-1'));

      await waitFor(() => {
        expect(screen.getByTestId('content-cell-1')).toBeInTheDocument();
      });

      expect(onExpandEntry).toHaveBeenCalledWith('cell-1');
    });

    it('shows nested data when expanded', async () => {
      const user = userEvent.setup();
      const cells = createMockCells(1); // First cell has nested data
      renderSelectionPanel({ initialSelectedCells: cells });

      await user.click(screen.getByTestId('toggle-cell-1'));

      await waitFor(() => {
        expect(screen.getByTestId('nested-cell-1')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // H4: Collapse entry
  // =========================================================================
  describe('H4: Collapse entry', () => {
    it('clicking collapse hides entry content', async () => {
      const user = userEvent.setup();
      const onCollapseEntry = vi.fn();
      const cells = createMockCells(1);
      renderSelectionPanel({
        initialSelectedCells: cells,
        initialExpandedEntries: ['cell-1'],
        callbacks: { onCollapseEntry },
      });

      await waitFor(() => {
        expect(screen.getByTestId('content-cell-1')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('toggle-cell-1'));

      await waitFor(() => {
        expect(screen.queryByTestId('content-cell-1')).not.toBeInTheDocument();
      });

      expect(onCollapseEntry).toHaveBeenCalledWith('cell-1');
    });
  });

  // =========================================================================
  // H5: Expand all
  // =========================================================================
  describe('H5: Expand all', () => {
    it('clicking expand all expands all entries', async () => {
      const user = userEvent.setup();
      const onExpandAll = vi.fn();
      const cells = createMockCells(3);
      const { getExpandedEntries } = renderSelectionPanel({
        initialSelectedCells: cells,
        callbacks: { onExpandAll },
      });

      await waitFor(() => {
        expect(screen.getByTestId('expand-all-button')).toBeInTheDocument();
      });

      expect(getExpandedEntries()).toHaveLength(0);

      await user.click(screen.getByTestId('expand-all-button'));

      await waitFor(() => {
        expect(getExpandedEntries()).toHaveLength(3);
      });

      expect(onExpandAll).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // H6: Collapse all
  // =========================================================================
  describe('H6: Collapse all', () => {
    it('clicking collapse all collapses all entries', async () => {
      const user = userEvent.setup();
      const onCollapseAll = vi.fn();
      const cells = createMockCells(3);
      const { getExpandedEntries } = renderSelectionPanel({
        initialSelectedCells: cells,
        initialExpandedEntries: ['cell-1', 'cell-2', 'cell-3'],
        callbacks: { onCollapseAll },
      });

      await waitFor(() => {
        expect(getExpandedEntries()).toHaveLength(3);
      });

      await user.click(screen.getByTestId('collapse-all-button'));

      await waitFor(() => {
        expect(getExpandedEntries()).toHaveLength(0);
      });

      expect(onCollapseAll).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // H7: View mode - Raw
  // =========================================================================
  describe('H7: View mode - Raw', () => {
    it('raw mode shows JSON content', async () => {
      const user = userEvent.setup();
      const cells = createMockCells(1);
      renderSelectionPanel({
        initialSelectedCells: cells,
        initialExpandedEntries: ['cell-1'],
        initialViewMode: 'raw',
      });

      await waitFor(() => {
        expect(screen.getByTestId('raw-content-cell-1')).toBeInTheDocument();
      });
    });

    it('can switch to raw mode', async () => {
      const user = userEvent.setup();
      const onViewModeChange = vi.fn();
      const cells = createMockCells(1);
      const { getViewMode } = renderSelectionPanel({
        initialSelectedCells: cells,
        initialViewMode: 'markdown',
        callbacks: { onViewModeChange },
      });

      await user.selectOptions(screen.getByTestId('view-mode-select'), 'raw');

      await waitFor(() => {
        expect(getViewMode()).toBe('raw');
      });

      expect(onViewModeChange).toHaveBeenCalledWith('raw');
    });
  });

  // =========================================================================
  // H8: View mode - Markdown
  // =========================================================================
  describe('H8: View mode - Markdown', () => {
    it('markdown mode renders formatted content', async () => {
      const cells = [
        {
          id: 'md-cell',
          column: 'Content',
          value: '# Heading\n\nParagraph text',
          type: 'string' as const,
        },
      ];
      renderSelectionPanel({
        initialSelectedCells: cells,
        initialExpandedEntries: ['md-cell'],
        initialViewMode: 'markdown',
      });

      await waitFor(() => {
        expect(screen.getByTestId('markdown-content-md-cell')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // H9: View mode - Trace
  // =========================================================================
  describe('H9: View mode - Trace', () => {
    it('trace mode shows timeline visualization', async () => {
      const traceCell = createMockTraceCell();
      renderSelectionPanel({
        initialSelectedCells: [traceCell],
        initialExpandedEntries: [traceCell.id],
        initialViewMode: 'trace',
      });

      await waitFor(() => {
        expect(screen.getByTestId(`trace-content-${traceCell.id}`)).toBeInTheDocument();
      });

      // Should show spans
      expect(screen.getByTestId('trace-span-0')).toBeInTheDocument();
      expect(screen.getByTestId('trace-span-1')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // H10: View mode - Chat
  // =========================================================================
  describe('H10: View mode - Chat', () => {
    it('chat mode shows message bubbles', async () => {
      const chatCell = createMockChatCell();
      renderSelectionPanel({
        initialSelectedCells: [chatCell],
        initialExpandedEntries: [chatCell.id],
        initialViewMode: 'chat',
      });

      await waitFor(() => {
        expect(screen.getByTestId(`chat-content-${chatCell.id}`)).toBeInTheDocument();
      });

      // Should show messages
      expect(screen.getByTestId('chat-message-0')).toHaveAttribute('data-role', 'user');
      expect(screen.getByTestId('chat-message-1')).toHaveAttribute('data-role', 'assistant');
    });

    it('user and assistant messages have different styles', async () => {
      const chatCell = createMockChatCell();
      renderSelectionPanel({
        initialSelectedCells: [chatCell],
        initialExpandedEntries: [chatCell.id],
        initialViewMode: 'chat',
      });

      await waitFor(() => {
        const userMsg = screen.getByTestId('chat-message-0');
        const assistantMsg = screen.getByTestId('chat-message-1');

        expect(userMsg.className).toContain('bg-blue-100');
        expect(assistantMsg.className).toContain('bg-gray-100');
      });
    });
  });

  // =========================================================================
  // H11: View mode - Image
  // =========================================================================
  describe('H11: View mode - Image', () => {
    it('image mode renders image', async () => {
      const imageCell = createMockImageCell();
      renderSelectionPanel({
        initialSelectedCells: [imageCell],
        initialExpandedEntries: [imageCell.id],
        initialViewMode: 'image',
      });

      await waitFor(() => {
        expect(screen.getByTestId(`image-content-${imageCell.id}`)).toBeInTheDocument();
      });

      const img = screen.getByTestId(`image-content-${imageCell.id}`).querySelector('img');
      expect(img).toBeInTheDocument();
    });
  });

  // =========================================================================
  // H12: View mode - Diff
  // =========================================================================
  describe('H12: View mode - Diff', () => {
    it('diff mode shows added/removed lines', async () => {
      const cells = createMockCells(1);
      renderSelectionPanel({
        initialSelectedCells: cells,
        initialExpandedEntries: ['cell-1'],
        initialViewMode: 'diff',
      });

      await waitFor(() => {
        expect(screen.getByTestId('diff-content-cell-1')).toBeInTheDocument();
      });

      // Should show diff visualization
      expect(screen.getByText(/removed line/)).toBeInTheDocument();
      expect(screen.getByText(/added line/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // H13: Reorder entries
  // =========================================================================
  describe('H13: Reorder entries', () => {
    it('shows drag handles when reorder enabled', async () => {
      const cells = createMockCells(3);
      renderSelectionPanel({
        initialSelectedCells: cells,
        allowReorder: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('drag-handle-cell-1')).toBeInTheDocument();
        expect(screen.getByTestId('drag-handle-cell-2')).toBeInTheDocument();
      });
    });

    it('getEntryOrder returns current order', async () => {
      const cells = createMockCells(3);
      const { getEntryOrder } = renderSelectionPanel({
        initialSelectedCells: cells,
      });

      await waitFor(() => {
        expect(screen.getByTestId('entries-container')).toBeInTheDocument();
      });

      expect(getEntryOrder()).toEqual(['cell-1', 'cell-2', 'cell-3']);
    });

    it('hides drag handles when reorder disabled', async () => {
      const cells = createMockCells(3);
      renderSelectionPanel({
        initialSelectedCells: cells,
        allowReorder: false,
      });

      await waitFor(() => {
        expect(screen.getByTestId('entries-container')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('drag-handle-cell-1')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // H14: Audio playback
  // =========================================================================
  describe('H14: Audio playback', () => {
    it('audio mode shows player controls', async () => {
      const audioCell = createMockAudioCell();
      renderSelectionPanel({
        initialSelectedCells: [audioCell],
        initialExpandedEntries: [audioCell.id],
        initialViewMode: 'audio',
      });

      await waitFor(() => {
        expect(screen.getByTestId(`audio-content-${audioCell.id}`)).toBeInTheDocument();
        expect(screen.getByTestId(`audio-play-${audioCell.id}`)).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // H15: PDF rendering
  // =========================================================================
  describe('H15: PDF rendering', () => {
    it('pdf mode shows document viewer', async () => {
      const pdfCell = {
        id: 'pdf-cell',
        column: 'Document',
        value: 'base64-pdf-data',
        type: 'pdf' as const,
      };
      renderSelectionPanel({
        initialSelectedCells: [pdfCell],
        initialExpandedEntries: [pdfCell.id],
        initialViewMode: 'pdf',
      });

      await waitFor(() => {
        expect(screen.getByTestId('pdf-content-pdf-cell')).toBeInTheDocument();
        expect(screen.getByText('PDF Document')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // H16: Matrix view
  // =========================================================================
  describe('H16: Matrix view', () => {
    it('matrix mode shows grid visualization', async () => {
      const matrixCell = createMockMatrixCell();
      renderSelectionPanel({
        initialSelectedCells: [matrixCell],
        initialExpandedEntries: [matrixCell.id],
        initialViewMode: 'matrix',
      });

      await waitFor(() => {
        expect(screen.getByTestId(`matrix-content-${matrixCell.id}`)).toBeInTheDocument();
      });

      // Should show matrix cells
      expect(screen.getByTestId('matrix-cell-0')).toBeInTheDocument();
      expect(screen.getByTestId('matrix-cell-8')).toBeInTheDocument(); // 3x3 matrix
    });

    it('matrix cells show values', async () => {
      const matrixCell = createMockMatrixCell();
      renderSelectionPanel({
        initialSelectedCells: [matrixCell],
        initialExpandedEntries: [matrixCell.id],
        initialViewMode: 'matrix',
      });

      await waitFor(() => {
        expect(screen.getByTestId('matrix-cell-0')).toHaveTextContent('1');
        expect(screen.getByTestId('matrix-cell-4')).toHaveTextContent('5');
        expect(screen.getByTestId('matrix-cell-8')).toHaveTextContent('9');
      });
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('Edge cases', () => {
    it('respects initial expanded entries', async () => {
      const cells = createMockCells(3);
      const { getExpandedEntries } = renderSelectionPanel({
        initialSelectedCells: cells,
        initialExpandedEntries: ['cell-1', 'cell-3'],
      });

      await waitFor(() => {
        expect(getExpandedEntries()).toEqual(['cell-1', 'cell-3']);
      });

      expect(screen.getByTestId('content-cell-1')).toBeInTheDocument();
      expect(screen.queryByTestId('content-cell-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('content-cell-3')).toBeInTheDocument();
    });

    it('respects initial view mode', async () => {
      const cells = createMockCells(1);
      const { getViewMode } = renderSelectionPanel({
        initialSelectedCells: cells,
        initialViewMode: 'markdown',
      });

      await waitFor(() => {
        expect(getViewMode()).toBe('markdown');
      });
    });

    it('can dynamically select cells', async () => {
      const { getSelectedCells, selectCells } = renderSelectionPanel({
        initialSelectedCells: [],
      });

      await waitFor(() => {
        expect(screen.getByTestId('empty-selection')).toBeInTheDocument();
      });

      const newCells = createMockCells(2);
      selectCells(newCells);

      await waitFor(() => {
        expect(getSelectedCells()).toHaveLength(2);
      });
    });
  });
});
