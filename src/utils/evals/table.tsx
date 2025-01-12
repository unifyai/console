import { CSSProperties, Dispatch, SetStateAction, MouseEvent } from "react";
import { Column, Row, Cell, ColumnDef, GroupingState, FilterFnOption, RowSelectionState } from "@tanstack/react-table";
import { type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import _ from "lodash";

import { toComputableValue, computeStatistic } from "./common";
import { LogProps, LogsResponseProps, LogItemProps, HeaderNode } from "@/types/evals/logs";
import { SetStateProps, StateProps } from "@/types/dataTable";
import { Table } from "@tanstack/react-table";

import { ImageDisplay, isImage } from "./selection";
import { formatNumber } from "../formatNumber";
import { sanitizeId } from "./columnOperations";

/* 
	Updates column orders and grouping when dropping a column on top of another
*/
export function handleDragEnd(
  event: DragEndEvent,
  columnOrder: string[],
  setColumnOrder: (columnOrder: string[]) => void,
  grouping: GroupingState,
  setGrouping: (grouping: string[]) => void,
  columns: Column<any, unknown>[]
) {
	const { active, over } = event;
	if (active && over && active.id !== over.id) {

		const activeColumn = columns.find(column => column.id === active.id);
		const overColumn = columns.find(column => column.id === over.id);

		if (!activeColumn || !overColumn) return;

		// Cancel if moving params to entries or vice-versa
		if (activeColumn?.parent?.id !== overColumn?.parent?.id) {
			return;
		}

			// Get all IDs for the active column group (parent and its children)
			const activeGroupIDs = getColumnGroupIDs(activeColumn);

			// Get all IDs for the over column group
			const overGroupIDs = getColumnGroupIDs(overColumn);

			// Find the positions in the current columnOrder
			const oldIndex = columnOrder.findIndex(id => id === activeGroupIDs[0]);
			const newIndex = columnOrder.findIndex(id => id === overGroupIDs[0]);

			if (oldIndex === -1 || newIndex === -1) {
				return;
			}

			// Update columns order, ensuring parent and child columns are moved together
			const newOrder = moveGroupInColumnOrder(columnOrder, activeGroupIDs, newIndex);
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

/*
  Helper to get all IDs in a column group (parent and children)
*/
function getColumnGroupIDs(column: Column<any, unknown>): string[] {
	if (column.columnDef.meta?.isParent) {
		// Include the parent and recursively flatten child columns
		return [column.id, ...column.columns.flatMap(getColumnGroupIDs)];
	}
	return [column.id as string];
}

/*
  Helper to move a group of columns in the columnOrder
*/
function moveGroupInColumnOrder(
	columnOrder: string[],
	groupIDs: string[],
	newIndex: number
): string[] {
	// Create a new column order, excluding the group being moved
	const filteredOrder = columnOrder.filter(id => !groupIDs.includes(id));

	// Ensure the new index respects the reduced order
	const safeNewIndex = Math.max(0, Math.min(filteredOrder.length, newIndex));

	// Insert the group at the new index
	const result = [...filteredOrder];
	result.splice(safeNewIndex, 0, ...groupIDs);
	return result;
}

/* 
  Computes reduction metrics for a given column
*/
export function columnStatistic(columnID: string, metric: string, data: LogItemProps[]) {
	const originalID = columnID.replace("entries_", "").replace("params_", "");
	const santizedID = sanitizeId(originalID);
	const values = data.map((entries) => toComputableValue(entries[santizedID as keyof typeof entries]));
  return computeStatistic(metric, values);
}

/* 
  Convert a numeric value to a color between red and green. Used for coloring numeric columns by descending or ascending order 
*/
export function mapValueToRangeGradient(minValue: number, maxValue: number, valueToMap: number, reverseGradient: boolean) {
	const normalizedValue = (valueToMap - minValue) / (maxValue - minValue);
	const gradientStartColor = reverseGradient ? [255, 0, 0] : [0, 255, 0]; // red or green
	const gradientEndColor = reverseGradient ? [0, 255, 0] : [255, 0, 0]; // green or red

	const r = Math.round(gradientStartColor[0] + (gradientEndColor[0] - gradientStartColor[0]) * normalizedValue);
	const g = Math.round(gradientStartColor[1] + (gradientEndColor[1] - gradientStartColor[1]) * normalizedValue);
	const b = Math.round(gradientStartColor[2] + (gradientEndColor[2] - gradientStartColor[2]) * normalizedValue);

	return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}${Math.floor(0.5 * 255).toString(16).padStart(2, "0")}`;
}

/* 
	Find the most recurring data type in an array of types. Used to determine the nature of the column reduction metric
*/
export function dominantType(arr: string[]): string {

	// Assuming number values by default
	if (arr.length === 0) return "number";

	const frequencyMap: { [key: string]: number } = {};
	arr.forEach((value) => { frequencyMap[value] = (frequencyMap[value] || 0) + 1; });

	let maxFrequency = 0;
	let mostRecurringValue: string = "number";

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
		const parts = path.split("/");

		let currentMap = rootMap;
		let currentPath = "";
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
	Object.entries(entriesParams).map(([key, value]) =>
		newEntriesParams[key] = params[key][value]
	);
	return newEntriesParams;
}

/* 
  Build column structure including handling nested column headers, and define cell content.
*/
export const nestedColumns = (
  nodes: HeaderNode[], 
  type: string,
  prependPath: string,
  data: LogsResponseProps,
  enableRowSpan: boolean = false,
  dataTypes: {[key: string] : string}
) : ColumnDef<LogProps>[] => {
  return nodes.map(node => {
      if (node.nodes) {
          const columns = nestedColumns(node.nodes, type, prependPath, data, false, dataTypes);
          return {
              id: `${prependPath}/${node.path}`,  // Needed for grouping, showing, hiding multiple column nests,
              header: node.name, 
              columns: columns,
              meta: {
                  columnType: type,
                  enableRowSpan: enableRowSpan,
				  isParent: true,
				  renderedDepth: -1,  // Needed for grouping, showing, hiding multiple column nests
              }
          };
      }
      return {
          id: `${prependPath}/${node.path}`,  // Needed for grouping, showing, hiding multiple column nests,
          accessorFn: (log) => type === "entries" ? log.entries[node.path] : log.params[node.path],
          filterFn: "includesString" as FilterFnOption<LogProps> | undefined,
          header: node.name,
          cell: ({ cell }: {cell: Cell<LogProps, unknown>}) => {
            let cellValue = cell.getValue();
            if (type === "params") cellValue = data.params[node.path][cellValue as string];
            if (isImage(cellValue)) return <ImageDisplay value={cellValue as string} className="object-scale-down h-5 w-5"/>
            if (typeof cellValue === "number") return formatNumber(cellValue);
            const displayValue = cellValue != undefined ? JSON.stringify(cellValue).trimStart().replace(/^"|"$/g, '') : "";
            return displayValue;
          },
          meta: {
              dataType: dataTypes[node.path],
              columnType: type,
              enableRowSpan: enableRowSpan,
			  isParent: false,
			  renderedDepth: -1,  // Needed for grouping, showing, hiding multiple column nests
          }
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

      if (
        JSON.stringify(topCell.getValue()) === JSON.stringify(cell.getValue())
      ) {
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
  Helper function to calculate max depth of the column tree
*/
function calculateMaxDepth(
	columns: ColumnDef<LogProps>[],
	currentDepth = 0,
	visited = new Set<ColumnDef<LogProps>>()
): number {
	return columns.reduce((maxDepth, column) => {
		if (visited.has(column)) {
			return maxDepth;
		}
  
		// Mark the column as visited
		visited.add(column);
	
		if (column.meta?.isParent) {
			// Recursively calculate depth for child columns
			const childColumns = (column as any).columns || [];
			const childMaxDepth = calculateMaxDepth(childColumns, currentDepth + 1, visited);
			return Math.max(maxDepth, childMaxDepth);
		}
  
		// Leaf columns
		return Math.max(maxDepth, currentDepth);
	}, currentDepth);
}

/* 
  Process columns to encode rendered depth into their meta objects.
*/
export function processColumnsForRenderedDepth(
    columns: ColumnDef<LogProps>[],
    defaultToDepthZeroTypes: string[],
    initialDepth: number
): number {
	let returningDepth = 0;
    columns.forEach((column) => {

        // Case 0: Avoid re-processing columns
        if (column.meta?.renderedDepth !== -1) {
			return;
        }

		// Case 1: Parent columns: Go deeper into the nest if possible
		else if (column.meta?.isParent){
            // Process child columns first
			const childColumns = (column as any).columns || [];
            const runningDepth = processColumnsForRenderedDepth(childColumns, defaultToDepthZeroTypes, initialDepth) - 1;

			// Case 1a: Top-level columns (defaultToDepthZeroType)
			if (column.meta.columnType && defaultToDepthZeroTypes.includes(column.meta.columnType)) {
				column.meta.renderedDepth = 0;
			}
			// Case 1b: Not top-level parent columns, assign runningDepth
			else {
				column.meta.renderedDepth = runningDepth;
				returningDepth = runningDepth;
			}
        }
		// Case 2: Leaf columns
        else if (!column.meta?.isParent) {
			// Case 2a: Top-level columns with no children (defaultToDepthZeroType)
			if (column.meta.columnType && defaultToDepthZeroTypes.includes(column.meta?.columnType)) {
				column.meta.renderedDepth = 0;
			}
			// Case 2b: Absolute leaf columns
			else {
				column.meta.renderedDepth = initialDepth;
				returningDepth = initialDepth;
			}
        }
    });
	return returningDepth;
}


/* 
  Calculate and encode rendered depth for the column tree.
*/
export function encodeRenderedDepth(
    columns: ColumnDef<LogProps>[],
    defaultToDepthZeroTypes: string[],
): void {
	const maxDepth = calculateMaxDepth(columns);
	processColumnsForRenderedDepth(columns, defaultToDepthZeroTypes, maxDepth);
}
