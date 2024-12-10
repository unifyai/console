"use client";

import { PlusCircle } from "lucide-react";
import Tooltip from "@/components/Common/Misc/Tooltip";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import ActionButton from "@/components/Common/Buttons/Action";
import { Cell } from "@tanstack/react-table";
import { SetStateProps, StateProps } from "@/types/dataTable";

const AddHiddenColumn = ({cell, state, setState}: {
  cell: Cell<any, unknown>, 
  state: StateProps, 
  setState: SetStateProps
}) => {
  const hiddenColumns = Object.entries(state.columnVisibility).filter(([key, value]) => !value).map(([key, value]) => key);
  const OrderColumn = (column: string) => {
    const newOrder = [...state.columnOrder];
    const columnIndex = state.columnOrder.indexOf(cell.column.id);
    newOrder.splice(columnIndex + 1, 0, column)
    setState.setColumnOrder(newOrder);
  }
  const DisplayColumn = (column: string) => {
    const newVisibility = {...state.columnVisibility};
    newVisibility[column] = true;
    setState.setColumnVisibility(newVisibility);
  }
  return (
  <div 
    className="
      absolute z-30 
      top-1/2 -translate-y-4 -right-3 
      pointer-events-auto 
      invisible transition-all duration-200 group-hover/cell:visible group-hover/cell:opacity-100 opacity-0
      scale-80"
    onClick={e => {e.stopPropagation()}}
  >
    <BaseDropdown
      button={
        <ActionButton 
          tooltip="Add column"
          icon={<PlusCircle size={10}/>}
        />
      }
      label="Select the column to add"
    >
      {hiddenColumns.map((column, index) => 
        <DropdownMenuItem key={index} onClick={() => {
          DisplayColumn(column);
          OrderColumn(column);
        }}>
          {column}
        </DropdownMenuItem>
      )}
    </BaseDropdown>
  </div>
  );
};

export default AddHiddenColumn;
