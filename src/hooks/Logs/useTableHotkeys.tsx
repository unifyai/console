"use client";

import { useKey } from "react-use";
import { SetStateProps } from "@/types/dataTable";
import { LogProps } from "@/types/projects/logs";
import { Table } from "@tanstack/react-table";

/* Perform different actions using keyboard keys */
export function useTableHotkeys (table: Table<any | unknown> ,logs: LogProps[] | undefined, setState: SetStateProps) {

    // Change base log with arrow keys
    useKey("ArrowUp", () => setState.setBaseLog((baseLog: LogProps | undefined) => {
        if (!baseLog || !logs) return undefined;
        const index = logs.map(log => log.id).indexOf(baseLog.id);
        const newIndex = index != 0 ? index - 1 : index;
        return logs.at(newIndex); 
      }));
    useKey("ArrowDown", () => setState.setBaseLog((baseLog: LogProps | undefined) => {
        if (!baseLog || !logs) return undefined;
        const index = logs.map(log => log.id).indexOf(baseLog.id);
        const newIndex = index != logs.length - 1 ? index + 1 : index;
        return logs.at(newIndex); 
    }));
    useKey("Escape", () => {
        table.toggleAllRowsSelected(false)
    });
}
