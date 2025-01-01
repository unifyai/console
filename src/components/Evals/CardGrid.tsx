"use client";

import { useEffect, useRef, useState } from "react";
import Card from "./Card";
import { LogFieldsResponseProps, LogFieldsProps, LogItemProps, LogProps, LogsResponseProps } from "@/types/evals/logs";
import { ResponseProps } from "@/types/common";
import { TileProps } from "@/types/evals/grid";
import { Switch } from "../UI/switch";
import { Label } from "../UI/label";
import ActionButton from "../Common/Buttons/Action";
import { Check, Plus, Save, TriangleAlert, X } from "lucide-react";
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
    items_,
    newCounter_,
    interfaceCreated,
    projectActions,
    logsActions,
    fieldsActions,
    interfaceActions,
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
    columnTypes: { [key: string]: string },
    items_: TileProps[],
    newCounter_: number,
    interfaceCreated: boolean,
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
    },
    interfaceActions: {
        get: () => Promise<{ items: TileProps[], new_counter: number } | null>,
        create: (items: TileProps[], new_counter: number) => Promise<ResponseProps>,
        update: (items: TileProps[], new_counter: number) => Promise<ResponseProps>,
    }
}) => {
    const [items, setItems] = useState<TileProps[]>([...items_]);
    const [newCounter, setNewCounter] = useState(newCounter_);
    const [success, setSuccess] = useState<boolean>();
    const [editableParam, setEditableParam] = useQueryState("editable", { defaultValue: "true" });
    const editable = editableParam == "true";
    const gridRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        gridRef.current?.scrollTo({
            top: gridRef.current?.scrollHeight,
            behavior: "smooth",
        });
    }, [newCounter]);

    useEffect(() => {
        setTimeout(() => setSuccess(undefined), 3000);
    }, [success]);

    const icon = success ? <Check /> : success == false ? <TriangleAlert /> : <Save />;
    const variant = success ? "primary" : success == false ? "destructive" : "outline";

    return (<div className="w-full h-full overflow-auto m-2" ref={gridRef}>
        <div className="my-2 ml-6 mr-8 flex gap-4 items-center">
            <ActionButton
                className="transition-all"
                tooltip="Save Interface"
                icon={icon}
                variant={variant}
                onClick={async () => {
                    if (success == undefined) {
                        let response: ResponseProps | undefined = undefined;
                        if (interfaceCreated)
                            response = await interfaceActions.update(items, newCounter);
                        else
                            response = await interfaceActions.create(items, newCounter);
                        if (response && "info" in response)
                            setSuccess(true);
                        else
                            setSuccess(false);
                    }
                }}
            />
            <ActionButton
                variant="outline"
                icon={<Plus />}
                text="Add Tile"
                tooltip="Add new tile"
                disabled={!editable}
                onClick={() => {
                    setItems([
                        ...items,
                        {
                            i: "n" + newCounter,
                            x: (items.length * 2) % 12,
                            y: (items.length * 2) / 12,
                            w: 3,
                            h: 3,
                            tab: undefined,
                        }
                    ]);
                    setNewCounter(newCounter + 1);
                }}
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
        <ResponsiveReactGridLayout
            onLayoutChange={(newLayout) => {
                const updatedItems = newLayout.map((item) => {
                    const originalItem = items.find(i => i.i === item.i);
                    return { ...originalItem, ...item };
                });
                setItems([...updatedItems]);
            }}
            className="layout interactive-grid flex-1"
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={100}
            isDraggable={editable}
            isResizable={editable}
        >
            {items.map(el => {
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
                            items={items}
                            setItems={(items: TileProps[]) => setItems(items)}
                            fieldsActions={fieldsActions}
                        />
                        {editable && <ActionButton
                            className="remove absolute top-3 right-3 cursor-pointer"
                            onClick={() => setItems([...items.filter(item => item.i != el.i)])}
                            icon={<X />}
                            tooltip="Remove"
                            variant="destructive"
                        />}
                    </div>
                );
            })}
        </ResponsiveReactGridLayout>
    </div>);
};

export default CardGrid;
