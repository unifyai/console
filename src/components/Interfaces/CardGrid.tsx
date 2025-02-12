"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "./Card";
import { TableArguments, LogFieldsResponseProps } from "@/types/evals/logs";
import { ResponseProps } from "@/types/common";
import { DerivedEntryActions, Context, ContextActions, Interface, InterfaceActions, ItemType, LogsActions, PlotDataProps, ProjectsActions, TableDataProps, TileProps } from "@/types/evals/grid";
import ActionButton from "../Common/Buttons/Action";
import { Copy, EyeOff, FocusIcon, Grip, Loader2, X } from "lucide-react";
import { WidthProvider, Responsive } from "react-grid-layout";
import { Badge } from "../UI/badge";
import { Dialog, DialogContent } from "../UI/dialog";
import { Input } from "../UI/input";
import { Tabs, TabsContent } from "../UI/tabs";
import { useQueryState } from "nuqs";
import Cookies from "js-cookie";
import FocusDialog from "./FocusDialog";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import DefaultProject from "./DefaultProject";
import InterfaceButtons from "./InterfaceButtons";
import InterfaceTabs from "./InterfaceTabs";
import ProjectButtons from "./ProjectButtons";

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
    tempInterfaceCreated_,
    interface_1,
    filterExpressions,
    sortingExpressions,
    projectActions,
    logsActions,
    derivedEntryActions,
    contextActions,
    interfaceActions,
}: {
    project_: string | null,
    projects: string[] | undefined,
    contexts: Context[],
    interfaces_: string[],
    tableNames: string[],
    tableData: TableDataProps,
    tableArguments: TableArguments,
    fields: LogFieldsResponseProps,
    plotData: PlotDataProps,
    savedInterface: Interface,
    interfaceCreated: boolean,
    tempInterfaceCreated_: boolean,
    interface_1: string | null,
    filterExpressions: (string | null)[],
    sortingExpressions: (string | null)[],
    projectActions: ProjectsActions,
    logsActions: LogsActions,
    derivedEntryActions: DerivedEntryActions,
    contextActions: ContextActions,
    interfaceActions: InterfaceActions
}) => {
    const router = useRouter();

    // layout structure
    const [context, setContext] = useState<string>();
    const [items, setItems] = useState<TileProps[]>([]);
    const [newCounter, setNewCounter] = useState(0);
    const [tempInterfaceCreated, setTempInterfaceCreated] = useState(tempInterfaceCreated_);

    // modals
    const [saveDialog, setSaveDialog] = useState(false);
    const [focusDialog, setFocusDialog] = useState(false);
    const [maxTiles, setMaxTiles] = useState<string[]>([]);
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
    const maxTileItems = maxTiles.map(tile => items.find(item => item.i == tile) as TileProps).concat(
        Array(2 - maxTiles.length).fill(undefined)
    );
    const hiddenItems = items.filter(item => !item.visible);
    const data = (projects || []).map((p) => ({ path: p, type: "file" }));

    // update any attribute of an item
    const updateItem = (item: TileProps, attrName: ItemType) => {
        return (newValue: any | undefined) => {
            item[attrName] = newValue;
            setItems([...items.map((i) => (i.i === item.i ? item : i))]);
        }
    }

    // update interface – preserves context functionality
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
                return interfaceActions.create(interface_, project, context_1, items_1, newCounter_1, true)
        }
        return Promise.reject();
    };

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
    };

    // get latest interface (including context)
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
    };

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

    // Only call updateInterface when items have truly changed.
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

    return (<div className="w-full h-full overflow-auto" ref={gridRef}>
        <Tabs value={interface_ || undefined} onValueChange={(value: string | undefined) => {
            setPending(true);
            setDataPending(true);
            setInterface_2(value || "");
            setInterface(value || null);
        }} className="w-full tutorial-details-panel">
            <div className="sticky top-0 z-10 bg-background shadow-sm p-2 flex justify-between gap-4">
                {/* Project dropdown and add/delete buttons */}
                <ProjectButtons
                    project={project}
                    projects={projects}
                    interfaces={interfaces}
                    data={data}
                    refreshing={refreshing}
                    pending={pending}
                    dataPending={dataPending}
                    projectActions={projectActions}
                    interfaceActions={interfaceActions}
                    setRefreshing={setRefreshing}
                    setPending={setPending}
                    setDataPending={setDataPending}
                    setInterfaces={setInterfaces}
                    setInterface_2={setInterface_2}
                    setInterface={setInterface}
                    setProject={setProject}
                />

                {/* Interface tabs and add/delete buttons */}
                {project && <InterfaceTabs
                    interface_={interface_}
                    interface_2={interface_2}
                    interfaces={interfaces}
                    project={project}
                    context={context}
                    items={items}
                    newCounter={newCounter}
                    tableData={tableData}
                    pending={pending}
                    dataPending={dataPending}
                    interfaceActions={interfaceActions}
                    setInterface={setInterface}
                    setInterface_2={setInterface_2}
                    setInterfaces={setInterfaces}
                    setPending={setPending}
                    setTilePending={setTilePending}
                />}

                {/* Interface buttons for focus, context, save, reset, add tile, etc. */}
                <InterfaceButtons
                    mode={mode}
                    project_={project_}
                    interface_={interface_}
                    project={project}
                    pending={pending}
                    anyTilePending={anyTilePending}
                    context={context}
                    contexts={contexts}
                    items={items}
                    newCounter={newCounter}
                    copied={copied}
                    resetting={resetting}
                    saveSuccess={saveSuccess}
                    hiddenItems={hiddenItems}
                    savedInterface={savedInterface}
                    setItems={setItems}
                    setNewCounter={setNewCounter}
                    setCopied={setCopied}
                    setResetting={setResetting}
                    setMode={setMode}
                    setFocusDialog={setFocusDialog}
                    setDataPending={setDataPending}
                    setContext={setContext}
                    setSaveDialog={setSaveDialog}
                    updateInterface={updateInterface}
                />
            </div>
            {interfaces.length == 0 ? (project && pending) ? <div className="flex justify-center">
                <Loader2 className="animate-spin my-36" />
            </div> : !project ? <DefaultProject
                projects={projects}
                logsActions={logsActions}
                projectActions={projectActions}
                interfaceActions={interfaceActions}
                setProject={setProject}
                setInterface={setInterface}
            /> : <></> : interfaces.map((int_, idx) => <TabsContent key={idx} value={int_} className="tutorial-selection-pane px-3">
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
                                        tableArguments={tableArguments}
                                        plotData={plotData}
                                        logsActions={logsActions}
                                        derivedEntryActions={derivedEntryActions}
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
                                                onClick={() => {
                                                    if (maxTiles.includes(el.i))
                                                        setMaxTiles(maxTiles.filter(t => t != el.i));
                                                    else {
                                                        const newMaxTiles = [...maxTiles, el.i];
                                                        if (newMaxTiles.length > 2)
                                                            newMaxTiles.shift();
                                                        setMaxTiles(newMaxTiles);
                                                    }
                                                }}
                                                icon={<FocusIcon />}
                                                tooltip="Add to Focus Pane"
                                                variant={maxTiles.includes(el.i) ? "primary" : "outline"}
                                            />
                                            {mode == "edit" && <>
                                                <ActionButton
                                                    className="no-drag cursor-pointer hover:z-10"
                                                    onClick={() => setItems([...items.map(
                                                        it => it.i == el.i ? { ...it, visible: false } : it
                                                    )])}
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
        {focusDialog && <Dialog open={true} onOpenChange={() => setFocusDialog(false)}>
            <DialogContent className="min-w-full h-full overflow-y-auto">
                <Suspense fallback={<SkeletonLoader />}>
                    <FocusDialog
                        maxTileItems={maxTileItems}
                        mode={mode}
                        project={project || undefined}
                        pending={pending}
                        dataPending={dataPending}
                        tilePending={tilePending}
                        setTilePending={setTilePending}
                        tableNames={tableNames}
                        tableData={tableData}
                        tableArguments={tableArguments}
                        fields={fields}
                        plotData={plotData}
                        logsActions={logsActions}
                        derivedEntryActions={derivedEntryActions}
                        contextActions={contextActions}
                        items={items}
                        filterExpressions={filterExpressions}
                        sortingExpressions={sortingExpressions}
                        updateItem={updateItem}
                        updateInterface={updateInterface}
                    />
                </Suspense>
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
                            tooltip=""
                            variant="primary"
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>}
    </div>);
};

export default CardGrid;
