"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "./Card";
import { TableArguments, LogFieldsResponseProps } from "@/types/evals/logs";
import { FileProps, ResponseProps } from "@/types/common";
import { Context, ContextActions, Interface, InterfaceActions, ItemType, LogsActions, PlotDataProps, ProjectsActions, TableDataProps, TileProps } from "@/types/evals/grid";
import ActionButton from "../Common/Buttons/Action";
import { Check, Clipboard, Copy, Eye, EyeOff, Grip, ListRestart, Loader2, Maximize2, Plus, RefreshCw, Save, Trash, TriangleAlert, X } from "lucide-react";
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
import { v4 as uuidv4 } from "uuid";
import Cookies from "js-cookie";

const ResponsiveReactGridLayout = WidthProvider(Responsive);


const CardGrid = ({
    project_,
    projects,
    contexts,
    interfaces_,
    tableNames,
    tableData,
    tableArguments,
    fields,
    plotData,
    savedInterface,
    interfaceCreated,
    interface_1,
    filterExpressions,
    sortingExpressions,
    projectActions,
    logsActions,
    contextActions,
    interfaceActions,
}: {
    project_: string | null,
    projects: string[] | undefined,
    contexts: Context[],
    interfaces_: string[],
    tableNames: string[]
    tableData: TableDataProps,
    tableArguments: TableArguments,
    fields: LogFieldsResponseProps,
    plotData: PlotDataProps,
    savedInterface: Interface,
    interfaceCreated: boolean,
    interface_1: string | null,
    filterExpressions: (string | null)[],
    sortingExpressions: (string | null)[],
    projectActions: ProjectsActions,
    logsActions: LogsActions,
    contextActions: ContextActions,
    interfaceActions: InterfaceActions,
}) => {
    const router = useRouter();

    // layout structure
    const [context, setContext] = useState<string>();
    const [items, setItems] = useState<TileProps[]>([]);
    const [newCounter, setNewCounter] = useState(0);
    const [tempInterfaceCreated, setTempInterfaceCreated] = useState(false);

    // modals
    const [saveDialog, setSaveDialog] = useState(false);
    const [maxTile, setMaxTile] = useState<string>();
    const [editTile, setEditTile] = useState<string>();
    const [newTileName, setNewTileName] = useState<string>();

    // save and reset buttons
    const [saveSuccess, setSaveSuccess] = useState<boolean>();
    const [resetting, setResetting] = useState<boolean>(false);

    // modes, hover and copy button
    const [mode, setMode] = useState<"edit" | "interactive" | "dashboard">("edit");
    const [copied, setCopied] = useState<string>();

    // data fields
    const [interfaces, setInterfaces] = useState(interfaces_);
    const [interface_, setInterface] = useQueryState("interface", { shallow: false });
    const [project, setProject] = useQueryState("project", { shallow: false });
    const [interface_2, setInterface_2] = useState(interface_ || "");

    // pending fields
    const [tilePending, setTilePending] = useState<{ [key: string]: boolean }>(
        Object.fromEntries(Object.keys(tableData).map(k => [k, false]))
    );
    const [dataPending, setDataPending] = useState(false);
    const [pending, setPending] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // other variables
    const gridRef = useRef<HTMLDivElement>(null);
    const anyTilePending = Object.entries(tilePending).some(([_, value]) => value);
    const maxTileItem = items.find(item => item.i == maxTile) as TileProps;
    const hiddenItems = items.filter(item => !item.visible);
    const data = (projects || []).map((p) => ({ path: p, type: "file" }));

    // update any attribute of an item
    const updateItem = (item: TileProps, attrName: ItemType) => {
        return (newValue: any | undefined) => {
            item[attrName] = newValue;
            setItems([...items.map((i) => (i.i === item.i ? item : i))]);
        }
    }

    // update interface
    const updateInterface = (
        savedInterface: Interface | null = null,
    ) => {
        const context_1 = savedInterface != null ? savedInterface?.context : context;
        const items_1 = savedInterface?.items || items;
        const newCounter_1 = savedInterface?.new_counter || newCounter;
        if (interface_ && project && interface_ == interface_1 && project == project_ && !pending) {
            if (tempInterfaceCreated)
                return interfaceActions.update(interface_, project, context_1, items_1, newCounter_1, undefined, true);
            else
                return interfaceActions.create(interface_, project, context_1, items_1, newCounter_1, true);
        }
        return Promise.reject();
    }

    // edit tile name
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

    // get latest interface
    const getLatestInterface = () => {
        interfaceActions.get(project as string, true).then((ints: Interface[]) => {
            const currentInterface = ints.find(i => i.name == interface_);
            setContext(currentInterface?.context);
            setItems(currentInterface?.items || []);
            setNewCounter(currentInterface?.new_counter || 0);
            setTempInterfaceCreated(Boolean(currentInterface));
            setPending(false);
            setInterfaces(ints.map(int => int.name).sort());
            setInterface_2(interface_ as string);
        });
    }

    // set the items and new counter whenever project or interface changes
    useEffect(() => {
        if (project && interface_) {
            const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            Cookies.set("project", project, { expires: expirationDate });
            Cookies.set("interface", interface_, { expires: expirationDate });
            getLatestInterface();
        }
        else if (!project)
            Cookies.remove("project");
        else if (!interface_)
            Cookies.remove("interface");
    }, [project, interface_]);

    // update interface whenever items change
    useEffect(() => {
        updateInterface();
    }, [items]);

    // trigger update when table data changes (server reloaded)
    useEffect(() => {
        setDataPending(false);
        setRefreshing(false);
        setTilePending(Object.fromEntries(Object.keys(tableData).map(k => [k, false])));
        if ((pending || resetting) && project && interface_)
            getLatestInterface();
        setResetting(false);
    }, [tableData]);

    // scroll to the bottom whenever new items are added
    useEffect(() => {
        gridRef.current?.scrollTo({
            top: gridRef.current?.scrollHeight,
            behavior: "smooth",
        });
    }, [newCounter]);

    // end success green after 3 seconds
    useEffect(() => { setTimeout(() => setSaveSuccess(undefined), 3000); }, [saveSuccess]);

    // icons, variants and disabled variables for saving and resetting
    const saveIcon = saveSuccess ? <Check /> : saveSuccess == false ? <TriangleAlert /> : <Save />;
    const resetIcon = resetting ? <Loader2 className="animate-spin" /> : <ListRestart />;
    const variant = saveSuccess == false ? "destructive" : "outline";
    const disabled = JSON.stringify({ items: savedInterface?.items }) == JSON.stringify({ items });

    return (<div className="w-full h-full overflow-auto" ref={gridRef}>
        <Tabs value={interface_ || undefined} onValueChange={(value: string | undefined) => {
            setPending(true);
            setDataPending(true);
            setInterface_2(value || "");
            setInterface(value || null);
        }} className="w-full tutorial-details-panel">
            <div className="sticky top-0 z-10 bg-background shadow-sm p-2 flex justify-between gap-4">
                <div className="w-fit gap-2 flex flex-row items-center px-4">
                    <FileDirectory
                        data={data}
                        renamingFunction={projectActions.rename}
                        setterFunction={(proj: FileProps | undefined) => {
                            const newProj = proj ? proj.path : null;
                            setPending(true);
                            setDataPending(true);
                            setInterfaces([]);
                            setInterface_2("");
                            setInterface(null);
                            setProject(newProj);
                        }}
                        type="Projects"
                        defaultValue={project || undefined}
                    />
                    {project && (
                        <div className="flex flex-row gap-2">
                            <CloseProject
                                onClick={() => {
                                    setPending(true);
                                    setDataPending(true);
                                    setInterface(null);
                                    setInterfaces([]);
                                    setInterface_2("");
                                    setProject(null);
                                }}
                            />
                            <DeleteDialog
                                type="project"
                                resource={project}
                                deletingFunction={projectActions.delete}
                                variant="outline"
                                onDelete={() => {
                                    setPending(true);
                                    setDataPending(true);
                                    setInterface(null);
                                    setInterfaces([]);
                                    setInterface_2("");
                                    setProject(null);
                                }}
                            />
                        </div>
                    )}
                    {projects && <CreateProject creationFunction={projectActions.create} paths={projects} />}
                    <ActionButton
                        variant="outline"
                        icon={refreshing ? <RefreshCw className="animate-spin" /> : <RefreshCw />}
                        tooltip={"Refresh Interface"}
                        disabled={pending || dataPending}
                        onClick={() => {
                            setRefreshing(true);
                            router.refresh();
                        }}
                    />
                </div>

                {project && <div className="flex gap-4 px-4">
                    {interfaces.length > 0 && <TabsList className="rounded-md justify-between">
                        <div className="flex flex-row gap-3">
                            {interfaces.map((int_, idx) => <TabsTrigger
                                key={idx}
                                value={int_}
                                className="flex flex-row gap-2 data-[state=active]:text-accent"
                            >
                                {interface_ == int_ ? <Input
                                    value={interface_2}
                                    disabled={pending || dataPending}
                                    onInput={(event: React.ChangeEvent<HTMLInputElement>) => setInterface_2(event.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && int_ != interface_2) {
                                            interfaceActions.update(
                                                int_, project, context, items, newCounter, interface_2, true
                                            ).then(() => {
                                                interfaceActions.update(
                                                    int_, project, context, items, newCounter, interface_2, false
                                                ).then(() => {
                                                    setPending(true);
                                                    setInterface(interface_2);
                                                });
                                            });
                                        }
                                    }}
                                    className="px-0 h-5 w-20 bg-transparent border-none outline-none focus:outline-none focus:border-none focus-visible:ring-0"
                                /> : <div className="h-5 w-20 text-center">{int_}</div>}
                            </TabsTrigger>)}
                        </div>
                    </TabsList>}
                    <div className="flex gap-2">
                        <ActionButton
                            variant="outline"
                            icon={<Plus />}
                            tooltip={"Add new interface"}
                            disabled={pending}
                            onClick={() => {
                                const newInterfaceName = `interface_${uuidv4().slice(0, 2)}`;
                                interfaceActions.create(
                                    newInterfaceName, project, context, [], 0, true
                                ).then(() => {
                                    interfaceActions.create(
                                        newInterfaceName, project, context, [], 0, false
                                    ).then(() => {
                                        setInterfaces([...interfaces, newInterfaceName]);
                                        setTilePending(Object.fromEntries(Object.keys(tableData).map(k => [k, true])));
                                        setInterface(newInterfaceName);
                                        setInterface_2(newInterfaceName);
                                    });
                                })
                            }}
                        />
                        <ActionButton
                            variant="outline"
                            icon={<Trash />}
                            tooltip={interfaces.length <= 1 ? "Projects need to have at least one interface" : "Delete current active interface"}
                            disabled={pending || interfaces.length <= 1}
                            onClick={() => interfaceActions.delete(interface_ as string, project, true).then(() => {
                                setPending(true);
                                interfaceActions.delete(interface_ as string, project, false).then(() => {
                                    setInterfaces(interfaces.filter(i => i != interface_));
                                    setInterface(null);
                                    setInterface_2("");
                                })
                            })}
                        />
                    </div>
                </div>}

                <div className="flex gap-2 items-center px-4">
                    <BaseDropdown
                        button={<ActionButton
                            tooltip="Select Table"
                            text={context || "Select Context"}
                            variant="outline"
                            size="sm"
                        />}
                    >
                        {[...contexts, { name: "None", description: "" }].map((context, idx) => <DropdownMenuItem
                            key={idx}
                            onSelect={() => {
                                const newContext = context.name == "None" ? undefined : context.name;
                                updateInterface({
                                    name: interface_ as string,
                                    project: project_ as string,
                                    context: newContext,
                                    items,
                                    new_counter: newCounter
                                }).then(() => {
                                    setContext(newContext);
                                    setDataPending(true);
                                    router.refresh();
                                });
                            }}
                            className="w-64 no-drag"
                        >
                            {context.name}
                        </DropdownMenuItem>)}
                    </BaseDropdown>
                    <ActionButton
                        className="transition-all"
                        tooltip={!project ? "Select a project first" : "Save Interface"}
                        icon={saveIcon}
                        variant={variant}
                        disabled={disabled || anyTilePending || !project || !interface_ || pending}
                        onClick={async () => setSaveDialog(true)}
                    />
                    <ActionButton
                        className="transition-all"
                        tooltip={!project ? "Select a project first" : "Return to last saved interface"}
                        icon={resetIcon}
                        variant="outline"
                        disabled={disabled || anyTilePending || !project || pending}
                        onClick={async () => updateInterface(savedInterface).then(() => {
                            setResetting(true);
                            setMode("edit");
                            router.refresh();
                        })}
                    />
                    <ActionButton
                        variant="outline"
                        icon={<Plus />}
                        text="Add Tile"
                        tooltip={(mode != "edit" || !project) ? "Select a project first" : "Add new tile"}
                        disabled={mode != "edit" || !project || pending}
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
                            disabled={hiddenItems.length == 0 || pending}
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
                        disabled={!copied || pending}
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
                    <ActionButton
                        tooltip="Switch mode"
                        text={mode}
                        variant="outline"
                        onClick={() => setMode(
                            mode == "edit"
                                ? "interactive"
                                : mode == "interactive"
                                    ? "dashboard"
                                    : "edit"
                        )}
                    />
                </div>
            </div>
            {interfaces.length == 0 ? (project && pending) ? <div className="flex justify-center">
                <Loader2 className="animate-spin my-36" />
            </div> : !project ? <div className="mt-4 flex justify-center font-semibold">Please select a project</div> : <></> : interfaces.map((int_, idx) => <TabsContent key={idx} value={int_} className="tutorial-selection-pane px-3">
                {pending
                    ? <div className="flex justify-center"><Loader2 className="animate-spin my-36" /></div>
                    : interface_1 == int_ ? <ResponsiveReactGridLayout
                        key={idx}
                        onLayoutChange={(newLayout) => {
                            if (!pending) {
                                const updatedItems = newLayout.map((item) => {
                                    const originalItem = items.find(i => i.i === item.i);
                                    return { ...originalItem, ...item };
                                });
                                setItems([...updatedItems]);
                            }
                            else
                                setPending(false);
                        }}
                        className="layout interactive-grid flex-1"
                        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                        rowHeight={100}
                        isDraggable={mode == "edit"}
                        isResizable={mode == "edit"}
                        draggableCancel=".no-drag"
                        resizeHandles={["e", "w", "s", "n", "se", "sw", "ne", "nw"]}
                    >
                        {items.map(el => {
                            return (
                                <div
                                    key={el.i}
                                    data-grid={el}
                                    className="relative rounded-lg"
                                    hidden={!el.visible}
                                >
                                    <Card
                                        mode={mode}
                                        project={project || undefined}
                                        pending={pending || dataPending || (el.tab == "Table" ? tilePending[el.i] : false)}
                                        fields={fields}
                                        tableNames={tableNames}
                                        tableData={tableData}
                                        plotData={plotData}
                                        tableArguments={tableArguments}
                                        logsActions={logsActions}
                                        contextActions={contextActions}
                                        index={el.i}
                                        item={el}
                                        items={items}
                                        filterExpressions={filterExpressions}
                                        sortingExpressions={sortingExpressions}
                                        setPending={(p: boolean) => setTilePending({ ...tilePending, [el.i]: p })}
                                        updateItem={updateItem}
                                        updateInterface={updateInterface}
                                    />
                                    <div className={"w-full px-2 opacity-0 hover:opacity-100 transition-all absolute -top-3 flex justify-between " + (mode == "edit" ? "h-20" : "h-10")}>
                                        <div className="mb-auto">
                                            <Badge
                                                className="no-drag cursor-pointer"
                                                variant="primary"
                                                onClick={() => mode == "edit" ? setEditTile(el.i) : undefined}
                                            >
                                                {el.i}
                                            </Badge>
                                        </div>
                                        <div className="flex gap-2 mb-auto">
                                            <ActionButton
                                                className="no-drag cursor-pointer hover:z-10"
                                                onClick={() => setMaxTile(el.i)}
                                                icon={<Maximize2 />}
                                                tooltip="Maximize"
                                                variant="outline"
                                            />
                                            {mode == "edit" && <>
                                                <ActionButton
                                                    className="no-drag cursor-pointer hover:z-10"
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
                                                    className="no-drag cursor-pointer hover:z-10"
                                                    onClick={() => setCopied(el.i)}
                                                    icon={<Copy />}
                                                    tooltip={"Copy"}
                                                    variant="outline"
                                                />
                                                <ActionButton
                                                    className="cursor-grab hover:z-10"
                                                    icon={<Grip />}
                                                    tooltip="Drag"
                                                    variant="outline"
                                                />
                                                <ActionButton
                                                    className="no-drag remove cursor-pointer hover:z-10"
                                                    onClick={() => setItems([...items.filter(item => item.i != el.i)])}
                                                    icon={<X />}
                                                    tooltip="Remove"
                                                    variant="outline"
                                                />
                                            </>}
                                        </div>
                                    </div>
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
                        mode={mode}
                        project={project || undefined}
                        pending={pending || dataPending || (maxTileItem.tab == "Table" ? tilePending[maxTileItem.i] : false)}
                        tableNames={tableNames}
                        tableData={tableData}
                        tableArguments={tableArguments}
                        fields={fields}
                        plotData={plotData}
                        logsActions={logsActions}
                        contextActions={contextActions}
                        index={maxTileItem.i}
                        item={maxTileItem}
                        items={items}
                        filterExpressions={filterExpressions}
                        sortingExpressions={sortingExpressions}
                        setPending={(p: boolean) => setTilePending({ ...tilePending, [maxTileItem.i]: p })}
                        updateItem={updateItem}
                        updateInterface={updateInterface}
                    />
                </div>
                <Badge
                    className="no-drag absolute top-3 left-3 z-10 cursor-pointer"
                    variant="primary"
                    onClick={() => mode == "edit" ? setEditTile(maxTileItem.i) : undefined}
                >
                    {maxTileItem.i}
                </Badge>
            </DialogContent>
        </Dialog>}
        {mode == "edit" && editTile && <Dialog open={true} onOpenChange={() => {
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
                        tooltip="Save"
                        variant="primary"
                    />
                </div>
            </DialogContent>
        </Dialog>}
        {saveDialog && <Dialog open={true} onOpenChange={() => setSaveDialog(false)}>
            <DialogContent className="w-1/4">
                <div className="mt-4 flex flex-col gap-4">
                    <div>Are you sure you want to save the changes to <span className="font-semibold">
                        {interface_}
                    </span>?</div>
                    <div className="flex justify-end pr-2">
                        <ActionButton
                            className="w-fit no-drag remove cursor-pointer mr-0 justify-self-end"
                            onClick={async () => {
                                if (saveSuccess == undefined) {
                                    let response: ResponseProps | undefined = undefined;
                                    if (interfaceCreated)
                                        response = await interfaceActions.update(interface_ as string, project as string, context, items, newCounter, undefined, false);
                                    else
                                        response = await interfaceActions.create(interface_ as string, project as string, context, items, newCounter, false);
                                    if (response && "info" in response)
                                        setSaveSuccess(true);
                                    else
                                        setSaveSuccess(false);
                                    setSaveDialog(false);
                                    router.refresh();
                                }
                            }}
                            text="Save"
                            tooltip="Save"
                            variant="primary"
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>}
    </div>);
};

export default CardGrid;
