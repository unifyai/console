"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "./Card";
import { LogFieldsResponseProps, LogFieldsProps, LogsResponseProps } from "@/types/evals/logs";
import { FileProps, ResponseProps } from "@/types/common";
import { ItemType, PlotDataProps, TableDataProps, TileProps } from "@/types/evals/grid";
import { Switch } from "../UI/switch";
import { Label } from "../UI/label";
import ActionButton from "../Common/Buttons/Action";
import { Check, Clipboard, Copy, Eye, EyeOff, Grip, ListRestart, Loader2, Maximize2, Plus, Save, TriangleAlert, X } from "lucide-react";
import { WidthProvider, Responsive } from "react-grid-layout";
import { Badge } from "../UI/badge";
import { Dialog, DialogContent } from "../UI/dialog";
import { Input } from "../UI/input";
import BaseDropdown from "../Common/Dropdowns/Base";
import { DropdownMenuItem } from "../UI/dropdown-menu";
import FileDirectory from "../Tree/Directory/FileDirectory";
import CloseProject from "./Table/Buttons/CloseProject";
import DeleteDialog from "../Common/Dialogs/Delete";
import CreateProject from "./Table/Buttons/CreateProject";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../UI/tabs";

const ResponsiveReactGridLayout = WidthProvider(Responsive);


const CardGrid = ({
    projects,
    project_,
    tableNames,
    tableData,
    fields,
    plotData,
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
    fields: LogFieldsResponseProps,
    plotData: PlotDataProps,
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
        get: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, limit: number | null, offset: number, _timestamp: string | null) => Promise<LogsResponseProps>,
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
    const [items, setItems] = useState<TileProps[]>([...items_.map(item => ({ ...item }))]);
    const [newCounter, setNewCounter] = useState(newCounter_);
    const [saveSuccess, setSaveSuccess] = useState<boolean>();
    const [resetting, setResetting] = useState<boolean>();
    const [editable, setEditable] = useState(true);
    const [project, setProject] = useState(project_ || undefined);
    const [pending, setPending] = useState<{ [key: string]: boolean }>(
        Object.fromEntries(Object.keys(tableData).map(k => [k, false]))
    );
    const [changedDuringReload, setChangedDuringReload] = useState(false);
    const [maxTile, setMaxTile] = useState<string>();
    const [editTile, setEditTile] = useState<string>();
    const [newTileName, setNewTileName] = useState<string>();
    const [copied, setCopied] = useState<string>();
    const gridRef = useRef<HTMLDivElement>(null);
    const anyPending = !Object.entries(pending).every(([_, value]) => !value);
    const maxTileItem = items.find(item => item.i == maxTile) as TileProps;
    const hiddenItems = items.filter(item => !item.visible);
    const data = (projects || []).map((p) => ({ path: p, type: "file" }));

    const updateItem = (item: TileProps, attrName: ItemType) => {
        return (newValue: any | undefined) => {
            item[attrName] = newValue;
            setItems([...items.map((i) => (i.i === item.i ? item : i))]);
        }
    }

    const resetParamsStates = () => {
        items.filter(item => item.tab == "Table").map(item => {
            updateItem(item, "selected")("");
            updateItem(item, "column_order")(undefined);
            updateItem(item, "hidden_columns")(undefined);
            updateItem(item, "sorting")(undefined);
            updateItem(item, "grouping")(undefined);
            updateItem(item, "columns_pin_left")(undefined);
            updateItem(item, "columns_pin_right")(undefined);
            updateItem(item, "metric")("mean");
            updateItem(item, "page_number")(undefined);
            updateItem(item, "context")(undefined);
        })
    };

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

    const saveTileName = () => {
        if (newTileName) {
            const newItems = items.map(
                item => (
                    item.i == editTile
                        ? { ...item, i: newTileName }
                        : item.table == editTile
                            ? { ...item, table: newTileName }
                            : { ...item }
                )
            );
            setItems([...newItems]);
        }
        setEditTile(undefined);
        setNewTileName(undefined);
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
                visible: item.visible,
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
    const variant = saveSuccess == false ? "destructive" : "outline";
    const disabled = JSON.stringify(savedInterface) == JSON.stringify(
        { items, new_counter: newCounter, project: project_ }
    );

    return (<div className="w-full h-full overflow-auto p-3" ref={gridRef}>
        <Tabs defaultValue="Interface_1" className="w-full tutorial-details-panel">
            <div className="mt-1 ml-4 mr-8 flex justify-between gap-4">
                <div className="w-fit gap-2 flex flex-row items-center">
                    <FileDirectory
                        data={data}
                        renamingFunction={projectActions.rename}
                        setterFunction={(proj: FileProps | undefined) => {
                            const newProj = proj ? proj.path : undefined;
                            resetParamsStates();
                            setProject(newProj);
                        }}
                        type="Projects"
                        defaultValue={project}
                    />
                    {project && (
                        <div className="flex flex-row gap-2">
                            <CloseProject
                                onClick={() => {
                                    resetParamsStates();
                                    setProject(undefined);
                                }}
                            />
                            <DeleteDialog
                                type="project"
                                resource={project}
                                deletingFunction={projectActions.delete}
                                variant="outline"
                                onDelete={() => {
                                    resetParamsStates();
                                    setProject(undefined);
                                }}
                            />
                        </div>
                    )}
                    {projects && <CreateProject creationFunction={projectActions.create} paths={projects} />}
                </div>
                <TabsList className="rounded-md justify-between">
                    <div className="flex flex-row gap-3">
                        <TabsTrigger
                            value="Interface_1"
                            className="flex flex-row gap-2 data-[state=active]:text-accent"
                        >
                            {"Interface_1"}
                        </TabsTrigger>
                        <TabsTrigger
                            value="Interface_2"
                            className="flex flex-row gap-2 data-[state=active]:text-accent"
                        >
                            {"Interface_2"}
                        </TabsTrigger>
                    </div>
                </TabsList>

                <div className="flex gap-2 items-center">
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
                    <ActionButton
                        className="transition-all"
                        tooltip="Return to last saved interface"
                        icon={resetIcon}
                        variant="outline"
                        disabled={disabled || anyPending}
                        onClick={async () => updateInterface(savedInterface).then(() => {
                            setResetting(true);
                            setEditable(true);
                            router.refresh();
                        })}
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
                                    i: "Tile_" + newCounter,
                                    x: (items.length * 2) % 12,
                                    y: (items.length * 2) / 12,
                                    w: 4,
                                    h: 4,
                                    tab: undefined,
                                    visible: true,
                                }
                            ]);
                            setNewCounter(newCounter + 1);
                        }}
                    />
                    <BaseDropdown
                        button={<ActionButton
                            variant="outline"
                            icon={<Eye />}
                            tooltip="Show Hidden"
                            size="sm"
                            disabled={hiddenItems.length == 0}
                        />}
                    >
                        {hiddenItems.map((item, idx) => <DropdownMenuItem
                            key={idx}
                            onSelect={() => {
                                setItems([...items.map(
                                    it => it.i == item.i ? {
                                        ...it,
                                        x: (items.length * 2) % 12,
                                        y: (items.length * 2) / 12,
                                        w: 4,
                                        h: 4,
                                        visible: true
                                    } : { ...it }
                                )]);
                            }}
                            disabled={hiddenItems.length == 0}
                            className="w-64 no-drag"
                        >
                            {item.i}
                        </DropdownMenuItem>)}
                    </BaseDropdown>
                    <ActionButton
                        variant="outline"
                        icon={<Clipboard />}
                        tooltip="Paste"
                        disabled={!copied}
                        onClick={() => {
                            const copiedItem = items.find(item => item.i == copied) as TileProps;
                            setItems([
                                ...items,
                                { ...copiedItem, i: "Tile_" + newCounter }
                            ]);
                            setNewCounter(newCounter + 1);
                            setCopied(undefined);
                        }}
                    />
                    <div className="flex items-center gap-2 ml-2">
                        <Switch
                            checked={editable}
                            onCheckedChange={(editable: boolean) => setEditable(editable)}
                            id="editable"
                        />
                        <Label htmlFor="airplane-mode">Editing Mode</Label>
                    </div>
                </div>
            </div>
            <TabsContent value="Interface_1" className="tutorial-selection-pane">
                {/* <Selection params={params} logs={logs} /> */}
                {/* <div className="text-center">text1</div> */}
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
                    draggableCancel=".no-drag"
                    resizeHandles={["e", "w", "s", "n", "se", "sw", "ne", "nw"]}
                >
                    {items.map(el => {
                        return (
                            <div
                                key={el.i}
                                data-grid={el}
                                className="relative m-1 p-1 rounded-lg"
                                hidden={!el.visible}
                            >
                                <Card
                                    editable={editable}
                                    project={project}
                                    pending={el.tab == "Table" ? pending[el.i] : false}
                                    fields={fields}
                                    columnTypes={columnTypes}
                                    tableNames={tableNames}
                                    tableData={tableData}
                                    plotData={plotData}
                                    logsActions={logsActions}
                                    index={el.i}
                                    item={el}
                                    originalItem={items_.find(i => i.i === el.i) as TileProps}
                                    items={items}
                                    filterExpressions={filterExpressions}
                                    sortingExpressions={sortingExpressions}
                                    setPending={(p: boolean) => setPending({ ...pending, [el.i]: p })}
                                    setItems={(items: TileProps[]) => setItems(items)}
                                    updateItem={updateItem}
                                    updateInterface={updateInterface}
                                />
                                {editable && <div className="flex gap-2 absolute top-3 right-5 z-10">
                                    <ActionButton
                                        className="no-drag cursor-pointer"
                                        onClick={() => {
                                            setItems([...items.map(
                                                it => it.i == el.i ? { ...it, visible: false } : it
                                            )]);
                                        }}
                                        icon={<EyeOff />}
                                        tooltip={"Hide"}
                                        variant="outline"
                                    />
                                    <ActionButton
                                        className="no-drag cursor-pointer"
                                        onClick={() => setCopied(el.i)}
                                        icon={<Copy />}
                                        tooltip={"Copy"}
                                        variant="outline"
                                    />
                                    <ActionButton
                                        className="cursor-grab"
                                        icon={<Grip />}
                                        tooltip="Drag"
                                        variant="outline"
                                    />
                                    <ActionButton
                                        className="no-drag cursor-pointer"
                                        onClick={() => setMaxTile(el.i)}
                                        icon={<Maximize2 />}
                                        tooltip="Maximize"
                                        variant="outline"
                                    />
                                    <ActionButton
                                        className="no-drag remove cursor-pointer"
                                        onClick={() => setItems([...items.filter(item => item.i != el.i)])}
                                        icon={<X />}
                                        tooltip="Remove"
                                        variant="outline"
                                    />
                                </div>}
                                <Badge
                                    className="no-drag absolute top-3 left-3 z-10 cursor-pointer"
                                    variant="primary"
                                    onClick={() => editable ? setEditTile(el.i) : undefined}
                                >
                                    {el.i}
                                </Badge>
                            </div>
                        );
                    })}
                </ResponsiveReactGridLayout>
            </TabsContent>
            <TabsContent value="Interface_2" className="w-full h-[calc(100%-50px)] tutorial-plot-pane">
                {/* <LogsPlot logs={plotLogs} fields={fields} /> */}
                <div className="text-center">text2</div>
            </TabsContent>
        </Tabs>
        {maxTile && <Dialog open={true} onOpenChange={() => setMaxTile(undefined)}>
            <DialogContent className="min-w-full h-full">
                <div className="p-4 overflow-auto">
                    <Card
                        editable={editable}
                        project={project}
                        pending={maxTileItem.tab == "Table" ? pending[maxTileItem.i] : false}
                        columnTypes={columnTypes}
                        tableNames={tableNames}
                        tableData={tableData}
                        fields={fields}
                        plotData={plotData}
                        logsActions={logsActions}
                        index={maxTileItem.i}
                        item={maxTileItem}
                        originalItem={items_.find(i => i.i === maxTileItem.i) as TileProps}
                        items={items}
                        filterExpressions={filterExpressions}
                        sortingExpressions={sortingExpressions}
                        setPending={(p: boolean) => setPending({ ...pending, [maxTileItem.i]: p })}
                        setItems={(items: TileProps[]) => setItems(items)}
                        updateItem={updateItem}
                        updateInterface={updateInterface}
                    />
                </div>
                <Badge
                    className="no-drag absolute top-3 left-3 z-10 cursor-pointer"
                    variant="primary"
                    onClick={() => editable ? setEditTile(maxTileItem.i) : undefined}
                >
                    {maxTileItem.i}
                </Badge>
            </DialogContent>
        </Dialog>}
        {editable && editTile && <Dialog open={true} onOpenChange={() => {
            setEditTile(undefined);
            setNewTileName(undefined);
        }}>
            <DialogContent className="w-1/6">
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
                        className="no-drag remove cursor-pointer"
                        onClick={() => saveTileName()}
                        text="Save"
                        tooltip="Remove"
                        variant="primary"
                    />
                </div>
            </DialogContent>
        </Dialog>}
    </div>);
};

export default CardGrid;
