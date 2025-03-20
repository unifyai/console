import { ColumnDef, Column, Cell, Row } from "@tanstack/react-table";

import * as path from "path";

import ColumnSort from "@/components/Common/Tables/Buttons/Sort";
import DeleteDialog from "../Common/Dialogs/Delete";
import RenameDialog from "../Common/Dialogs/Rename";

import { CustomEndpoint } from "@/types/custom";
import { FileProps } from "@/types/common";
import { ResponseProps } from "@/types/common";

const customEndpointsTableColumns = (
    data: CustomEndpoint[],
    customKeys: FileProps[],
    customEndpointActions: {
        delete: (name: string) => Promise<ResponseProps>,
        rename: (name: string, newName: string) => Promise<ResponseProps>  
    }
) : ColumnDef<CustomEndpoint>[] => {
    const name = { 
        accessorKey: "name",
        header: ({column}: {column: Column<CustomEndpoint, unknown>}) => 
          <div className="flex flex-row justify-between gap-2 items-center">
            <p>{"Name"}</p>
            <ColumnSort column={column} data={data} sortLoading={false} setSortLoading={() => {}} setIsSorted={() => {}} renderMode="button"/>
          </div>,
        cell: ({cell}: {cell: Cell<CustomEndpoint, unknown>}) => path.basename(cell.getValue() as string)
    }
    const url = { 
        accessorKey: "url",
        header: ({column}: {column: Column<CustomEndpoint, unknown>}) => 
          <div className="flex flex-row justify-between gap-2 items-center">
            <p>{"URL"}</p>
            <ColumnSort column={column} data={data} sortLoading={false} setSortLoading={() => {}} setIsSorted={() => {}} renderMode="button"/>
          </div>
    }
    const key = { 
        accessorKey: "key",
        header: ({column}: {column: Column<CustomEndpoint, unknown>}) => 
          <div className="flex flex-row justify-between gap-2 items-center">
            <p>{"API Key"}</p>
            <ColumnSort column={column} data={data} sortLoading={false} setSortLoading={() => {}} setIsSorted={() => {}} renderMode="button"/>
          </div>,
        cell: ({row}: {row: Row<any | unknown>}) => {
          const endpoint = row.original as CustomEndpoint;
          const index = customKeys.findIndex((key) => key.path === endpoint.key);
          const name = path.basename(customKeys.at(index)!["path"]);
          return name
        }
    }
    const model_arg = { 
      accessorKey: "model_arg",
      header: ({column}: {column: Column<CustomEndpoint, unknown>}) => 
        <div className="flex flex-row justify-between gap-2 items-center">
          <p>{"Model Argument"}</p>
          <ColumnSort column={column} data={data} sortLoading={false} setSortLoading={() => {}} setIsSorted={() => {}} renderMode="button"/>
        </div>
    }
    const actions = { 
        id: "actions",
        header: "Actions",
        cell: ({row}: {row: Row<any | unknown>}) => {
          const endpoint = row.original as CustomEndpoint;
          const name = endpoint.name
          const fileDir = path.dirname(name)
          const fileName= path.basename(name)
          const paths = data.map((d) => d.name)
          return (
          <div className="flex flex-row gap-2">
            <DeleteDialog 
              deletingFunction={customEndpointActions.delete}
              type="custom endpoint"
              args={[name]}
            />
            <RenameDialog 
              renamingFunction={customEndpointActions.rename}
              type="custom endpoint"
              fileDir={fileDir}
              fileName={fileName}
              paths={paths}
              path={name}
            />
          </div>
        )}
    }
    return [name, url, key, model_arg, actions]
}

export default customEndpointsTableColumns;
