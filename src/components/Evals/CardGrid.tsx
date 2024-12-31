"use client";

import { useState } from "react";
import Card from "./Card";
import { LogFieldsResponseProps, LogFieldsProps, LogItemProps, LogProps, LogsResponseProps } from "@/types/evals/logs";
import { ResponseProps } from "@/types/common";
import { TileProps } from "@/types/evals/grid";
import { Switch } from "../UI/switch";
import { Label } from "../UI/label";
import ActionButton from "../Common/Buttons/Action";
import { Plus, Save, X } from "lucide-react";
import { WidthProvider, Responsive } from "react-grid-layout";
import { useQueryState } from "nuqs";

const ResponsiveReactGridLayout = WidthProvider(Responsive);


const CardGrid = ({
    searchParams,
    projects,
    project,
    logs,
    params,
    entriesProperties,
    paramsProperties,
    metrics,
    logsData,
    totalPages,
    columnTypes,
    projectActions,
    logsActions,
    fieldsActions
}: {
    searchParams: { project?: string, page_number?: string, metric?: string, filters?: string, common_filter?: string },
    projects: string[] | undefined,
    project: string | undefined,
    logs: LogProps[],
    params: LogItemProps,
    entriesProperties: string[],
    paramsProperties: string[],
    metrics: { [key: string]: number }
    logsData: LogsResponseProps,
    totalPages: number,
    columnTypes: { [key: string]: string }
    projectActions: {
        get: () => Promise<string[]>,
        create: (name: string) => Promise<ResponseProps>,
        rename: (oldName: string, newName: string) => Promise<ResponseProps>,
        delete: (name: string) => Promise<ResponseProps>
    }
    logsActions: {
        get: (project: string, filterExpression: string | null, limit: number, offset: number) => Promise<LogsResponseProps>,
        getMetrics: (
            project: string, filterExpression: string | null, metricName: string, keyName: string
        ) => Promise<number>,
        delete: (ids: string[]) => Promise<ResponseProps>
    },
    fieldsActions: {
        get: (project: string) => Promise<LogFieldsResponseProps>,
        delete: (fields: LogFieldsProps) => Promise<ResponseProps>
    }
}) => {
    const [layout, setLayout] = useState<{ items: TileProps[], newCounter: number, cols?: number, breakpoint?: string }>({
        items: [{ i: "n0", x: 0, y: 0, w: 3, h: 3, tab: undefined }],
        newCounter: 1
    });
    const [editableParam, setEditableParam] = useQueryState("editable", { defaultValue: "true" });
    const editable = editableParam == "true";

    return (<>
        <div className="my-2 ml-6 mr-8 flex gap-4 items-center">
            <ActionButton icon={<Save />} tooltip="Save Layout" variant="outline" />
            <ActionButton
                variant="outline"
                icon={<Plus />}
                text="Add Tile"
                tooltip="Add new tile"
                disabled={!editable}
                onClick={() => setLayout({
                    ...layout,
                    items: [
                        ...layout.items,
                        {
                            i: "n" + layout.newCounter,
                            x: (layout.items.length * 2) % (layout.cols || 12),
                            y: (layout.items.length * 2) / (layout.cols || 12),
                            w: 3,
                            h: 3,
                            tab: undefined
                        }
                    ],
                    newCounter: layout.newCounter + 1
                })}
            />
            <div className="flex items-center gap-2">
                <Switch
                    checked={editable}
                    onCheckedChange={(editable: boolean) => setEditableParam(String(editable))}
                    id="editable"
                />
                <Label htmlFor="airplane-mode">Editing Mode</Label>
            </div>
        </div>
        <div className="h-full flex flex-col gap-2 m-3 rounded-lg">
            <ResponsiveReactGridLayout
                onLayoutChange={(newLayout) => {
                    const updatedItems = newLayout.map((item) => {
                        const originalItem = layout.items.find(i => i.i === item.i);
                        return { ...originalItem, ...item };
                    });
                    setLayout({ ...layout, items: updatedItems });
                }}
                onBreakpointChange={(breakpoint: string, cols: number) => setLayout({
                    ...layout,
                    breakpoint: breakpoint,
                    cols: cols
                })}
                className="layout interactive-grid flex-1"
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={100}
                isDraggable={editable}
                isResizable={editable}
            >
                {layout.items.map((el: { i: string, x: number, y: number, w: number, h: number, add?: boolean }) => {
                    return (
                        <div
                            key={el.i}
                            data-grid={el}
                            className="relative m-1 p-1 rounded-lg"
                        >
                            <Card
                                searchParams={searchParams}
                                projects={projects}
                                project={project}
                                logs={logs}
                                params={params}
                                entriesProperties={entriesProperties}
                                paramsProperties={paramsProperties}
                                metrics={metrics}
                                logsData={logsData}
                                totalPages={totalPages}
                                columnTypes={columnTypes}
                                projectActions={projectActions}
                                logsActions={logsActions}
                                index={el.i}
                                items={layout.items}
                                setItems={(items: TileProps[]) => setLayout({ ...layout, items: items })}
                                fieldsActions={fieldsActions}
                            />
                            {editable && <ActionButton
                                className="remove absolute top-3 right-3 cursor-pointer"
                                onClick={() => setLayout(
                                    { ...layout, items: layout.items.filter(item => item.i != el.i) }
                                )}
                                icon={<X />}
                                tooltip="Remove"
                                variant="destructive"
                            />}
                        </div>
                    );
                })}
            </ResponsiveReactGridLayout>
        </div>
    </>);
};

export default CardGrid;
