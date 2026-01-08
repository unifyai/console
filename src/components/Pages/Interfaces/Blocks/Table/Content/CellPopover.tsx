'use client';

import { BasePopover } from '@/components/Common/Popovers/Base';
import { CopyButton } from '@/components/Common/Buttons/Copy';
import { Cell, flexRender } from '@tanstack/react-table';
import { Dispatch, SetStateAction, useState, useEffect } from 'react';
import { LogProps, LogItemProps } from '@/types/interfaces/logs';
import { getPartAfterFirstUnderscore } from '@/utils/interfaces/selection/selection';
import { sanitizeId } from '@/utils/interfaces/table/columnOperations';
import Markdown from 'react-markdown';

const CellPopover = ({
  cell,
  flatLogs,
  paramsValues,
  isCellExpanded,
  setExpandedCells,
}: {
  cell: Cell<any, unknown>;
  flatLogs: LogProps[];
  paramsValues: LogItemProps;
  isCellExpanded: (cell: Cell<any, unknown>) => boolean;
  setExpandedCells: Dispatch<SetStateAction<{ [k: string]: boolean }>>;
}) => {
  const [open, setOpen] = useState(isCellExpanded(cell));

  // Transform closing event into state update for expanded cells
  useEffect(() => {
    if (!open) {
      setExpandedCells((expandedCells) => ({
        ...expandedCells,
        [cell.id]: false,
      }));
    }
  }, [open, cell.id, setExpandedCells]);

  // Transform expand cell event to popover open state
  useEffect(() => {
    setOpen(isCellExpanded(cell)); // Directly set open state based on expansion
  }, [isCellExpanded, cell]);

  // --- Determine Content ---
  let content: any;
  let displayContent: React.ReactNode;

  const isGroupedCell = cell.getIsGrouped();
  const columnId = cell.column.id;
  const dataType = cell.column.columnDef.meta?.dataType;
  const fieldType = cell.column.columnDef.meta?.fieldType;

  if (isGroupedCell) {
    // --- Content for Grouped Cells ---
    content = cell.row.getValue(columnId);
    const stringifiedContent =
      typeof content === 'object' && content !== null
        ? JSON.stringify(content, null, 2)
        : String(content ?? '');
    displayContent = (
      <Markdown className="text-body-sm prose max-w-none dark:prose-invert">
        {stringifiedContent}
      </Markdown>
    );
  } else {
    // --- Content for Regular Cells (Use flatLogs and paramsValues) ---
    const field = sanitizeId(getPartAfterFirstUnderscore(cell.id));
    const log = flatLogs.find((l) => String(l.id) === cell.row.id);

    if (fieldType === 'param') {
      content = paramsValues[field];
    } else if (log) {
      content = log.entries?.[field] ?? log.derivedEntries?.[field] ?? '';
    } else {
      content = '';
    }

    // Determine how to display regular cell content
    if (dataType === 'image') {
      displayContent = flexRender(cell.column.columnDef.cell, cell.getContext());
    } else {
      const stringifiedContent =
        typeof content === 'object' && content !== null
          ? JSON.stringify(content, null, 2)
          : String(content ?? '');
      displayContent = (
        <Markdown className="text-body-sm prose max-w-none dark:prose-invert">
          {stringifiedContent}
        </Markdown>
      );
    }
  }

  // --- Prepare Content for Copy Button ---
  const contentToCopy =
    typeof content === 'object' && content !== null
      ? JSON.stringify(content)
      : String(content ?? '');

  const copy = (
    <div className="absolute right-1 top-1">
      <CopyButton content={contentToCopy} />
    </div>
  );

  return (
    <div style={{ position: 'absolute' }} onClick={(e) => e.stopPropagation()}>
      <BasePopover
        context="tile"
        button={null}
        open={open}
        setOpen={setOpen}
        // Apply white-space normal to ensure wrapping within the popover bounds
        className="relative max-h-[300px] max-w-[500px] overflow-auto whitespace-normal p-4 pt-6" // Added whitespace-normal
        side="bottom"
        align="start"
      >
        {copy}
        {/* This div ensures the Markdown content respects the popover's bounds */}
        <div className="w-full break-words">{displayContent}</div>
      </BasePopover>
    </div>
  );
};

export default CellPopover;
