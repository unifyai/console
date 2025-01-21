"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "./Card";
import { LogFieldsResponseProps } from "@/types/evals/logs";
import { FileProps, ResponseProps } from "@/types/common";
import { Interface, InterfaceActions, ItemType, LogsActions, PlotDataProps, ProjectsActions, TableDataProps, TileProps } from "@/types/evals/grid";
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
import { useQueryState } from "nuqs";
import LoadingScreen from "../LoadingScreen";

const ResponsiveReactGridLayout = WidthProvider(Responsive);


const CardGrid = ({
    projects,
    project_,
    interfaces,
    tableNames,
    tableData,
    fields,
    plotData,
    columnTypes,
    savedInterface,
    interface_1,
    items_,
    newCounter_,
    interfaceCreated,
    tempInterfaceCreated,
    filterExpressions,
    sortingExpressions,
    projectActions,
    logsActions,
    interfaceActions,
}: {
    projects: string[] | undefined,
    project_: string | null,
    interfaces: string[],
    tableNames: string[]
    tableData: TableDataProps,
    fields: LogFieldsResponseProps,
    plotData: PlotDataProps,
    columnTypes: { [key: string]: string },
    savedInterface: Interface | null,
    interface_1: string | null,
    items_: TileProps[],
    newCounter_: number,
    interfaceCreated: boolean,
    tempInterfaceCreated: boolean,
    filterExpressions: (string | null)[],
    sortingExpressions: (string | null)[],
    projectActions: ProjectsActions,
    logsActions: LogsActions,
    interfaceActions: InterfaceActions,
}) => {
    const router = useRouter();
    const [items, setItems] = useState<TileProps[]>(items_ ? [...items_.map(item => ({ ...item }))] : []);
    const [newCounter, setNewCounter] = useState(newCounter_ || 0);
    const [saveSuccess, setSaveSuccess] = useState<boolean>();
    const [resetting, setResetting] = useState<boolean>();
    const [editable, setEditable] = useState(true);
    const [interface_, setInterface] = useQueryState("interface", { shallow: false });
    const [project, setProject] = useQueryState("project", { shallow: false });
    const [pending, setPending] = useState<{ [key: string]: boolean }>(
        Object.fromEntries(Object.keys(tableData).map(k => [k, false]))
    );
    const [changedDuringReload, setChangedDuringReload] = useState(false);
    const [firstRender, setFirstRender] = useState(true);
    const [maxTile, setMaxTile] = useState<string>();
    const [editTile, setEditTile] = useState<string>();
    const [newTileName, setNewTileName] = useState<string>();
    const [copied, setCopied] = useState<string>();
    const gridRef = useRef<HTMLDivElement>(null);
    const anyPending = Object.entries(pending).some(([_, value]) => value);
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
        savedInterface: Interface | null = null,
    ) => {
        if (anyPending)
            setChangedDuringReload(true);
        const items_1 = savedInterface?.items || items;
        const newCounter_1 = savedInterface?.new_counter || newCounter;
        if (interface_ && project) {
            if (tempInterfaceCreated)
                return interfaceActions.update(interface_, project, items_1, newCounter_1, true);
            else
                return interfaceActions.create(interface_, project, items_1, newCounter_1, true);
        }
        return Promise.reject();
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
        if (interface_ && project && interface_ != interface_1 && project != project_) {
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
            updateInterface({ name: interface_, project, items: items_1, new_counter: newCounter }).then(
                () => { router.refresh(); }
            );
            setItems([...items_1]);
            setPending(Object.fromEntries(Object.keys(tableData).map(k => [k, true])));
        }
    }, [project, interface_]);

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
        setFirstRender(true);
        setProject(project_ || null);
        setInterface(interface_1 || null);
        setPending(Object.fromEntries(Object.keys(tableData).map(k => [k, false])));
        setResetting(false);
    }, [items_, project_, interface_1, newCounter_])

    useEffect(() => {
        setFirstRender(false);
    }, []);

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
        { items, new_counter: newCounter, project: project_, name: interface_1 }
    );

    return (<div className="w-full h-full overflow-auto p-3" ref={gridRef}>
        <Tabs value={interface_ || undefined} onValueChange={(value: string | undefined) => setInterface(value || null)} className="w-full tutorial-details-panel">
            <div className="mt-1 ml-4 mr-8 flex justify-between gap-4">
                <div className="w-fit gap-2 flex flex-row items-center">
                    <FileDirectory
                        data={data}
                        renamingFunction={projectActions.rename}
                        setterFunction={(proj: FileProps | undefined) => {
                            const newProj = proj ? proj.path : null;
                            resetParamsStates();
                            setProject(newProj);
                        }}
                        type="Projects"
                        defaultValue={project || undefined}
                    />
                    {project && (
                        <div className="flex flex-row gap-2">
                            <CloseProject
                                onClick={() => {
                                    resetParamsStates();
                                    setProject(null);
                                }}
                            />
                            <DeleteDialog
                                type="project"
                                resource={project}
                                deletingFunction={projectActions.delete}
                                variant="outline"
                                onDelete={() => {
                                    resetParamsStates();
                                    setProject(null);
                                }}
                            />
                        </div>
                    )}
                    {projects && <CreateProject creationFunction={projectActions.create} paths={projects} />}
                </div>

                {project && <div className="flex gap-4">
                    <TabsList className="rounded-md justify-between">
                        <div className="flex flex-row gap-3">
                            {interfaces.map((interface_, idx) => <TabsTrigger
                                key={idx}
                                value={interface_}
                                className="flex flex-row gap-2 data-[state=active]:text-accent"
                            >
                                {interface_}
                            </TabsTrigger>)}
                        </div>
                    </TabsList>
                    <ActionButton
                        variant="outline"
                        icon={<Plus />}
                        tooltip={"Add new interface"}
                        onClick={() => interfaceActions.create(
                            `interface_${interfaces.length + 1}`,
                            project,
                            [
                                {
                                    "i": "Tile_0",
                                    "x": 0,
                                    "y": 0,
                                    "w": 6,
                                    "h": 8,
                                    "tab": "Table",
                                    "moved": false,
                                    "static": false,
                                    "visible": true,
                                },
                                {
                                    "i": "Tile_1",
                                    "x": 6,
                                    "y": 0,
                                    "w": 6,
                                    "h": 4,
                                    "tab": "View",
                                    "moved": false,
                                    "static": false,
                                    "visible": true,
                                },
                                {
                                    "i": "Tile_2",
                                    "x": 6,
                                    "y": 4,
                                    "w": 6,
                                    "h": 4,
                                    "tab": "Plot",
                                    "moved": false,
                                    "static": false,
                                    "visible": true,
                                },
                            ],
                            3,
                            true
                        ).then(() => {
                            setPending(Object.fromEntries(Object.keys(tableData).map(k =>  [k, true])));
                            setInterface(`interface_${interfaces.length + 1}`);
                        })}
                    />
                </div>}

                <div className="flex gap-2 items-center">
                    <ActionButton
                        className="transition-all"
                        tooltip={!project ? "Select a project first" : "Save Interface"}
                        icon={saveIcon}
                        variant={variant}
                        disabled={disabled || anyPending || !project || !interface_}
                        onClick={async () => {
                            if (saveSuccess == undefined) {
                                let response: ResponseProps | undefined = undefined;
                                if (interfaceCreated)
                                    response = await interfaceActions.update(interface_ as string, project as string, items, newCounter, false);
                                else
                                    response = await interfaceActions.create(interface_ as string, project as string, items, newCounter, false);
                                if (response && "info" in response)
                                    setSaveSuccess(true);
                                else
                                    setSaveSuccess(false);
                            }
                        }}
                    />
                    <ActionButton
                        className="transition-all"
                        tooltip={!project ? "Select a project first" : "Return to last saved interface"}
                        icon={resetIcon}
                        variant="outline"
                        disabled={disabled || anyPending || !project}
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
                        tooltip={(!editable || !project) ? "Select a project first" : "Add new tile"}
                        disabled={!editable || !project}
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
            {interfaces.map((interface_, idx) => <TabsContent key={idx} value={interface_} className="tutorial-selection-pane">
                {interface_1 == interface_ ? <ResponsiveReactGridLayout
                    key={idx}
                    onLayoutChange={(newLayout) => {
                        if (!firstRender) {
                            const updatedItems = newLayout.map((item) => {
                                const originalItem = items.find(i => i.i === item.i);
                                return { ...originalItem, ...item };
                            });
                            setItems([...updatedItems]);
                        }
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
                                    project={project || undefined}
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
                </ResponsiveReactGridLayout> : <div key={idx} className="text-center flex justify-center">
                    <Loader2 className="animate-spin my-36" />
                </div>}
            </TabsContent>)}
        </Tabs>
        {maxTile && <Dialog open={true} onOpenChange={() => setMaxTile(undefined)}>
            <DialogContent className="min-w-full h-full">
                <div className="p-4 overflow-auto">
                    <Card
                        editable={editable}
                        project={project || undefined}
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
