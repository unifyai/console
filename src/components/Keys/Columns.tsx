import { ColumnDef, Column, Cell, Row } from "@tanstack/react-table";

import * as path from "path";

import ColumnSort from "../Common/Tables/Data/Buttons/ColumnSort";
import DeleteDialog from "../Common/Dialogs/Delete";
import RenameDialog from "../Common/Dialogs/Rename";

import { CustomKey } from "@/types/custom";
import { ResponseProps } from "@/types/common";

import { PasswordInput } from "../Common/Input/Password";

const customKeysTableColumns = (
    data: CustomKey[],
    customKeyActions: {
        delete: (name: string) => Promise<ResponseProps>,
        rename: (name: string, newName: string) => Promise<ResponseProps>
    },
) : ColumnDef<CustomKey>[] => {
    const name = { 
        accessorKey: "name",
        header: ({column}: {column: Column<CustomKey, unknown>}) => 
          <div className="flex flex-row justify-between gap-2 items-center">
            <p>{"Name"}</p>
            <ColumnSort column={column}/>
          </div>,
        cell: ({cell}: {cell: Cell<CustomKey, unknown>}) => path.basename(cell.getValue() as string)
    }
    const value = { 
        accessorKey: "value",
        header: ({column}: {column: Column<CustomKey, unknown>}) => 
          <div className="flex flex-row justify-between gap-2 items-center">
            <p>{"Value"}</p>
            <ColumnSort column={column}/>
          </div>,
        cell: ({cell}: {cell: Cell<CustomKey, unknown>}) => {
          const value = cell.getValue() as string;
          return <PasswordInput readOnly value={value}/>;
        } 
    }
    const actions = { 
        id: "actions",
        header: "Actions",
        cell: ({row}: {row: Row<any | unknown>}) => {
          const key = row.original as CustomKey;
          const name = key.name
          const fileDir = path.dirname(name)
          const fileName= path.basename(name)
          const paths = data.map((d) => d.name)
          return (
          <div className="flex flex-row gap-2">
            <DeleteDialog 
              deletingFunction={customKeyActions.delete}
              type="custom key"
              resource={name}
            />
            <RenameDialog 
              renamingFunction={customKeyActions.rename}
              type="custom key"
              fileDir={fileDir}
              fileName={fileName}
              paths={paths}
              path={name}
            />
          </div>
        )}
    }
    return [name, value, actions]
}

export default customKeysTableColumns;
