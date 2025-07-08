"use client";

import { FileProps } from "@/types/common";
import { CustomEndpoint } from "@/types/custom";
import { ColumnSort } from "@tanstack/react-table";

import ListTable from "../../Common/Tables/List/Base";
import { useQueryState } from "nuqs";
import { ResponseProps } from "@/types/common";

import customEndpointsTableColumns from "./Columns";

const CustomEndpointsTable= ({ customEndpoints, customKeys, customEndpointActions }: {
  customKeys: FileProps[],
  customEndpoints: FileProps[],
  customEndpointActions: {
		delete: (name: string) => Promise<ResponseProps>,
    rename: (name: string, newName: string) => Promise<ResponseProps>
	},
}) => {

  // Table content
  const data = customEndpoints.map((endpoint) => {
    const name = endpoint.path;
    const data = endpoint.data as CustomEndpoint;
    return { name: name,  url: data.url, key: data.key } 
  })
  const columns = customEndpointsTableColumns(data, customKeys, customEndpointActions);

  // Table states
  const [sortingStr, setSortingStr] = useQueryState("sorting");
	const sorting = sortingStr ? sortingStr.split(",").map(column => {
		const [id, desc] = column.split("@");
		return { id: id, desc: desc == "true" };
	}) : [];
	const setSorting = (sorting: ColumnSort[]) => {
		setSortingStr(sorting.map(col => `${col.id}@${col.desc}`).join(","));
	};
  const pagination = { pageIndex: 0, pageSize: data.length };
  const state = { sorting, pagination };
	const setState = { setSorting };
  
  return (
      <div className="tutorial-custom-endpoints-table">
        <ListTable data={data} columns={columns} state={state} setState={setState}/>
      </div>
  );
}

export default CustomEndpointsTable;
