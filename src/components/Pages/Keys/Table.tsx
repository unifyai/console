"use client";

import { FileProps } from "@/types/common";
import { CustomKey } from "@/types/custom";
import { ResponseProps } from "@/types/common";

import customKeysTableColumns from "./Columns";

import { useQueryState } from "nuqs";
import { ColumnSort } from "@tanstack/react-table";
import ListTable from "../../Common/Tables/List/Base";

const CustomKeysTable= ({ customKeys, customKeyActions }: {
    customKeys: FileProps[],
    customKeyActions: {
        delete: (name: string) => Promise<ResponseProps>,
        rename: (name: string, newName: string) => Promise<ResponseProps>
      },  
}) => {
  
    // Table content
  const data = customKeys.map((key) => {
    const name = key.path;
    const data = key.data as CustomKey;
    return { name: name,  value: data.value } 
  })
  const columns = customKeysTableColumns(data, customKeyActions);

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

  return <ListTable data={data} columns={columns} state={state} setState={setState}/>;
}

export default CustomKeysTable;
