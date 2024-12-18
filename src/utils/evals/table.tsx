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

		// Cancel if moving params to entries or vice-versa
		const activeColumn = columns.find(column => column.id === active.id);
    const overColumn = columns.find(column => column.id === over.id);
    if (activeColumn?.parent?.id != overColumn?.parent?.id) return;

		// Update columns order
		const oldIndex = columnOrder.indexOf(active.id as string);
		const newIndex = columnOrder.indexOf(over.id as string);
		const newOrder = arrayMove(columnOrder, oldIndex, newIndex);
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
  Computes reduction metrics for a given column
*/
export function columnStatistic(columnID: string, metric: string, data: LogItemProps[]) {
	const originalID = columnID.replace("entries_", "").replace("params_", "");
	const values = data.map((entries) => toComputableValue(entries[originalID as keyof typeof entries]));
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
  data: LogsResponseProps,
  enableRowSpan: boolean = false
) : ColumnDef<LogProps>[] => {
  return nodes.map(node => {
      if (node.nodes) {
          const columns = nestedColumns(node.nodes, type, data);
          return {id: node.path, header: node.name, columns: columns};
      }
      return {
          id: node.path,
          accessorFn: (log) => type === "entries" ? log.entries[node.path] : log.params[node.path],
          filterFn: "includesString" as FilterFnOption<LogProps> | undefined,
          header: node.name,
          cell: ({ cell }: {cell: Cell<LogProps, unknown>}) => {
            let cellValue = cell.getValue();
            if (type === "params") cellValue = data.params[node.path][cellValue as string];
            if (isImage(cellValue)) return <ImageDisplay value={cellValue as string} className="object-scale-down h-5 w-5"/>
            if (typeof cellValue === "number") return cellValue.toExponential(2);
            const displayValue = cellValue != undefined ? JSON.stringify(cellValue).trimStart().replace(/^"|"$/g, '') : "";
            return displayValue.slice(0, 50);
          },
          meta: {
              dataType: () => {
                  const columnValues = data.logs.map(log => type === "params" ? log.params : log.entries).flatMap((entry) => entry[node.path]).filter((value) => value != undefined);
                  const types = columnValues.map((value) => typeof value).map((type) => type === "number" ? type : "string");
                  return dominantType(types);
              },
              columnType: type,
              enableRowSpan: enableRowSpan
          }
      };
  });
};

/* 
  Update row selection state and base / comparison logs on row clicks
*/
export const onRowClick = (
  state: StateProps,
  setState: SetStateProps,
  table: Table<any | unknown>,
  row: Row<any | unknown>, 
  event: MouseEvent<HTMLTableRowElement, globalThis.MouseEvent>,
) => {

  /* Update row selections */
  
  event.stopPropagation();

  const selectedRows = table.getSelectedRowModel().rows;    //  Currently selected rows in the table. Updates asynchronously.
  let selections = selectedRows;                            //  Local state tracking variable used to pass the updated selections to the update comparables functions
  const subRows = row.subRows                               //  Tracking subrows for batch selection

  if (selectedRows.length === 0) {
    
    // If no row is selected:
    // Select the row (if leaf row) or subrows (if parent row) and set it as base.

    row.toggleSelected();
    if (subRows.length === 0) {
      setState.setLastSelectedRow(row);
      selections.push(row);  
    } else {
      subRows.forEach(r => {
        r.toggleSelected();
        selections.push(r);  
      })
      setState.setLastSelectedRow(subRows.at(-1));
    } 

  } 
 
  else {

      if (event.ctrlKey || event.metaKey) {
        
        // If some rows are selected and ctrl+click: 
        // Select / deselect the row (if leaf row) or subrows (if parent row) and add / remove to the local selections variable.

        row.toggleSelected();
        if (subRows.length === 0) {
          setState.setLastSelectedRow(row);
          selections = selections.includes(row) ? selections.filter(s => s != row) : [...selections, row];
        } else {
          setState.setLastSelectedRow(subRows.at(-1));
          subRows.forEach(r => {
            selections = selections.includes(r) ? selections.filter(s => s != r) : [...selections, r];
          })
        }
      
      } else if (event.shiftKey) {

          // If some rows are selected and shift+click: 
          // Determine range of rows to toggle between the last selected and the currently selected, then
          // Select / deselect rows in the range and append to / remove from local selections variable. 

          const lastSelectedRowIndex = table.getRowModel().rows.findIndex(r => r === state.lastSelectedRow);
          const rowIndex = table.getRowModel().rows.findIndex(r => r === row );
      
          let minIndex = Math.min(lastSelectedRowIndex, rowIndex);
          minIndex += minIndex === lastSelectedRowIndex ? 1 : 0;
          let maxIndex = Math.max(lastSelectedRowIndex, rowIndex);
          maxIndex += maxIndex === rowIndex ? 1 : 0;

          event.preventDefault();
          table.getRowModel().rows.slice(minIndex, maxIndex).map(r => {
            r.toggleSelected()
            selections = selections.includes(r) ? selections.filter(s => s != r) : [...selections, r];
          });
          setState.setLastSelectedRow(row);

      } else {
          
          // If some rows are selected and simple click: 
          // Deselect all rows then select / deselect row (if leaf row) or subrows (if parent row) and set local selections variable to that /those row(s) only.

          table.resetRowSelection(true);
          row.toggleSelected();
          if (subRows.length === 0) {
            setState.setLastSelectedRow(row);
            selections = selectedRows.length === 1 && selectedRows.at(0) === row ? [] : [row];  
          } else {
            setState.setLastSelectedRow(subRows.at(-1));
            selections =  selectedRows.length === subRows.length && 
                          selectedRows.every(r => subRows.indexOf(r) > -1) && 
                          subRows.every(r => selectedRows.indexOf(r) > -1) 
                            ? [] 
                            : [...subRows];  
          }
        }
  }
  
  /* Update base and comparison logs */

  if (selections.length === 0) {

    // If no selected row reset base and comparison logs
    setState.setBaseLog((l: LogProps) => undefined);
    setState.setComparisonLogs((l: LogProps[]) => undefined);
  
  } else if (selections.length === 1) {
  
    // If one row selected set its log as the base and reset comparison logs
    setState.setBaseLog((l: LogProps) => selections.at(0)!.original)
    setState.setComparisonLogs((l: LogProps[]) =>undefined);
  
  } else if (selections.length > 1) {
  
    // If more than one row selected set the first row's log as the base and the others as comparison logs
    setState.setBaseLog((l: LogProps) => selections.at(0)!.original)
    setState.setComparisonLogs((l: LogProps[]) => selections.slice(1).map(row => row.original));
  
  }
  
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
