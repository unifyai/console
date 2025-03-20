"use client";

import { Dispatch, SetStateAction, useState } from "react";
import ActionButton from "../Common/Buttons/Action";
import { Dialog, DialogContent } from "../UI/dialog";
import { Input } from "../UI/input";
import { PlotDataProps, TableDataProps, TileProps } from "@/types/evals/grid";

const EditTileName = ({
    tableData,
    plotData,
    items,
    editTile,
    setItems,
    setEditTile,
    setTableData,
    setPlotData
}: {
    tableData: TableDataProps,
    plotData: PlotDataProps,
    items: TileProps[],
    editTile: string,
    setItems: Dispatch<SetStateAction<TileProps[]>>,
    setEditTile: Dispatch<SetStateAction<string | undefined>>,
    setTableData: Dispatch<SetStateAction<TableDataProps>>,
    setPlotData: Dispatch<SetStateAction<PlotDataProps>>
}) => {
    const [newTileName, setNewTileName] = useState<string>();

    // edit tile name
    const saveTileName = () => {
        if (newTileName) {
            const newItems = items.map(
                item => (
                    item.i == editTile
                        ? { ...item, i: newTileName }
                        : item.table == editTile
                            ? { ...item, table: newTileName }
                            : (
                                item.x_axis?.includes(editTile + ".") ||
                                item.y_axis?.includes(editTile + ".") ||
                                item.plot_group_by?.includes(editTile + ".")
                            )
                                ? {
                                    ...item,
                                    x_axis: item.x_axis?.replace(editTile + ".", newTileName + "."),
                                    y_axis: item.y_axis?.replace(editTile + ".", newTileName + "."),
                                    plot_group_by: item.plot_group_by?.replace(
                                        editTile + ".", newTileName + "."
                                    )
                                }
                                : { ...item }
                )
            );
            setItems([...newItems]);
            setTableData({ ...tableData, [newTileName]: tableData[editTile] });
            setPlotData({ ...plotData, [newTileName]: plotData[editTile] });
        }
        setEditTile(undefined);
        setNewTileName(undefined);
    };

    return (
        <Dialog open={true} onOpenChange={() => {
            setEditTile(undefined);
            setNewTileName(undefined);
        }}>
            <DialogContent className="w-72">
                <div className="mt-6 flex gap-2">
                    <Input
                        placeholder={"Enter new tile name..."}
                        value={newTileName || ""}
                        onInput={(input) => setNewTileName(input.currentTarget.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter")
                                saveTileName();
                        }}
                        className="h-8 w-48"
                    />
                    <ActionButton
                        className="remove cursor-pointer"
                        onClick={() => saveTileName()}
                        text="Save"
                        tooltip="Save"
                        variant="primary"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default EditTileName;
