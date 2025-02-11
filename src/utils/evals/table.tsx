import { CSSProperties, Dispatch, SetStateAction, MouseEvent } from "react";
import { Column, Row, Cell, ColumnDef, GroupingState, FilterFnOption, RowSelectionState } from "@tanstack/react-table";
import {
	RowData,
	RowModel,
	createRow,
	getMemoOptions,
	memo,
} from "@tanstack/react-table"
import { DragMoveEvent, DragOverEvent, DragStartEvent, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Transform } from "@dnd-kit/utilities";
import _ from "lodash";

import { toComputableValue, computeStatistic } from "./common";
import { LogProps, LogsResponseProps, LogItemProps, HeaderNode, GroupedLogProps, GroupedLogPropsRaw } from "@/types/evals/logs";
import { SetStateProps, StateProps } from "@/types/dataTable";
import { Table } from "@tanstack/react-table";

import { ImageDisplay, isImage } from "./selection";
import { formatNumber } from "../formatNumber";
import { sanitizeId } from "./columnOperations";
import { DraggingColumnsState } from "@/types/evals/columns";

/* 
  Updates the dragging columns state when starting to drag a column/column group on top of another
*/
export function handleDragStart(
	event: DragStartEvent,
	draggingColumns: DraggingColumnsState,
	setDraggingColumns: (draggingColumns: DraggingColumnsState) => void,
	columns: Column<any, unknown>[],
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
			}
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
	columns: Column<any, unknown>[],
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
			}
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
	columns: Column<any, unknown>[],
) {
	const { active, over, delta } = event;

	if (active && over && active.id === over.id) return;

	const activeColumn = columns.find((col) => col.id === active.id);
	const overColumn = columns.find((col) => col.id === over?.id && !draggingColumns.active.ids?.includes(col.id));
	const atSameDepth = activeColumn?.columnDef.meta?.renderedDepth === overColumn?.columnDef.meta?.renderedDepth;
	const bothParents = activeColumn?.columnDef.meta?.isParent && overColumn?.columnDef.meta?.isParent

	// Propagate the transform values
	const activeTransform: Transform = { x: delta.x, y: delta.y, scaleX: 1.0, scaleY: 1.0 };
	const overTransform: Transform = { x: -delta.x, y: delta.y, scaleX: 1.0, scaleY: 1.0 };

	if (!atSameDepth){
		// Construct the new state object
		const newDraggingState: DraggingColumnsState = {
			active: {
			  ids: draggingColumns.active.ids,
			  transform: activeTransform,
			},
			over: {
				ids: [],
        		transform: null,
			}
		};

		setDraggingColumns(newDraggingState);
	}

	else if (atSameDepth && bothParents) {

		// Construct the new state object
		const newDraggingState: DraggingColumnsState = {
			active: {
			  ids: draggingColumns.active.ids,
			  transform: activeTransform,
			},
			over: {
				ids: over?.data.current?.group,
        		transform: overTransform,
			}
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
  columns: Column<any, unknown>[],
) {
	const { active, over } = event;

	// Reset draggingColumns state
	setDraggingColumns({
		active: { ids: [], transform: null },
		over: { ids: [], transform: null },
	});

	if (active && over && active.id !== over.id) {

		const activeColumn = columns.find(column => column.id === active.id);
		const overColumn = columns.find(column => column.id === over.id);
		const atSameDepth = activeColumn?.columnDef.meta?.renderedDepth === overColumn?.columnDef.meta?.renderedDepth;

		if (!activeColumn || !overColumn || !atSameDepth) return;

		// Cancel if moving params to entries or vice-versa
		if (activeColumn?.parent?.id !== overColumn?.parent?.id) {
			return;
		}

		// Get all IDs for the active column group (parent and its children)
		const activeGroupIDs = active.data.current?.group ?? getColumnGroupIDs(activeColumn)

		// Get all IDs for the over column group
		const overGroupIDs = over.data.current?.group ?? getColumnGroupIDs(overColumn)

		// Find the positions in the current columnOrder
		const oldIndex = columnOrder.findIndex(id => id === activeGroupIDs[0]);
		const newIndex = columnOrder.findIndex(id => id === overGroupIDs[0]);

		if (oldIndex === -1 || newIndex === -1 || oldIndex  === newIndex) {
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

export function handleDragCancel(setDraggingColumns: (draggingColumns: DraggingColumnsState) => void) {
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
	insertRightAfterOver: boolean = false,  // Whether to insert the activeGroupIDs right after the overGroupIDs
): string[] {
	// Create a copy of the column order
	const result = [...columnOrder];

	// Find the start indices of both groups
	const activeStartIndex = result.findIndex(id => id === activeGroupIDs[0]);
	const overStartIndex = result.findIndex(id => id === overGroupIDs[0]);

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
	data: LogsResponseProps,
	enableRowSpan: boolean = false,
	dataTypes: { [key: string]: string },
	fieldTypes:{ [key: string]: string }
): ColumnDef<LogProps | GroupedLogProps>[] => {
	return nodes.map(node => {
		// If this node has children (nested columns), recursively build columns
		if (node.nodes) {
			const columns = nestedColumns(node.nodes, type, prependPath, data, false, dataTypes, fieldTypes);
			return {
				id: `${prependPath}/${node.path}`,  // needed for grouping, showing, hiding multiple column nests
				header: node.name,
				columns,
				meta: {
					columnType: type,
					enableRowSpan: enableRowSpan,
					isParent: true,
					renderedDepth: -1
				}
			};
		}

		// Determine the dataType (default to 'str' if not found or unrecognized)
		const dataType = dataTypes[node.path] || "str";
		const fieldType = fieldTypes[node.path] || "entry";
		return {
			id: `${prependPath}/${node.path}`,  // needed for grouping, showing, hiding multiple column nests
			accessorFn: (log, index) => {
				// If grouping, return the value from the log
				if ("groupingColumnId" in log) {
					return (log as GroupedLogProps)[(log as GroupedLogProps).groupingColumnId];
				}
				// Safely extract the value from either entries or params
				if (type === "entries") {
					return (log as LogProps).entries?.[node.path];
				} else {
					return (log as LogProps).params?.[node.path];
					}
				},
			sortDescFirst: true,
			filterFn: "includesString",
			header: node.name,
			cell: ({ cell }: { cell: Cell<LogProps | GroupedLogProps, unknown> }) => {
				let cellValue = cell.getValue();

				// For grouped logs, if we haven't yet expanded a grouped row,
				// we haven't fetched any logs for that group yet, and so we
				// cannot display aggregated values. Thus, we simply display
				// nothing
				if ("groupingColumnId" in cell.row.original && !cell.row.original.isPopulated && cell.row.groupingColumnId !== cell.column.id) {
					return null;
				}

				if (type === "params" && cellValue !== undefined && cellValue !== null) {
					cellValue = data.params?.[node.path]?.[cellValue as string] ?? cellValue;
				}

				// If cellValue itself is undefined or null, display a fallback
				if (cellValue === undefined || cellValue === null) {
					return "–"; // or "N/A", or any other fallback string
				}

				// Depending on the dataType, format the incoming value
				switch (dataType) {
					case "image": {
						if (typeof cellValue === "string") {
							let value = cellValue.trim();
							if (value.startsWith('"') && value.endsWith('"')) {
								// Trim the outer quotes if they exist
								value = value.slice(1, -1);
							}
							return <ImageDisplay value={value} className="object-scale-down h-5 w-5" />;
						}
						// If not a string, fallback
						return "Invalid Image";
					}

					case "int":
					case "float": {
						// Safely parse to float, if invalid or NaN display fallback
						const numericValue = parseFloat(String(cellValue));
						if (isNaN(numericValue)) {
							return "–";
						}
						// Use a numeric formatting function if desired
						return formatNumber(numericValue);
					}

					case "timestamp":
					case "str": {
						// For timestamps or generally string data, handle leading/trailing quotes
						if (typeof cellValue === "string") {
							let value = cellValue.trim();
							if (value.startsWith('"') && value.endsWith('"')) {
								value = value.slice(1, -1);
							}
							return value;
						}
						// If not a string, at least convert to string
						return String(cellValue);
					}

					default: {
						// Fallback for unrecognized data types
						// If it's an object, try JSON stringify or just display as string
					if (typeof cellValue === "object") {
							try {
								return JSON.stringify(cellValue);
							} catch {
							return String(cellValue);
							}
						}
						// If it's anything else, just convert to string
						return String(cellValue);
					}
				}
			},
			meta: {
				dataType: dataType,
				fieldType: fieldType,
				columnType: type,
				enableRowSpan: enableRowSpan,
				isParent: false,
				renderedDepth: -1
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
  Find the maximum depth in any branch of the column tree
*/
function findMaxDepth(
  columns: ColumnDef<LogProps | GroupedLogProps>[]
): number {
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
function hasImmediateLeafNodes(
  column: ColumnDef<LogProps | GroupedLogProps>
): boolean {
  return (column as any).columns?.some((child: ColumnDef<LogProps | GroupedLogProps>) => 
    !(child as any).columns?.length
  ) ?? false;
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
  function processColumn(
    column: ColumnDef<LogProps | GroupedLogProps>
  ): void {
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
export function validateRuntimeColumns(
  columns: any[],
  indent = ''
): void {
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
  return table =>
    memo(
      () => [table.options.data],
      (
        data
      ): {
        rows: Row<TData>[]
        flatRows: Row<TData>[]
        rowsById: Record<string, Row<TData>>
      } => {
        const rowModel: RowModel<TData> = {
          rows: [],
          flatRows: [],
          rowsById: {},
        }

        const accessRows = (
          originalRows: TData[],
          depth = 0,
          parentRow?: Row<TData>
        ): Row<TData>[] => {
          const rows = [] as Row<TData>[]

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
            )

			// Add necessary props to support manual server-side grouping
            row.groupingColumnId = (originalRows[i] as any).groupingColumnId
            row.groupingValue = (originalRows[i] as any)[row.groupingColumnId]
			row.groupingIndex = (originalRows[i] as any)[row.groupingIndex]

            // Keep track of every row in a flat array
            rowModel.flatRows.push(row)
            // Also keep track of every row by its ID
            rowModel.rowsById[row.id] = row
            // Push table row into parent
            rows.push(row)

            // Get the original subrows
            if (table.options.getSubRows) {
              row.originalSubRows = table.options.getSubRows(
                originalRows[i]!,
                i
              )

              // Then recursively access them
              if (row.originalSubRows?.length) {
                row.subRows = accessRows(row.originalSubRows, depth + 1, row)
              }
            }
          }

          return rows
        }

        rowModel.rows = accessRows(data)

        return rowModel
      },
      getMemoOptions(table.options, 'debugTable', 'getRowModel', () =>
        table._autoResetPageIndex()
      )
    )
}