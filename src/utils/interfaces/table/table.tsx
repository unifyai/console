import { CSSProperties, Dispatch, SetStateAction, MouseEvent } from 'react';
import {
  Header,
  HeaderGroup,
  Column,
  Row,
  Cell,
  ColumnDef,
  GroupingState,
  FilterFnOption,
  RowSelectionState,
} from '@tanstack/react-table';
import { RowData, RowModel, createRow, getMemoOptions, memo } from '@tanstack/react-table';
import { DragMoveEvent, DragOverEvent, DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Transform } from '@dnd-kit/utilities';
import { toComputableValue, computeStatistic } from '../common';
import {
  LogProps,
  LogsResponseProps,
  LogItemProps,
  HeaderNode,
  GroupedLogProps,
} from '@/types/interfaces/logs';
import { Table } from '@tanstack/react-table';

import { AudioPlayer, ImageDisplay, isImage } from '../selection/selection';
import { formatNumber } from '../formatNumber';
import { durationToTimeDelta, timeDeltaValueToDuration } from '../format';
import { processContext, sanitizeId } from './columnOperations';
import { DraggingColumnsState } from '@/types/interfaces/columns';

/* 
  Updates the dragging columns state when starting to drag a column/column group on top of another
*/
export function handleDragStart(
  event: DragStartEvent,
  draggingColumns: DraggingColumnsState,
  setDraggingColumns: (draggingColumns: DraggingColumnsState) => void,
  columns: Column<any, unknown>[]
) {
  const { active } = event;

  if (!active) return;

  const activeColumn = columns.find((col) => col.id === active.id);

  if (activeColumn?.columnDef.meta?.isParent) {
    // Initialize the dragging state for the active column group
    const newDraggingState: DraggingColumnsState = {
      active: {
        ids: active.data.current?.group ?? getColumnGroupIDs(activeColumn),
        transform: null,
      },
      over: {
        ...draggingColumns.over,
      },
    };

    setDraggingColumns(newDraggingState);
  }
}

/* 
  Updates the dragging columns state when dragging a column/column group on top of another
*/
export function handleDragMove(
  event: DragMoveEvent,
  draggingColumns: DraggingColumnsState,
  setDraggingColumns: (draggingColumns: DraggingColumnsState) => void,
  columns: Column<any, unknown>[]
) {
  const { active, delta } = event;

  if (!active) return;

  // Find the active column
  const activeColumn = columns.find((col) => col.id === active.id);

  if (activeColumn?.columnDef.meta?.isParent) {
    // Propagate the transform values
    const transform: Transform = { x: delta.x, y: delta.y, scaleX: 1.0, scaleY: 1.0 };

    // Construct the new state object
    const newDraggingState: DraggingColumnsState = {
      active: {
        ids: draggingColumns.active.ids,
        transform: transform, // Use the delta for the transform
      },
      over: {
        ...draggingColumns.over,
      },
    };

    setDraggingColumns(newDraggingState);
  }
}

/* 
  Updates the droppable columns state when dragging a column/column group on top of another
*/
export function handleDragOver(
  event: DragOverEvent,
  draggingColumns: DraggingColumnsState,
  setDraggingColumns: (draggingColumns: DraggingColumnsState) => void,
  columns: Column<any, unknown>[]
) {
  const { active, over, delta } = event;

  if (active && over && active.id === over.id) return;

  const activeColumn = columns.find((col) => col.id === active.id);
  const overColumn = columns.find(
    (col) => col.id === over?.id && !draggingColumns.active.ids?.includes(col.id)
  );
  const atSameDepth =
    activeColumn?.columnDef.meta?.renderedDepth === overColumn?.columnDef.meta?.renderedDepth;
  const bothParents =
    activeColumn?.columnDef.meta?.isParent && overColumn?.columnDef.meta?.isParent;

  // Propagate the transform values
  const activeTransform: Transform = { x: delta.x, y: delta.y, scaleX: 1.0, scaleY: 1.0 };
  const overTransform: Transform = { x: -delta.x, y: delta.y, scaleX: 1.0, scaleY: 1.0 };

  if (!atSameDepth) {
    // Construct the new state object
    const newDraggingState: DraggingColumnsState = {
      active: {
        ids: draggingColumns.active.ids,
        transform: activeTransform,
      },
      over: {
        ids: [],
        transform: null,
      },
    };

    setDraggingColumns(newDraggingState);
  } else if (atSameDepth && bothParents) {
    // Construct the new state object
    const newDraggingState: DraggingColumnsState = {
      active: {
        ids: draggingColumns.active.ids,
        transform: activeTransform,
      },
      over: {
        ids: over?.data.current?.group,
        transform: overTransform,
      },
    };

    // Update the state
    setDraggingColumns(newDraggingState);
  }
}

/* 
  Updates column orders and grouping when dropping a column/column group on top of another
*/
export function handleDragEnd(
  event: DragEndEvent,
  columnOrder: string[],
  setColumnOrder: (columnOrder: string[]) => void,
  grouping: GroupingState,
  setGrouping: (grouping: string[]) => void,
  setDraggingColumns: (draggingColumns: DraggingColumnsState) => void,
  columns: Column<any, unknown>[]
) {
  const { active, over } = event;

  // Reset draggingColumns state
  setDraggingColumns({
    active: { ids: [], transform: null },
    over: { ids: [], transform: null },
  });

  if (active && over && active.id !== over.id) {
    const activeColumn = columns.find((column) => column.id === active.id);
    const overColumn = columns.find((column) => column.id === over.id);
    const atSameDepth =
      activeColumn?.columnDef.meta?.renderedDepth === overColumn?.columnDef.meta?.renderedDepth;

    if (!activeColumn || !overColumn || !atSameDepth) return;

    // Cancel if moving params to entries or vice-versa
    if (activeColumn?.parent?.id !== overColumn?.parent?.id) {
      return;
    }

    // Get all IDs for the active column group (parent and its children)
    const activeGroupIDs = active.data.current?.group ?? getColumnGroupIDs(activeColumn);

    // Get all IDs for the over column group
    const overGroupIDs = over.data.current?.group ?? getColumnGroupIDs(overColumn);

    // Find the positions in the current columnOrder
    const oldIndex = columnOrder.findIndex((id) => id === activeGroupIDs[0]);
    const newIndex = columnOrder.findIndex((id) => id === overGroupIDs[0]);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
      return;
    }

    // Update columns order, ensuring parent and child columns are moved together
    const newOrder = moveGroupInColumnOrder(columnOrder, activeGroupIDs, overGroupIDs);
    setColumnOrder(newOrder);

    // Update grouping order if both columns are grouped
    if (grouping.includes(over.id as string) && grouping.includes(active.id as string)) {
      const activeGroupIndex = grouping.indexOf(active.id as string);
      const overGroupIndex = grouping.indexOf(over.id as string);
      if (overGroupIndex < activeGroupIndex) {
        const newGrouping = arrayMove(grouping, overGroupIndex, activeGroupIndex);
        setGrouping(newGrouping);
      }
    }
  }
}

export function handleDragCancel(
  setDraggingColumns: (draggingColumns: DraggingColumnsState) => void
) {
  // Reset draggingColumns state
  setDraggingColumns({
    active: { ids: [], transform: null },
    over: { ids: [], transform: null },
  });
}

/*
  Helper to get all IDs in a column group (parent and children)
*/
export function getColumnGroupIDs(column: Column<any, unknown>): string[] {
  if (column.columnDef.meta?.isParent) {
    // Include the parent and recursively flatten child columns
    return [column.id, ...column.columns.flatMap(getColumnGroupIDs)];
  }
  return [column.id as string];
}

/*
  Helper to move a group of columns in the columnOrder by inserting at target position
*/
export function moveGroupInColumnOrder(
  columnOrder: string[],
  activeGroupIDs: string[],
  overGroupIDs: string[],
  insertRightAfterOver: boolean = false // Whether to insert the activeGroupIDs right after the overGroupIDs
): string[] {
  // Create a copy of the column order
  const result = [...columnOrder];

  // Find the start indices of both groups
  const activeStartIndex = result.findIndex((id) => id === activeGroupIDs[0]);
  const overStartIndex = result.findIndex((id) => id === overGroupIDs[0]);

  // Remove the active group
  const activeLength = activeGroupIDs.length;
  const overLength = overGroupIDs.length;
  const removed = result.splice(activeStartIndex, activeLength);

  // Calculate the insertion index
  let insertionIndex = overStartIndex;

  // If active group was before the over group, adjust the insertion index
  if (activeStartIndex < overStartIndex) {
    insertionIndex = overStartIndex - activeLength + overLength;
  }
  // If we want to insert the active group right after the over group (for column show)
  else if (insertRightAfterOver) {
    insertionIndex = overStartIndex + overLength;
  }

  // Insert the active group at the calculated position
  result.splice(insertionIndex, 0, ...removed);

  return result;
}

/* 
  Computes reduction metrics for a given column
*/
export function columnStatistic(columnID: string, metric: string, data: LogItemProps[]) {
  const originalID = columnID.replace('entries_', '').replace('params_', '');
  const santizedID = sanitizeId(originalID);
  const values = data.map((entries) =>
    toComputableValue(entries[santizedID as keyof typeof entries])
  );
  return computeStatistic(metric, values);
}

/* 
  Convert a numeric value to a color between red and green. Used for coloring numeric columns by descending or ascending order 
*/
export function mapValueToRangeGradient(
  minValue: number,
  maxValue: number,
  valueToMap: number,
  reverseGradient: boolean
) {
  const normalizedValue = (valueToMap - minValue) / (maxValue - minValue);
  const gradientStartColor = reverseGradient ? [255, 0, 0] : [0, 255, 0]; // red or green
  const gradientEndColor = reverseGradient ? [0, 255, 0] : [255, 0, 0]; // green or red

  const r = Math.round(
    gradientStartColor[0] + (gradientEndColor[0] - gradientStartColor[0]) * normalizedValue
  );
  const g = Math.round(
    gradientStartColor[1] + (gradientEndColor[1] - gradientStartColor[1]) * normalizedValue
  );
  const b = Math.round(
    gradientStartColor[2] + (gradientEndColor[2] - gradientStartColor[2]) * normalizedValue
  );

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${Math.floor(
    0.5 * 255
  )
    .toString(16)
    .padStart(2, '0')}`;
}

/* 
	Find the most recurring data type in an array of types. Used to determine the nature of the column reduction metric
*/
export function dominantType(arr: string[]): string {
  // Assuming number values by default
  if (arr.length === 0) return 'number';

  const frequencyMap: { [key: string]: number } = {};
  arr.forEach((value) => {
    frequencyMap[value] = (frequencyMap[value] || 0) + 1;
  });

  let maxFrequency = 0;
  let mostRecurringValue: string = 'number';

  Object.keys(frequencyMap).forEach((key) => {
    if (frequencyMap[key] > maxFrequency) {
      maxFrequency = frequencyMap[key];
      mostRecurringValue = key;
    }
  });

  return mostRecurringValue;
}

/* 
  Build a directory tree from an array of nested log keys. Used to determine the structure of the table headers
*/
export function buildTree(properties: string[]): HeaderNode[] {
  // Initialize a root map to hold the top-level nodes
  const rootMap: { [key: string]: HeaderNode } = {};

  // Build the tree structure
  for (const path of properties) {
    // Split the path into its components
    const parts = path.split('/');

    let currentMap = rootMap;
    let currentPath = '';
    let currentNode: HeaderNode | undefined;

    // Traverse or build the nodes corresponding to each part of the path
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!currentMap[part]) {
        // Create a new node if it doesn't exist
        const node: HeaderNode = {
          name: part,
          path: currentPath,
        };
        currentMap[part] = node;
      }

      currentNode = currentMap[part];

      if (!currentNode.childMap) {
        currentNode.childMap = {};
      }

      // Move to the next level in the tree
      currentMap = currentNode.childMap;
    }

    // Mark the last node as a leaf node
    if (currentNode) {
      currentNode.isLeaf = true;
    }
  }

  // Function to recursively build the 'nodes' arrays from 'childMap'
  function buildNodes(nodeMap: { [key: string]: HeaderNode }): HeaderNode[] {
    const nodes: HeaderNode[] = [];
    for (const key in nodeMap) {
      const node = nodeMap[key];

      // Process child nodes recursively
      if (node.childMap && Object.keys(node.childMap).length > 0) {
        node.nodes = buildNodes(node.childMap);
      }

      // Include the node itself in 'nodes' if it's both a leaf and has child nodes
      if (node.isLeaf && node.nodes && node.nodes.length > 0) {
        node.nodes.push({
          name: node.name,
          path: node.path,
        });
      }

      // Clean up the node by removing 'childMap' and 'isLeaf'
      delete node.childMap;
      delete node.isLeaf;

      // Add the node to the array of nodes
      nodes.push(node);
    }
    return nodes;
  }

  // Build and return the final tree structure
  return buildNodes(rootMap);
}

/* 
  Find the params value corresponding to a given key. Used to display the params values in the table
*/
export function extractParamsValues(entriesParams: LogItemProps, params: LogItemProps) {
  const newEntriesParams: LogItemProps = {};
  Object.entries(entriesParams).map(([key, value]) => (newEntriesParams[key] = params[key][value]));
  return newEntriesParams;
}

/**
 * Format a single cell value based on the dataType.
 * Return a ReactNode (JSX or string).
 */
export function formatCellValue(
  rawValue: unknown,
  dataType: string,
  columnWidth?: number,
  excludeUndefined: boolean = false,
  excludeNulls: boolean = false
): React.ReactNode {
  // Calculate truncation dynamically based on column width
  const AVERAGE_CHAR_WIDTH_PX = 6; // Approximate pixels per character
  const CELL_PADDING_PX = 16; // Approximate total horizontal padding (e.g., 8px left + 8px right)
  const MIN_CHARS = 5; // Minimum characters to show even if column is very narrow
  const DEFAULT_MAX_CHARS = 50; // Default max characters if width is not available or calculation fails
  let maxChars = DEFAULT_MAX_CHARS;
  if (columnWidth && columnWidth > CELL_PADDING_PX) {
    const availableWidth = columnWidth - CELL_PADDING_PX;
    const calculatedChars = Math.floor(availableWidth / AVERAGE_CHAR_WIDTH_PX);
    // Ensure calculated chars are within reasonable bounds
    maxChars = Math.max(MIN_CHARS, calculatedChars);
  } else if (columnWidth && columnWidth <= CELL_PADDING_PX) {
    // If column is narrower than padding, show minimum chars
    maxChars = MIN_CHARS;
  }

  // If cellValue is undefined or null, handle that up front
  if (rawValue === undefined) {
    if (excludeUndefined) {
      return null;
    }
    return ' ';
  }
  if (rawValue === null) {
    if (excludeNulls) {
      return null;
    }
    return '-';
  }

  switch (dataType) {
    case 'image': {
      if (typeof rawValue === 'string') {
        let value = rawValue.trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          // Trim the outer quotes if they exist
          value = value.slice(1, -1);
        }
        return <ImageDisplay value={value} className="h-5 w-5 object-scale-down" />;
      }
      // If not a string, fallback
      return 'Invalid Image';
    }

    case 'audio': {
      if (typeof rawValue === 'string') {
        let value = rawValue.trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        // Use a compact audio player for the table cell
        return <AudioPlayer value={value} className="h-8" />;
      }
      return 'Invalid Audio';
    }
    case 'int':
    case 'float': {
      // Safely parse to float, if invalid or NaN display fallback
      const numericValue = parseFloat(String(rawValue));
      if (isNaN(numericValue)) {
        if (excludeNulls) {
          return null;
        }
        return '–';
      }
      return formatNumber(numericValue);
    }

    case 'timedelta': {
      try {
        const duration = timeDeltaValueToDuration(String(rawValue));
        const delta = durationToTimeDelta(duration);
        return delta;
      } catch (error) {
        console.error('Error formatting timedelta:', error);
        return String(rawValue);
      }
    }

    case 'timestamp':
    case 'time':
    case 'date':
    case 'str': {
      // For timestamps or generally string data, handle leading/trailing quotes
      let value = typeof rawValue === 'string' ? rawValue.trim() : String(rawValue);
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      if (value.length > maxChars) value = value.slice(0, maxChars) + '...';
      return value;
    }

    default: {
      // Fallback for unrecognized data types
      // If it's an object, try JSON stringify or just display as string
      if (typeof rawValue === 'object') {
        try {
          let value = JSON.stringify(rawValue);
          if (value.length > maxChars) value = value.slice(0, maxChars) + '...';
          return value;
        } catch {
          let value = String(rawValue);
          if (value.length > maxChars) value = value.slice(0, maxChars) + '...';
          return value;
        }
      }
      // If it's anything else, just convert to string
      let value = String(rawValue);
      if (value.length > maxChars) value = value.slice(0, maxChars) + '...';
      return value;
    }
  }
}

/* 
  Build column structure including handling nested column headers, and define cell content more robustly.
  This version gracefully handles:
    - Undefined values
    - Missing dataTypes
    - Unrecognized dataTypes
    - Safe checks before using string methods
 */
export const nestedColumns = (
  nodes: HeaderNode[],
  type: string,
  prependPath: string,
  params: LogItemProps,
  enableRowSpan: boolean = false,
  dataTypes: { [key: string]: string },
  fieldTypes: { [key: string]: string },
  columnContext?: string,
  fieldDescriptions: { [key: string]: { description?: string } } = {}
): ColumnDef<LogProps | GroupedLogProps>[] => {
  return nodes.map((node) => {
    // If this node has children (nested columns), recursively build columns
    if (node.nodes) {
      const columns = nestedColumns(
        node.nodes,
        type,
        prependPath,
        params,
        false,
        dataTypes,
        fieldTypes,
        columnContext,
        fieldDescriptions
      );
      return {
        id: `${prependPath}/${node.path}`, // needed for grouping, showing, hiding multiple column nests
        header: node.name,
        columns,
        meta: {
          columnType: type,
          enableRowSpan: enableRowSpan,
          isParent: true,
          renderedDepth: -1,
        },
      };
    }

    // Determine the dataType (default to 'str' if not found or unrecognized)
    const dataType = dataTypes[node.path] || 'str';
    const fieldType = fieldTypes[node.path] || 'entry';
    return {
      id: `${prependPath}/${node.path}`, // needed for grouping, showing, hiding multiple column nests
      accessorFn: (log, index) => {
        // If grouping, return the value from the log
        if ('groupingColumnId' in log) {
          return (log as GroupedLogProps)[(log as GroupedLogProps).groupingColumnId];
        }
        // Safely extract the value from either entries or params
        if (type === 'entries') {
          const value = (log as LogProps).entries?.[node.path];
          if (!value && columnContext) {
            return (log as LogProps).entries?.[processContext('merge', columnContext, node.path)];
          }
          return value;
        } else {
          // Params support removed - return undefined
          return undefined;
        }
      },
      sortDescFirst: true,
      filterFn: 'includesString',
      header: node.name,
      cell: ({ cell }: { cell: Cell<LogProps | GroupedLogProps, unknown> }) => {
        let cellValue = cell.getValue();
        const columnWidth = cell.column.getSize();

        // For grouped logs, if we haven't yet expanded a grouped row,
        // we haven't fetched any logs for that group yet, and so we
        // cannot display aggregated values. Thus, we simply display
        // nothing
        if (
          'groupingColumnId' in cell.row.original &&
          !cell.row.original.isPopulated &&
          cell.row.groupingColumnId !== cell.column.id
        ) {
          return null;
        }

        // Now call our utility for final formatting
        return formatCellValue(cellValue, dataType, columnWidth);
      },
      minSize: 80,
      meta: {
        dataType: dataType,
        fieldType: fieldType,
        columnType: type,
        enableRowSpan: enableRowSpan,
        isParent: false,
        renderedDepth: -1,
        description: fieldDescriptions[node.path]?.description || '',
      },
    };
  });
};

/* 
  Merges vertically adjacent table cells that have the same value
*/
export const mergeCells = (rows: Row<any>[]) => {
  rows.map((row: any, i: number, rows) => {
    const topRow: any = rows[i - 1];

    for (let j = 0; j < row.getVisibleCells().length; j++) {
      let cell = row.getVisibleCells()[j];

      if (
        !cell.column.columnDef.meta?.enableRowSpan ||
        !topRow ||
        topRow?.getIsGrouped() ||
        row?.getIsGrouped()
      ) {
        cell.rowSpan = 1;
        cell.isRowSpanned = false;
        continue;
      }

      const getMergeTopCell = (ri: number, ci: number): any => {
        const cell: any = (rows[ri] as any).getVisibleCells()[ci];

        const topRow: any = rows[ri - 1];
        const topCell: any = topRow?.getVisibleCells()[ci];

        if (
          !topRow ||
          topRow.getIsGrouped() ||
          JSON.stringify(topCell.getValue()) !== JSON.stringify(cell.getValue())
        ) {
          return cell;
        } else {
          return getMergeTopCell(ri - 1, ci);
        }
      };

      let topCell = topRow.getVisibleCells()[j];

      if (JSON.stringify(topCell.getValue()) === JSON.stringify(cell.getValue())) {
        getMergeTopCell(i, j).rowSpan += 1;
        cell.isRowSpanned = true;
      } else {
        cell.rowSpan = 1;
        cell.isRowSpanned = false;
      }
    }

    return null;
  });

  return rows;
};

/*
  Find the maximum depth in any branch of the column tree
*/
function findMaxDepth(columns: ColumnDef<LogProps | GroupedLogProps>[]): number {
  let maxDepth = 0;

  for (const column of columns) {
    const currentDepth = (column.id as string).split('/').length - 1;
    if ((column as any).columns?.length > 0) {
      const childMaxDepth = findMaxDepth((column as any).columns);
      maxDepth = Math.max(maxDepth, childMaxDepth);
    } else {
      maxDepth = Math.max(maxDepth, currentDepth);
    }
  }

  return maxDepth;
}

/*
  Find if a column has any leaf nodes as immediate children
*/
function hasImmediateLeafNodes(column: ColumnDef<LogProps | GroupedLogProps>): boolean {
  return (
    (column as any).columns?.some(
      (child: ColumnDef<LogProps | GroupedLogProps>) => !(child as any).columns?.length
    ) ?? false
  );
}

/*
  Main function to encode rendered depths for the column tree
*/
export function encodeRenderedDepth(
  columns: ColumnDef<LogProps | GroupedLogProps>[],
  defaultToDepthZeroTypes: string[]
): void {
  // First find the maximum depth in the entire tree
  const absoluteMaxDepth = findMaxDepth(columns);

  // Helper function to process each column
  function processColumn(column: ColumnDef<LogProps | GroupedLogProps>): void {
    // Handle defaultToDepthZeroTypes first
    if (column.meta?.columnType && defaultToDepthZeroTypes.includes(column.meta.columnType)) {
      column.meta.renderedDepth = 0;

      // Process children if any
      if ((column as any).columns?.length > 0) {
        (column as any).columns.forEach((childColumn: ColumnDef<LogProps | GroupedLogProps>) => {
          processColumn(childColumn);
        });
      }
      return;
    }

    // Calculate natural depth based on path segments
    const pathDepth = (column.id as string).split('/').length - 1;

    // For leaf nodes (no children)
    if (!(column as any).columns?.length) {
      column.meta!.renderedDepth = absoluteMaxDepth;
    }
    // For parent nodes
    else {
      // If this node has immediate leaf children, insert placeholders before them
      if (hasImmediateLeafNodes(column)) {
        column.meta!.renderedDepth = pathDepth;

        // Process children, ensuring leaves get max depth and others are processed normally
        (column as any).columns.forEach((childColumn: ColumnDef<LogProps | GroupedLogProps>) => {
          if (!(childColumn as any).columns?.length) {
            childColumn.meta!.renderedDepth = absoluteMaxDepth;
          } else {
            processColumn(childColumn);
          }
        });
      }
      // For other parent nodes, just use their natural path depth
      else {
        column.meta!.renderedDepth = pathDepth;

        // Process children normally
        (column as any).columns.forEach((childColumn: ColumnDef<LogProps | GroupedLogProps>) => {
          processColumn(childColumn);
        });
      }
    }
  }

  // Process all columns
  columns.forEach(processColumn);
}

// Helper function to validate the results (useful for debugging)
export function validateRuntimeColumns(columns: any[], indent = ''): void {
  columns.forEach((column) => {
    console.log(`${indent}Column ID: ${column.columnDef.id}`);
    console.log(`${indent}Actual Depth: ${column.columnDef.depth}`);
    console.log(`${indent}Rendered Depth: ${column.columnDef.meta?.renderedDepth}`);
    console.log(`${indent}Is Parent: ${column.columnDef.meta?.isParent}`);
    console.log(`${indent}Column Type: ${column.columnDef.meta?.columnType}`);
    console.log(`${indent}Has Children: ${!!(column.columns && column.columns.length)}`);
    console.log(`${indent}---`);

    if (column.columns && column.columns.length > 0) {
      validateRuntimeColumns(column.columns, indent + '  ');
    }
  });
}

export function getCoreRowModel<TData extends RowData>(): (
  table: Table<TData>
) => () => RowModel<TData> {
  return (table) =>
    memo(
      () => [table.options.data],
      (
        data
      ): {
        rows: Row<TData>[];
        flatRows: Row<TData>[];
        rowsById: Record<string, Row<TData>>;
      } => {
        const rowModel: RowModel<TData> = {
          rows: [],
          flatRows: [],
          rowsById: {},
        };

        const accessRows = (
          originalRows: TData[],
          depth = 0,
          parentRow?: Row<TData>
        ): Row<TData>[] => {
          const rows = [] as Row<TData>[];

          for (let i = 0; i < originalRows.length; i++) {
            // This could be an expensive check at scale, so we should move it somewhere else, but where?
            // if (!id) {
            //   if (process.env.NODE_ENV !== 'production') {
            //     throw new Error(`getRowId expected an ID, but got ${id}`)
            //   }
            // }

            // Make the row
            const row = createRow(
              table,
              table._getRowId(originalRows[i]!, i, parentRow),
              originalRows[i]!,
              i,
              depth,
              undefined,
              parentRow?.id
            );

            // Add necessary props to support manual server-side grouping
            row.groupingColumnId = (originalRows[i] as any).groupingColumnId;
            row.groupingValue = (originalRows[i] as any)[row.groupingColumnId];
            row.groupingIndex = (originalRows[i] as any).groupingIndex;

            // Calculate effective index based on offset information
            const offsetInfo = table.options.meta?.offsetInfo;
            if (offsetInfo) {
              if (depth === 0) {
                // Top-level row: use global offset
                row.effectiveIndex = offsetInfo.globalOffset + i;
              } else if (parentRow) {
                // SubRow: try to find group-specific offset
                let groupOffset = 0;

                // Try to find offset for this specific group
                // We need to build the groupId path from the row hierarchy
                const buildGroupId = (currentRow: any): string => {
                  if (!currentRow.groupingColumnId || !currentRow.groupingValue) {
                    return '';
                  }
                  const currentGroup = `${currentRow.groupingColumnId}:${currentRow.groupingValue}`;
                  if (currentRow.parent) {
                    const parentGroupId = buildGroupId(currentRow.parent);
                    return parentGroupId ? `${parentGroupId}>${currentGroup}` : currentGroup;
                  }
                  return currentGroup;
                };

                const groupId = buildGroupId(parentRow);
                if (groupId && offsetInfo.groupOffsets.has(groupId)) {
                  groupOffset = offsetInfo.groupOffsets.get(groupId) || 0;
                }

                row.effectiveIndex = groupOffset + i;
              } else {
                // Fallback to array index
                row.effectiveIndex = i;
              }
            } else {
              // No offset info, use array index
              row.effectiveIndex = i;
            }

            // Keep track of every row in a flat array
            rowModel.flatRows.push(row);
            // Also keep track of every row by its ID
            rowModel.rowsById[row.id] = row;
            // Push table row into parent
            rows.push(row);

            // Get the original subrows
            if (table.options.getSubRows) {
              row.originalSubRows = table.options.getSubRows(originalRows[i]!, i);

              // Then recursively access them
              if (row.originalSubRows?.length) {
                row.subRows = accessRows(row.originalSubRows, depth + 1, row);
              }
            }
          }

          return rows;
        };

        rowModel.rows = accessRows(data);

        return rowModel;
      },
      getMemoOptions(table.options, 'debugTable', 'getRowModel', () => table._autoResetPageIndex())
    );
}

// Helper function to horizontally merge placeholder headers in a given header group
export const mergeHeadersHorizontally = (headerGroup: HeaderGroup<any | unknown>) => {
  const mergedHeaders: Header<any, unknown>[] = [];
  const headersToSkip = new Set<string>(); // Store IDs of headers to skip

  for (let i = 0; i < headerGroup.headers.length; i++) {
    const currentHeader = headerGroup.headers[i];

    if (headersToSkip.has(currentHeader.id)) {
      continue; // Skip this header as it's merged into a previous one
    }

    let effectiveColSpan = currentHeader.colSpan; // Start with original colSpan

    // Check for horizontal merge condition (only for placeholders, excluding RowNumbering)
    if (currentHeader.isPlaceholder && !currentHeader.id.includes('RowNumbering')) {
      // Look ahead to the next headers in the same row
      for (let j = i + 1; j < headerGroup.headers.length; j++) {
        const nextHeader = headerGroup.headers[j];

        // Condition: next header is also a placeholder and not RowNumbering
        if (nextHeader.isPlaceholder && !nextHeader.id.includes('RowNumbering')) {
          // Check if they are truly adjacent visually. This is tricky without layout info.
          // Let's assume the array order implies visual adjacency for placeholders generated by Tanstack.
          // If this assumption breaks, a more complex check involving column start/size might be needed.

          effectiveColSpan += nextHeader.colSpan; // Add the next header's span
          headersToSkip.add(nextHeader.id); // Mark the next header to be skipped
        } else {
          break; // Stop merging if the next header doesn't meet the criteria
        }
      }
    }

    // Create a new header object or modify the existing one with the effective colSpan
    // Cloning is safer to avoid potential side effects if the original header object is used elsewhere
    const headerToRender = {
      ...currentHeader,
      colSpan: effectiveColSpan,
    };

    mergedHeaders.push(headerToRender as Header<any, unknown>);
  }
  return mergedHeaders;
};

// Helper to find the *instance* of the header visually above the current one
export const findParentHeaderInstance = (
  header: Header<any, unknown>,
  table: Table<any>,
  currentGroupIndex: number
): Header<any, unknown> | undefined => {
  const parentGroupIndex = currentGroupIndex - 1;
  if (parentGroupIndex < 0) return undefined; // No parent row

  const headerGroups = table.getHeaderGroups();
  if (parentGroupIndex >= headerGroups.length) {
    console.warn(
      `Parent group index ${parentGroupIndex} is out of bounds for header groups (length ${headerGroups.length})`
    );
    return undefined;
  }
  const parentHeaderGroup = headerGroups[parentGroupIndex]; // Get the correct parent group by index
  if (!parentHeaderGroup) {
    console.warn(
      `Could not find parent header group at index ${parentGroupIndex} for header ${header.id}`
    );
    return undefined;
  }

  const targetParentColumnId = header.column.parent?.id;
  if (!targetParentColumnId) {
    // Legitimate case for placeholders of root columns in rows > 0
    return undefined;
  }

  // Find the header in the *correct parent group* whose column ID matches
  const parentHeader = parentHeaderGroup.headers.find((h) => h.column.id === targetParentColumnId);

  if (!parentHeader) {
    return undefined;
  }

  if (parentHeader.isPlaceholder) {
    return undefined;
  }

  return parentHeader;
};

// Helper to find the header visually below the current one in the *next* row
export const findHeaderBelowInNextRow = (
  header: Header<any, unknown>,
  table: Table<any>,
  currentGroupIndex: number
): Header<any, unknown> | undefined => {
  const nextGroupIndex = currentGroupIndex + 1;
  const headerGroups = table.getHeaderGroups();

  if (nextGroupIndex >= headerGroups.length) {
    // console.log(`[findHeaderBelow] No row below ${header.id} (depth ${header.depth})`);
    return undefined;
  }

  const nextHeaderGroup = headerGroups[nextGroupIndex];
  if (!nextHeaderGroup) {
    // console.log(`[findHeaderBelow] Could not find next header group for ${header.id} (depth ${header.depth})`);
    return undefined;
  }

  // Find a header in the next row with the same column ID and depth
  const headerBelow = nextHeaderGroup.headers.find(
    (h) => h.column.id === header.column.id && h.depth === header.depth + 1
  );

  // console.log(`[findHeaderBelow] For ${header.id} (depth ${header.depth}), found below: ${headerBelow?.id} (depth ${headerBelow?.depth})`);
  return headerBelow;
};

// Helper to find the header visually *above* the current one in the *previous* row
export const findHeaderAboveInPrevRow = (
  header: Header<any, unknown>,
  table: Table<any>,
  currentGroupIndex: number
): Header<any, unknown> | undefined => {
  const prevGroupIndex = currentGroupIndex - 1;
  if (prevGroupIndex < 0) {
    // console.log(`[findHeaderAbove] No row above ${header.id} (depth ${header.depth})`);
    return undefined;
  }

  const headerGroups = table.getHeaderGroups();
  const prevHeaderGroup = headerGroups[prevGroupIndex];
  if (!prevHeaderGroup) {
    // console.log(`[findHeaderAbove] Could not find previous header group for ${header.id} (depth ${header.depth})`);
    return undefined;
  }

  // Find based on column ID and depth
  const headerAbove = prevHeaderGroup.headers.find(
    (h) => h.column.id === header.column.id && h.depth === header.depth - 1
  );

  // console.log(`[findHeaderAbove] For ${header.id} (depth ${header.depth}), found above: ${headerAbove?.id} (depth ${headerAbove?.depth})`);
  return headerAbove;
};

// Helper to determine if a header should span vertically, and how many rows
// Returns the calculated rowspan (1 if no span)
export const calculateRowSpan = (
  header: Header<any, unknown>,
  table: Table<any>,
  currentGroupIndex: number // Keep headerGroupIndex
): number => {
  const totalHeaderRows = table.getHeaderGroups().length;
  // console.log(`[calculateRowSpan] Checking ${header.id}, depth: ${header.depth}, index: ${currentGroupIndex}, isPlaceholder: ${header.isPlaceholder}`);

  // --- Logic for Placeholders ---
  if (header.isPlaceholder) {
    let span = 1;
    let current = header;
    let groupIdx = currentGroupIndex;
    while (true) {
      const nextHeader = findHeaderBelowInNextRow(current, table, groupIdx);
      // Check if header below exists, is a placeholder, and crucially, shares the same base column ID
      if (nextHeader && nextHeader.isPlaceholder && nextHeader.column.id === header.column.id) {
        // console.log(`[calculateRowSpan] Placeholder ${header.id} found matching placeholder below: ${nextHeader.id}. Incrementing span.`);
        span++;
        current = nextHeader; // Continue checking from the one below
        groupIdx++;
      } else {
        // console.log(`[calculateRowSpan] Placeholder ${header.id} loop end. Below: ${nextHeader?.id}, isPlaceholder: ${nextHeader?.isPlaceholder}, matchID: ${nextHeader?.column.id === header.column.id}`);
        break; // Stop if no matching placeholder below
      }
    }
    // console.log(`[calculateRowSpan] Placeholder ${header.id} at depth ${header.depth} FINAL calculated span: ${span}`);
    return span;
  }

  // --- Logic for Non-Placeholders ---
  const nextDepth = header.depth + 1;
  if (nextDepth >= totalHeaderRows) {
    // console.log(`[calculateRowSpan] Non-placeholder ${header.id} at max depth. Span: 1`);
    return 1; // Can't span if already in the last potential row
  }

  const subHeadersInNextRow = header.subHeaders?.filter((sub) => sub.depth === nextDepth);

  if (!subHeadersInNextRow || subHeadersInNextRow.length === 0) {
    const span = totalHeaderRows - header.depth;
    // console.log(`[calculateRowSpan] Non-placeholder leaf ${header.id}. Span to bottom: ${span}`);
    return span; // Leaf node relative to header rows below it. Span the remaining rows.
  }

  const allSubHeadersArePlaceholders = subHeadersInNextRow.every((sub) => sub.isPlaceholder);

  if (allSubHeadersArePlaceholders) {
    let minContentDepth = totalHeaderRows;
    const findMinDepth = (currentHeader: Header<any, unknown>) => {
      // Base case 1: Found non-placeholder content
      if (!currentHeader.isPlaceholder) {
        minContentDepth = Math.min(minContentDepth, currentHeader.depth);
        return;
      }
      // Base case 2: Reached max depth without finding content (shouldn't happen if called correctly)
      if (currentHeader.depth >= totalHeaderRows - 1) {
        return;
      }
      // Recursive step: Explore children if they exist
      if (currentHeader.subHeaders && currentHeader.subHeaders.length > 0) {
        // Only check children at the *next* depth level
        const childrenInNextDepth = currentHeader.subHeaders.filter(
          (sub) => sub.depth === currentHeader.depth + 1
        );
        for (const sub of childrenInNextDepth) {
          // Optimization: Don't explore branches already deeper than the best found depth
          if (sub.depth < minContentDepth) {
            findMinDepth(sub);
          }
        }
      }
    };

    // Start search from placeholder children in the next row
    subHeadersInNextRow.forEach(findMinDepth);

    const span = minContentDepth - header.depth;
    const finalSpan = Math.max(1, span); // Ensure rowspan is at least 1
    // console.log(`[calculateRowSpan] Non-placeholder ${header.id} with placeholder children. Min content depth: ${minContentDepth}. Calculated span: ${finalSpan}`);
    return finalSpan;
  } else {
    // Has non-placeholder children in the next row, so no vertical span.
    // console.log(`[calculateRowSpan] Non-placeholder ${header.id} with non-placeholder children. Span: 1`);
    return 1;
  }
};

// Helper function to determine if a header should be rendered or not
export const shouldRenderHeader = (
  header: Header<any, unknown>,
  table: Table<any | unknown>,
  groupIndex: number
) => {
  // console.log(`[shouldRenderHeader] Checking ${header.id}, depth: ${header.depth}, index: ${groupIndex}, isPlaceholder: ${header.isPlaceholder}`);

  // Check 1: Is it spanned by a non-placeholder parent? (Existing logic)
  // Note: findParentHeaderInstance correctly looks for the *column's* parent, not visual parent
  const parentColumnHeader = header.column.parent
    ? table
        .getHeaderGroups()
        [
          groupIndex - 1
        ]?.headers.find((h) => h.column.id === header.column.parent?.id && !h.isPlaceholder)
    : undefined;

  if (parentColumnHeader) {
    // Only proceed if a non-placeholder column parent exists in the row above
    const parentCalculatedRowSpan = calculateRowSpan(parentColumnHeader, table, groupIndex - 1); // Pass parent's groupIndex
    // Should hide if this header's depth is strictly within the parent's span range
    if (
      header.depth > parentColumnHeader.depth &&
      header.depth < parentColumnHeader.depth + parentCalculatedRowSpan
    ) {
      // console.log(`[shouldRenderHeader] Hiding ${header.id} because parent ${parentColumnHeader.id} spans ${parentCalculatedRowSpan}`);
      return false; // Parent spans over this header
    }
  }

  // Check 2: Is it a placeholder spanned by a placeholder *directly* above?
  if (header.isPlaceholder && groupIndex > 0) {
    const headerAbove = findHeaderAboveInPrevRow(header, table, groupIndex);

    // Check if there IS a header directly above, it's a placeholder, AND it matches the column ID
    if (headerAbove && headerAbove.isPlaceholder && headerAbove.column.id === header.column.id) {
      // Calculate the span of the header ABOVE using the (now iterative) method
      const aboveCalculatedRowSpan = calculateRowSpan(headerAbove, table, groupIndex - 1);

      // If the header directly above spans more than 1 row (meaning it spans downwards to cover this position)
      if (aboveCalculatedRowSpan > 1) {
        // console.log(`[shouldRenderHeader] Hiding ${header.id} because placeholder above (${headerAbove.id}) spans ${aboveCalculatedRowSpan}`);
        return false; // Placeholder above spans over this one
      }
    }
  }

  // If neither check hides it, render it.
  // console.log(`[shouldRenderHeader] Rendering ${header.id}`);
  return true;
};

export function isHiddenByDefault(
  id: string,
  projectId?: string,
  context?: string | null
): boolean {
  // Check if any path segment starts with underscore
  const hasUnderscorePrefix = id.split('/').some((segment) => segment.startsWith('_'));

  if (!hasUnderscorePrefix) {
    return false; // Not underscore-prefixed, don't hide
  }

  // Exception: Assistants project with "All" in context - keep _assistant and _user visible
  if (projectId === 'Assistants' && context?.includes('All')) {
    const columnName = id.split('/').pop(); // Get the last segment
    if (columnName === '_assistant' || columnName === '_user') {
      return false; // Don't hide _assistant or _user columns
    }
  }

  return true; // Hide all other underscore-prefixed columns
}
