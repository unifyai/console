/**
 * Selection Panel Test Harness
 * 
 * A reusable wrapper for testing selection panel behaviors including
 * cell data display, view modes, and entry management.
 * 
 * Usage:
 *   import { renderSelectionPanel } from '../fixtures/selectionPanelTestHarness';
 *   
 *   it('shows selection', async () => {
 *     const { getSelectedCells } = renderSelectionPanel({
 *       initialSelectedCells: [mockCell]
 *     });
 *     expect(getSelectedCells()).toHaveLength(1);
 *   });
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { render, RenderResult, act } from '@testing-library/react';

// Real Store Imports
import { StoreProvider } from '@/contexts/providers/StoreProvider';
import { IStoreState } from '@/contexts/store';

// Shared test utilities
import { useStateContainer } from '../utils';
import { DndContext, closestCenter, DragEndEvent, useSensor, useSensors, MouseSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical, Maximize2, Minimize2, Play, FileType } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export type ViewMode = 'raw' | 'markdown' | 'trace' | 'chat' | 'image' | 'diff' | 'audio' | 'pdf' | 'matrix';

export interface CellData {
  id: string;
  column: string;
  value: unknown;
  type: 'string' | 'number' | 'object' | 'array' | 'image' | 'audio' | 'pdf' | 'matrix' | 'trace' | 'chat';
  nested?: Record<string, unknown>;
}

export interface SelectionPanelCallbacks {
  onExpandEntry?: (id: string) => void;
  onCollapseEntry?: (id: string) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  onViewModeChange?: (mode: ViewMode) => void;
  onReorderEntries?: (entries: CellData[]) => void;
}

export interface SelectionPanelTestOptions {
  /** Initial selected cells */
  initialSelectedCells?: CellData[];
  /** Initial expanded entries */
  initialExpandedEntries?: string[];
  /** Initial view mode */
  initialViewMode?: ViewMode;
  /** Callbacks for actions */
  callbacks?: SelectionPanelCallbacks;
  /** Enable reordering */
  allowReorder?: boolean;
}

export interface SelectionPanelTestResult extends RenderResult {
  /** Get selected cells */
  getSelectedCells: () => CellData[];
  /** Get expanded entries */
  getExpandedEntries: () => string[];
  /** Get current view mode */
  getViewMode: () => ViewMode;
  /** Get entry order */
  getEntryOrder: () => string[];
  /** Expand an entry */
  expandEntry: (id: string) => void;
  /** Collapse an entry */
  collapseEntry: (id: string) => void;
  /** Expand all entries */
  expandAll: () => void;
  /** Collapse all entries */
  collapseAll: () => void;
  /** Set view mode */
  setViewMode: (mode: ViewMode) => void;
  /** Select cells */
  selectCells: (cells: CellData[]) => void;
}

// =============================================================================
// Mock Data
// =============================================================================

export function createMockCells(count: number = 3): CellData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `cell-${i + 1}`,
    column: `Column ${i + 1}`,
    value: `Value ${i + 1}`,
    type: 'string' as const,
    nested: i === 0 ? { subKey: 'subValue', another: { deep: 'nested' } } : undefined,
  }));
}

export function createMockImageCell(): CellData {
  return {
    id: 'image-cell',
    column: 'Image',
    value: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    type: 'image',
  };
}

export function createMockAudioCell(): CellData {
  return {
    id: 'audio-cell',
    column: 'Audio',
    value: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVV',
    type: 'audio',
  };
}

export function createMockTraceCell(): CellData {
  return {
    id: 'trace-cell',
    column: 'Trace',
    value: [
      { name: 'Request', start: 0, end: 100 },
      { name: 'Processing', start: 100, end: 300 },
      { name: 'Response', start: 300, end: 350 },
    ],
    type: 'trace',
  };
}

export function createMockChatCell(): CellData {
  return {
    id: 'chat-cell',
    column: 'Chat',
    value: [
      { role: 'user', content: 'Hello!' },
      { role: 'assistant', content: 'Hi there! How can I help you?' },
      { role: 'user', content: 'Tell me a joke.' },
    ],
    type: 'chat',
  };
}

export function createMockMatrixCell(): CellData {
  return {
    id: 'matrix-cell',
    column: 'Matrix',
    value: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
    type: 'matrix',
  };
}

// =============================================================================
// Internal State Container
// =============================================================================

interface StateContainer {
  getSelectedCells: () => CellData[];
  getExpandedEntries: () => string[];
  getViewMode: () => ViewMode;
  getEntryOrder: () => string[];
  expandEntry: (id: string) => void;
  collapseEntry: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setViewMode: (mode: ViewMode) => void;
  selectCells: (cells: CellData[]) => void;
}

// =============================================================================
// Sortable Entry Component
// =============================================================================

interface SortableEntryProps {
  cell: CellData;
  isExpanded: boolean;
  onToggle: () => void;
  viewMode: ViewMode;
  allowReorder: boolean;
}

function SortableEntry({ cell, isExpanded, onToggle, viewMode, allowReorder }: SortableEntryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cell.id, disabled: !allowReorder });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const renderValue = () => {
    // Raw view mode always takes precedence
    if (viewMode === 'raw') {
      return (
        <pre className="text-sm bg-gray-50 p-2 rounded overflow-auto max-h-40" data-testid={`raw-content-${cell.id}`}>
          {typeof cell.value === 'object' ? JSON.stringify(cell.value, null, 2) : String(cell.value)}
        </pre>
      );
    }

    // Specific view modes
    if (viewMode === 'markdown' && typeof cell.value === 'string') {
      return (
        <div className="prose prose-sm" data-testid={`markdown-content-${cell.id}`}>
          {/* Simplified markdown rendering */}
          {cell.value.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      );
    }

    if (viewMode === 'diff') {
      return (
        <div data-testid={`diff-content-${cell.id}`}>
          <div className="bg-red-50 text-red-700 p-1 text-sm">- removed line</div>
          <div className="bg-green-50 text-green-700 p-1 text-sm">+ added line</div>
        </div>
      );
    }

    // Type-specific rendering that supports view mode overrides
    if (cell.type === 'image' || viewMode === 'image') {
      return (
        <div data-testid={`image-content-${cell.id}`}>
          <img src={String(cell.value)} alt="Cell content" className="max-w-full h-auto" />
        </div>
      );
    }

    if (cell.type === 'audio' || viewMode === 'audio') {
      return (
        <div className="flex items-center gap-2" data-testid={`audio-content-${cell.id}`}>
          <button className="p-2 bg-gray-100 rounded-full" data-testid={`audio-play-${cell.id}`}>
            <Play className="h-4 w-4" />
          </button>
          <div className="flex-1 h-2 bg-gray-200 rounded" />
        </div>
      );
    }

    if (cell.type === 'trace' || viewMode === 'trace') {
      const spans = Array.isArray(cell.value) ? cell.value as Array<{ name: string; start: number; end: number }> : [];
      return (
        <div className="space-y-1" data-testid={`trace-content-${cell.id}`}>
          {spans.map((span, i) => (
            <div key={i} className="flex items-center gap-2" data-testid={`trace-span-${i}`}>
              <span className="text-xs w-20">{span.name}</span>
              <div
                className="h-4 bg-blue-500 rounded"
                style={{ width: `${span.end - span.start}px`, marginLeft: `${span.start / 3}px` }}
              />
            </div>
          ))}
        </div>
      );
    }

    if (cell.type === 'chat' || viewMode === 'chat') {
      const messages = Array.isArray(cell.value) ? cell.value as Array<{ role: string; content: string }> : [];
      return (
        <div className="space-y-2" data-testid={`chat-content-${cell.id}`}>
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-2 rounded ${msg.role === 'user' ? 'bg-blue-100 ml-4' : 'bg-gray-100 mr-4'}`}
              data-testid={`chat-message-${i}`}
              data-role={msg.role}
            >
              {msg.content}
            </div>
          ))}
        </div>
      );
    }

    if (cell.type === 'matrix' || viewMode === 'matrix') {
      const matrix = Array.isArray(cell.value) ? cell.value as number[][] : [];
      return (
        <div className="inline-block" data-testid={`matrix-content-${cell.id}`}>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${matrix[0]?.length ?? 0}, 1fr)` }}>
            {matrix.flat().map((val, i) => (
              <div
                key={i}
                className="w-8 h-8 flex items-center justify-center text-xs border"
                style={{ backgroundColor: `rgba(59, 130, 246, ${val / 10})` }}
                data-testid={`matrix-cell-${i}`}
              >
                {val}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (cell.type === 'pdf' || viewMode === 'pdf') {
      return (
        <div className="border p-4 text-center text-gray-500" data-testid={`pdf-content-${cell.id}`}>
          <FileType className="h-12 w-12 mx-auto mb-2" />
          PDF Document
        </div>
      );
    }

    // Fallback for basic types or unmatched view modes
    return (
      <pre className="text-sm bg-gray-50 p-2 rounded overflow-auto max-h-40" data-testid={`raw-content-${cell.id}`}>
        {typeof cell.value === 'object' ? JSON.stringify(cell.value, null, 2) : String(cell.value)}
      </pre>
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded mb-2"
      data-testid={`entry-${cell.id}`}
    >
      <div className="flex items-center gap-2 p-2 bg-gray-50 cursor-pointer" onClick={onToggle}>
        {allowReorder && (
          <button {...attributes} {...listeners} className="cursor-grab" data-testid={`drag-handle-${cell.id}`}>
            <GripVertical className="h-4 w-4 text-gray-400" />
          </button>
        )}
        <button data-testid={`toggle-${cell.id}`}>
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span className="font-medium text-sm">{cell.column}</span>
        <span className="text-xs text-gray-500">({cell.type})</span>
      </div>
      {isExpanded && (
        <div className="p-2" data-testid={`content-${cell.id}`}>
          {renderValue()}
          {cell.nested && (
            <div className="mt-2 ml-4 border-l-2 pl-2" data-testid={`nested-${cell.id}`}>
              <div className="text-xs text-gray-500 mb-1">Nested data:</div>
              <pre className="text-xs bg-gray-50 p-1 rounded">
                {JSON.stringify(cell.nested, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Selection Panel Wrapper Component
// =============================================================================

interface SelectionPanelWrapperProps extends SelectionPanelTestOptions {
  stateContainerRef: React.MutableRefObject<StateContainer | null>;
}

function SelectionPanelWrapper({
  initialSelectedCells = [],
  initialExpandedEntries = [],
  initialViewMode = 'raw',
  callbacks = {},
  allowReorder = true,
  stateContainerRef,
}: SelectionPanelWrapperProps) {
  const [selectedCells, setSelectedCells] = useState<CellData[]>(initialSelectedCells);
  const [expandedEntries, setExpandedEntries] = useState<string[]>(initialExpandedEntries);
  const [viewMode, setViewModeInternal] = useState<ViewMode>(initialViewMode);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } })
  );
  
  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleExpandEntry = useCallback((id: string) => {
    setExpandedEntries((prev) => [...prev, id]);
    callbacks.onExpandEntry?.(id);
  }, [callbacks]);

  const handleCollapseEntry = useCallback((id: string) => {
    setExpandedEntries((prev) => prev.filter((e) => e !== id));
    callbacks.onCollapseEntry?.(id);
  }, [callbacks]);

  const handleExpandAll = useCallback(() => {
    setExpandedEntries(selectedCells.map((c) => c.id));
    callbacks.onExpandAll?.();
  }, [selectedCells, callbacks]);

  const handleCollapseAll = useCallback(() => {
    setExpandedEntries([]);
    callbacks.onCollapseAll?.();
  }, [callbacks]);

  const handleSetViewMode = useCallback((mode: ViewMode) => {
    setViewModeInternal(mode);
    callbacks.onViewModeChange?.(mode);
  }, [callbacks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedCells((prev) => {
        const oldIndex = prev.findIndex((c) => c.id === active.id);
        const newIndex = prev.findIndex((c) => c.id === over.id);
        const newCells = arrayMove(prev, oldIndex, newIndex);
        callbacks.onReorderEntries?.(newCells);
        return newCells;
      });
    }
  }, [callbacks]);

  // ==========================================================================
  // Safe state updater for external calls
  // ==========================================================================
  
  const handleSelectCells = useCallback((cells: CellData[]) => {
    if (!isMountedRef.current) return;
    setSelectedCells(cells);
  }, []);

  // ==========================================================================
  // Expose state to test via ref (using shared hook)
  // ==========================================================================

  useStateContainer(stateContainerRef, () => ({
    getSelectedCells: () => selectedCells,
    getExpandedEntries: () => expandedEntries,
    getViewMode: () => viewMode,
    getEntryOrder: () => selectedCells.map((c) => c.id),
    expandEntry: handleExpandEntry,
    collapseEntry: handleCollapseEntry,
    expandAll: handleExpandAll,
    collapseAll: handleCollapseAll,
    setViewMode: handleSetViewMode,
    selectCells: handleSelectCells,
  }), [selectedCells, expandedEntries, viewMode, handleExpandEntry, handleCollapseEntry, handleExpandAll, handleCollapseAll, handleSetViewMode, handleSelectCells]);

  // ==========================================================================
  // Render
  // ==========================================================================

  if (selectedCells.length === 0) {
    return (
      <div data-testid="selection-panel-container" className="w-80 border-l p-4">
        <div className="text-gray-500 text-center" data-testid="empty-selection">
          No cells selected
        </div>
      </div>
    );
  }

  return (
    <div data-testid="selection-panel-container" className="w-80 border-l">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm">Selection ({selectedCells.length})</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExpandAll}
            className="p-1 hover:bg-gray-100 rounded"
            data-testid="expand-all-button"
            title="Expand all"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleCollapseAll}
            className="p-1 hover:bg-gray-100 rounded"
            data-testid="collapse-all-button"
            title="Collapse all"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* View mode selector */}
      <div className="p-2 border-b">
        <select
          value={viewMode}
          onChange={(e) => handleSetViewMode(e.target.value as ViewMode)}
          className="w-full px-2 py-1 text-sm border rounded"
          data-testid="view-mode-select"
        >
          <option value="raw">Raw JSON</option>
          <option value="markdown">Markdown</option>
          <option value="trace">Trace</option>
          <option value="chat">Chat</option>
          <option value="image">Image</option>
          <option value="diff">Diff</option>
          <option value="audio">Audio</option>
          <option value="pdf">PDF</option>
          <option value="matrix">Matrix</option>
        </select>
      </div>

      {/* Entries */}
      <div className="p-2 overflow-auto" style={{ maxHeight: '400px' }} data-testid="entries-container">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={selectedCells.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {selectedCells.map((cell) => (
              <SortableEntry
                key={cell.id}
                cell={cell}
                isExpanded={expandedEntries.includes(cell.id)}
                onToggle={() => {
                  if (expandedEntries.includes(cell.id)) {
                    handleCollapseEntry(cell.id);
                  } else {
                    handleExpandEntry(cell.id);
                  }
                }}
                viewMode={viewMode}
                allowReorder={allowReorder}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

// =============================================================================
// Initial Store State
// =============================================================================

function createInitialStoreState(): Partial<IStoreState> {
  return {
    projects: [],
    projectsById: {},
    activeProjectId: null,
    interfacesById: {},
    activeInterfaceId: null,
    tabsById: {},
    activeTabId: null,
    tilesById: {},
  };
}

// =============================================================================
// Main Export: renderSelectionPanel
// =============================================================================

export function renderSelectionPanel(options: SelectionPanelTestOptions = {}): SelectionPanelTestResult {
  const stateContainerRef: React.MutableRefObject<StateContainer | null> = { current: null };
  const initialState = createInitialStoreState();

  const renderResult = render(
    <StoreProvider initialState={initialState}>
      <SelectionPanelWrapper {...options} stateContainerRef={stateContainerRef} />
    </StoreProvider>
  );

  return {
    ...renderResult,
    getSelectedCells: () => stateContainerRef.current?.getSelectedCells() ?? [],
    getExpandedEntries: () => stateContainerRef.current?.getExpandedEntries() ?? [],
    getViewMode: () => stateContainerRef.current?.getViewMode() ?? 'raw',
    getEntryOrder: () => stateContainerRef.current?.getEntryOrder() ?? [],
    expandEntry: (id) => {
      act(() => {
        stateContainerRef.current?.expandEntry(id);
      });
    },
    collapseEntry: (id) => {
      act(() => {
        stateContainerRef.current?.collapseEntry(id);
      });
    },
    expandAll: () => {
      act(() => {
        stateContainerRef.current?.expandAll();
      });
    },
    collapseAll: () => {
      act(() => {
        stateContainerRef.current?.collapseAll();
      });
    },
    setViewMode: (mode) => {
      act(() => {
        stateContainerRef.current?.setViewMode(mode);
      });
    },
    selectCells: (cells) => {
      act(() => {
        stateContainerRef.current?.selectCells(cells);
      });
    },
  };
}

// Mock data creators are exported at their declaration above

