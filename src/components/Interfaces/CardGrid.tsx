"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "./Card";
import { LogFieldsResponseProps, LogFieldsProps, LogsResponseProps } from "@/types/evals/logs";
import { ResponseProps } from "@/types/common";
import { ItemType, TableDataProps, TileProps } from "@/types/evals/grid";
import { Switch } from "../UI/switch";
import { Label } from "../UI/label";
import ActionButton from "../Common/Buttons/Action";
import { Check, ListRestart, Loader2, Plus, Save, TriangleAlert, X } from "lucide-react";
import { WidthProvider, Responsive } from "react-grid-layout";
import { Badge } from "../UI/badge";

const ResponsiveReactGridLayout = WidthProvider(Responsive);


const CardGrid = ({
    projects,
    project_,
    tableNames,
    tableData,
    columnTypes,
    savedInterface,
    items_,
    newCounter_,
    interfaceCreated,
    tempInterfaceCreated,
    projectActions,
    logsActions,
    fieldsActions,
    interfaceActions,
    filterExpressions,
    sortingExpressions,
}: {
    projects: string[] | undefined,
    project_: string | null,
    tableNames: string[]
    tableData: TableDataProps,
    columnTypes: { [key: string]: string },
    savedInterface: { items: TileProps[], new_counter: number, project: string | null } | null,
    items_: TileProps[],
    newCounter_: number,
    interfaceCreated: boolean,
    tempInterfaceCreated: boolean,
    projectActions: {
        get: () => Promise<string[]>,
        create: (name: string) => Promise<ResponseProps>,
        rename: (oldName: string, newName: string) => Promise<ResponseProps>,
        delete: (name: string) => Promise<ResponseProps>
    },
    logsActions: {
        get: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, limit: number | null, offset: number) => Promise<LogsResponseProps>,
        getLatest: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, limit: number | null, offset: number) => Promise<string>,
        getMetrics: (
            project: string, filterExpression: string | null, metricName: string, keyName: string
        ) => Promise<number>,
        delete: (ids_and_fields: LogFieldsProps) => Promise<ResponseProps>
    },
    fieldsActions: {
        get: (project: string) => Promise<LogFieldsResponseProps>,
    },
    interfaceActions: {
        get: (temporary: boolean) => Promise<{ items: TileProps[], new_counter: number, project: string | null } | null>,
        create: (items: TileProps[], new_counter: number, project: string | null, temporary: boolean) => Promise<ResponseProps>,
        update: (items: TileProps[], new_counter: number, project: string | null, temporary: boolean) => Promise<ResponseProps>,
    },
    filterExpressions: (string | null)[],
    sortingExpressions: (string | null)[],
}) => {
    const router = useRouter();
    const [items, setItems] = useState<TileProps[]>([...items_.map(item => ({...item}))]);
    const [newCounter, setNewCounter] = useState(newCounter_);
    const [saveSuccess, setSaveSuccess] = useState<boolean>();
    const [resetting, setResetting] = useState<boolean>();
    const [editable, setEditable] = useState(true);
    const [project, setProject] = useState(project_ || undefined);
    const [pending, setPending] = useState<{ [key: string]: boolean }>(
        Object.fromEntries(Object.keys(tableData).map(k => [k, false]))
    );
    const [changedDuringReload, setChangedDuringReload] = useState(false);
    const gridRef = useRef<HTMLDivElement>(null);
    const anyPending = !Object.entries(pending).every(([_, value]) => !value);

    const updateItem = (item: TileProps, attrName: ItemType) => {
        return (newValue: string | undefined) => {
            item[attrName] = newValue;
            setItems([...items.map((i) => (i.i === item.i ? item : i))]);
        }
    }

    const updateInterface = (
        savedInterface: { items: TileProps[], new_counter: number, project: string | null } | null = null,
    ) => {
        if (pending)
            setChangedDuringReload(true);
        const items_1 = savedInterface?.items || items;
        const newCounter_1 = savedInterface?.new_counter || newCounter;
        const project_1 = "project" in (savedInterface || {}) ? savedInterface?.project : project;
        if (tempInterfaceCreated)
            return interfaceActions.update(items_1, newCounter_1, project_1 || null, true);
        else
            return interfaceActions.create(items_1, newCounter_1, project_1 || null, true);
    }

    useEffect(() => {
        if (!project || project != project_) {
            const items_1 = items.map(item => ({
                i: item.i,
                x: item.x,
                y: item.y,
                w: item.w,
                h: item.h,
                moved: item.moved,
                static: item.static,
                tab: item.tab,
                table: item.table,
            }));
            updateInterface({ items: items_1, new_counter: newCounter, project: project || null }).then(
                () => { router.refresh(); }
            );
            setItems([...items_1]);
            setPending(Object.fromEntries(Object.keys(tableData).map(k => [k, true])));
        }
    }, [project]);

    useEffect(() => {
        if (JSON.stringify(items) != JSON.stringify(items_))
            updateInterface();
    }, [items]);

    useEffect(() => {
        if (!changedDuringReload) {
            setItems([...items_.map(item => ({ ...item }))]);
            setNewCounter(newCounter_);
            setChangedDuringReload(false);
        }
        setProject(project_ || undefined);
        setPending(Object.fromEntries(Object.keys(tableData).map(k => [k, false])));
        setResetting(false);
    }, [items_, project_, newCounter_])

    useEffect(() => {
        gridRef.current?.scrollTo({
            top: gridRef.current?.scrollHeight,
            behavior: "smooth",
        });
    }, [newCounter]);

    useEffect(() => { setTimeout(() => setSaveSuccess(undefined), 3000); }, [saveSuccess]);

    const saveIcon = saveSuccess ? <Check /> : saveSuccess == false ? <TriangleAlert /> : <Save />;
    const resetIcon = resetting ? <Loader2 className="animate-spin" /> : <ListRestart />;
    const variant = saveSuccess == false ? "destructive" : "primary";
    const disabled = JSON.stringify(savedInterface) == JSON.stringify(
        { items, new_counter: newCounter, project: project_ }
    );

    return (<div className="w-full h-full overflow-auto m-2" ref={gridRef}>
        <div className="my-2 ml-6 mr-8 flex gap-4 items-center">
            <ActionButton
                className="transition-all"
                tooltip="Save Interface"
                icon={saveIcon}
                variant={variant}
                disabled={disabled || anyPending}
                onClick={async () => {
                    if (saveSuccess == undefined) {
                        let response: ResponseProps | undefined = undefined;
                        if (interfaceCreated)
                            response = await interfaceActions.update(items, newCounter, project || null, false);
                        else
                            response = await interfaceActions.create(items, newCounter, project || null, false);
                        if (response && "info" in response)
                            setSaveSuccess(true);
                        else
                            setSaveSuccess(false);
                    }
                }}
            />
            {<ActionButton
                className="transition-all"
                tooltip="Return to last saved interface"
                icon={resetIcon}
                variant={"destructive"}
                disabled={disabled || anyPending}
                onClick={async () => updateInterface(savedInterface).then(() => {
                    setResetting(true);
                    setEditable(true);
                    router.refresh();
                })}
            />}
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
                            i: "Tile_" + newCounter,
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
                    onCheckedChange={(editable: boolean) => setEditable(editable)}
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
                            projects={projects}
                            project={project}
                            pending={el.tab == "Table" ? pending[el.i] : false}
                            columnTypes={columnTypes}
                            tableNames={tableNames}
                            tableData={tableData}
                            projectActions={projectActions}
                            logsActions={logsActions}
                            index={el.i}
                            item={el}
                            originalItem={items_.find(i => i.i === el.i) as TileProps}
                            items={items}
                            setProject={setProject}
                            setPending={(p: boolean) => setPending({...pending, [el.i]: p})}
                            setItems={(items: TileProps[]) => setItems(items)}
                            updateItem={updateItem}
                            fieldsActions={fieldsActions}
                            updateInterface={updateInterface}
                            filterExpressions={filterExpressions}
                            sortingExpressions={sortingExpressions}
                        />
                        {editable && <ActionButton
                            className="remove absolute top-3 right-3 cursor-pointer"
                            onClick={() => setItems([...items.filter(item => item.i != el.i)])}
                            icon={<X />}
                            tooltip="Remove"
                            variant="destructive"
                            disabled={anyPending}
                        />}
                        <Badge className="absolute top-3 left-3" variant="primary">
                            {el.i}
                        </Badge>
                    </div>
                );
            })}
        </ResponsiveReactGridLayout>
    </div>);
};

export default CardGrid;
