"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "./Card";
import { TableArguments } from "@/types/evals/logs";
import { ResponseProps } from "@/types/common";
import { DerivedEntryActions, Context, ContextActions, Interface, InterfaceActions, ItemType, LogsActions, FieldsActions, PlotDataProps, ProjectsActions, TableDataProps, TileProps } from "@/types/evals/grid";
import ActionButton from "../Common/Buttons/Action";
import { Braces, Copy, EyeOff, Grid2x2, Grip, Loader2, Maximize2, X } from "lucide-react";
import { WidthProvider, Responsive } from "react-grid-layout";
import { Badge } from "../UI/badge";
import { Dialog, DialogContent } from "../UI/dialog";
import { Tabs, TabsContent } from "../UI/tabs";
import { useQueryState } from "nuqs";
import Cookies from "js-cookie";
import FocusDialog from "./FocusDialog";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import DefaultProject from "./DefaultProject";
import InterfaceButtons from "./InterfaceButtons";
import InterfaceTabs from "./InterfaceTabs";
import ProjectButtons from "./ProjectButtons";
import EditTileName from "./EditTileName";
import Tooltip from "../Common/Misc/Tooltip";
import ContextSelector from "./Table/Content/ContextSelector";

import { useInterfaceContext } from "@/components/Providers/Stores/InterfaceStoreProvider";

const ResponsiveReactGridLayout = WidthProvider(Responsive);

const CardGrid = ({
    project_,
    projects,
    contexts,
    interfaces_,
    tableNames,
    tableData,
    tableArguments,
    plotData,
    savedInterface,
    interfaceCreated,
    tempInterfaceCreated,
    interface_1,
    filterExpressions,
    sortingExpressions,
    groupingExpressions,
    groupSortingExpressions,
    limit,
    offsets,
    projectActions,
    logsActions,
    fieldsActions,
    derivedEntryActions,
    interfaceActions,
}: {
    project_: string | null,
    projects: string[] | undefined,
    contexts: Context[],
    interfaces_: string[],
    tableNames: string[],
    tableData: TableDataProps,
    tableArguments: TableArguments,
    plotData: PlotDataProps,
    savedInterface: Interface,
    interfaceCreated: boolean,
    tempInterfaceCreated: boolean,
    interface_1: string | null,
    filterExpressions: (string | null)[],
    sortingExpressions: (string | null)[],
    groupingExpressions: (string | null)[],
    groupSortingExpressions: (string | null)[],
    limit: number,
    offsets: number[],
    projectActions: ProjectsActions,
    logsActions: LogsActions,
    fieldsActions: FieldsActions,
    derivedEntryActions: DerivedEntryActions,
    contextActions: ContextActions,
    interfaceActions: InterfaceActions
}) => {
    const router = useRouter();

    // Replace local React states with calls to the interface store.
    // we retrieve and set them using `useInterfaceContext`.

    const setTableData = useInterfaceContext((s) => s.setTableData);
    const setTempInterfaceCreated = useInterfaceContext((s) => s.setTempInterfaceCreated);
    const setInterfaces = useInterfaceContext((s) => s.setInterfaces);
    const setProjects = useInterfaceContext((s) => s.setProjects);

    useEffect(() => {
        if (tableData) {
          setTableData((prev) => ({ ...prev, ...tableData }));
        }
        if (typeof tempInterfaceCreated === "boolean") {
          setTempInterfaceCreated(tempInterfaceCreated);
        }
        if (interfaces_) {
          setInterfaces(interfaces_);
        }
        if (projects) {
          setProjects(projects);
        }
      }, [
        tableData,
        tempInterfaceCreated,
        interfaces_,
        projects,
        setTableData,
        setTempInterfaceCreated,
        setInterfaces,
        setProjects
      ]);

    const context = useInterfaceContext((s) => s.context);
    const setContext = useInterfaceContext((s) => s.setContext);

    const columnContext = useInterfaceContext((s) => s.columnContext);
    const setColumnContext = useInterfaceContext((s) => s.setColumnContext);

    const items = useInterfaceContext((s) => s.items);
    const setItems = useInterfaceContext((s) => s.setItems);

    const newCounter = useInterfaceContext((s) => s.newCounter);
    const setNewCounter = useInterfaceContext((s) => s.setNewCounter);

    const saveDialog = useInterfaceContext((s) => s.saveDialog);
    const setSaveDialog = useInterfaceContext((s) => s.setSaveDialog);

    const focusDialog = useInterfaceContext((s) => s.focusDialog);
    const setFocusDialog = useInterfaceContext((s) => s.setFocusDialog);

    const maxTiles = useInterfaceContext((s) => s.maxTiles);
    const setMaxTiles = useInterfaceContext((s) => s.setMaxTiles);

    const editTile = useInterfaceContext((s) => s.editTile);
    const setEditTile = useInterfaceContext((s) => s.setEditTile);

    // save and reset buttons
    const saveSuccess = useInterfaceContext((s) => s.saveSuccess);
    const setSaveSuccess = useInterfaceContext((s) => s.setSaveSuccess);

    const resetting = useInterfaceContext((s) => s.resetting);
    const setResetting = useInterfaceContext((s) => s.setResetting);

    // modes, hover and copy button
    const edit = useInterfaceContext((s) => s.edit);
    const setCopied = useInterfaceContext((s) => s.setCopied);
    const deleting = useInterfaceContext((s) => s.deleting);
    const setDeleting = useInterfaceContext((s) => s.setDeleting);

    // data fields
    const [interface_, setInterface] = useQueryState("tab", { shallow: false });
    const [project, setProject] = useQueryState("project", { shallow: false });

    // pending fields
    const setTilePending = useInterfaceContext((s) => s.setTilePending);

    const dataPending = useInterfaceContext((s) => s.dataPending);
    const setDataPending = useInterfaceContext((s) => s.setDataPending);

    const pending = useInterfaceContext((s) => s.pending);
    const setPending = useInterfaceContext((s) => s.setPending);

    const refreshing = useInterfaceContext((s) => s.refreshing);
    const setRefreshing = useInterfaceContext((s) => s.setRefreshing);

    // other variables
    const gridRef = useRef<HTMLDivElement>(null);
    const maxTileItems: [TileProps | undefined, TileProps | undefined] = maxTiles.map(
        tile => items.find(item => item.i == tile)
    ) as [TileProps | undefined, TileProps | undefined];
    const data = (projects || []).map((p) => ({ path: p, type: "file" }));

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

    // get latest interface (including context)
    const getLatestInterface = () => {
        interfaceActions.get(project as string, true).then((ints: Interface[]) => {
            const currentInterface = ints.find(i => i.name == interface_);
            setContext(currentInterface?.context);
            setItems(currentInterface?.items.map(item => ({
                ...item,
                context: contexts.find(
                    ctx => ctx.name == currentInterface?.context
                )?.name ?? item.context
            })) || []);
            setNewCounter(currentInterface?.new_counter || 0);
            setTempInterfaceCreated(Boolean(currentInterface));
            setPending(false);
            setInterfaces(ints.map(int => int.name).sort());
        });
    };

    // set the items and new counter whenever project or interface changes
    useEffect(() => {
        if (project && interface_) {
            const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            Cookies.set("project", project, { expires: expirationDate });
            Cookies.set("tab", interface_, { expires: expirationDate });
            getLatestInterface();
        }
        else if (!project)
            Cookies.remove("project");
        else if (!interface_)
            Cookies.remove("tab");
    }, [project, interface_]);

    // Only call updateInterface when items have truly changed.
    useEffect(() => {
        updateInterface();
    }, [items, context]);

    // trigger update when table data changes (server reloaded)
    useEffect(() => {
        setTimeout(() => {
            setDataPending(false);
            setRefreshing(false);
            setTilePending(Object.fromEntries(Object.keys(tableData).map(k => [k, false])));
            if ((pending || resetting) && project && interface_)
                getLatestInterface();
            setResetting(false);
        }, 1500);
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

    const handleLayoutChange = (newLayout: any[]) => {
        if (!pending) {
            const updatedItems = newLayout.map((item) => {
                const originalItem = items.find(i => i.i === item.i);
                return { ...originalItem, ...item };
            });
            setItems([...updatedItems]);
        } else {
            setPending(false);
        }
    };

    const renderGridContent = (idx: number, int_: string) => {
        if (pending) {
            return (
                <div className="flex justify-center">
                    <Loader2 className="animate-spin my-36" />
                </div>
            );
        }

        if (interface_1 != int_) {
            return (
                <div key={idx} className="text-center flex justify-center">
                    <Loader2 className="animate-spin my-36" />
                </div>
            );
        }
    
        return (
            <ResponsiveReactGridLayout
                key={idx}
                onLayoutChange={handleLayoutChange}
                className="layout interactive-grid flex-1"
                cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
                rowHeight={110}
                margin={[0, 0]}
                containerPadding={[0, 0]}
                isDraggable={edit}
                isResizable={edit}
                draggableHandle=".drag"
                resizeHandles={["e", "w", "s", "n", "se", "sw", "ne", "nw"]}
            >
                {items.map(el => (
                    <div
                        key={el.i}
                        data-grid={el}
                        className="relative"
                        hidden={!el.visible}
                        onClick={(e) => e.stopPropagation()}
                    >
                         <Card
                            index={el.i}
                            project={project || undefined}
                            contexts={contexts}
                            context={context}
                            tableNames={tableNames}
                            tableArguments={tableArguments}
                            plotData={plotData}
                            logsActions={logsActions}
                            fieldsActions={fieldsActions}
                            derivedEntryActions={derivedEntryActions}
                            filterExpressions={filterExpressions}
                            sortingExpressions={sortingExpressions}
                            groupingExpressions={groupingExpressions}
                            groupSortingExpressions={groupSortingExpressions}
                            limit={limit}
                            offsets={offsets}
                            updateInterface={updateInterface}
                        />
                        <div className={"w-full px-2 transition-all absolute -top-2 flex justify-between " + (edit ? "h-16" : "h-10")}>
                            <div className="mb-auto flex gap-2 ml-1">
                                <Tooltip content="Tile Type">
                                    <Badge
                                        className="cursor-pointer text-sm font-normal mb-1"
                                        variant="primary"
                                        onClick={() => edit ? setEditTile(el.i) : undefined}
                                    >
                                        {el.i}
                                    </Badge>
                                </Tooltip>
                                {el.context && el.tab == "Table" && <ContextSelector
                                    index={el.i || ""}
                                    contexts={contexts}
                                    context={context}
                                    button={
                                        <Tooltip content="Context">
                                            <Badge variant="primary" className="flex gap-1 text-sm font-normal" role="button" aria-label="Open Menu" tabIndex={0}>
                                                <Braces size={18} />
                                                {el.context}
                                            </Badge>
                                        </Tooltip>
                                    }
                                />}
                                {(el.column_context) && el.tab == "Table" && <ContextSelector
                                    index={el.i || ""}
                                    contexts={contexts}
                                    context={context}
                                    button={<Tooltip content="Column Context">
                                        <Badge variant="primary" className="flex gap-1 text-sm font-normal" role="button" aria-label="Open Menu" tabIndex={0}>
                                            <Grid2x2 size={18} />
                                            {el.column_context}
                                        </Badge>
                                    </Tooltip>}
                                />}
                            </div>
                            <div className="flex-1 flex justify-end gap-2 mb-auto opacity-0 hover:opacity-100">
                                <ActionButton
                                    className="cursor-pointer hover:z-10"
                                    onClick={() => {
                                        if (!maxTiles.includes(el.i)) {
                                            setMaxTiles([el.i, maxTiles[0] || maxTiles[1]]);
                                        }
                                        setFocusDialog(true);
                                    }}
                                    icon={<Maximize2 />}
                                    tooltip="Open in Focus Pane"
                                    variant={maxTiles.includes(el.i) ? "primary" : "outline"}
                                />
                                {edit && (
                                    <>
                                        <ActionButton
                                            className="cursor-pointer hover:z-10"
                                            onClick={() => setItems([...items.map(
                                                it => it.i == el.i ? { ...it, visible: false } : it
                                            )])}
                                            icon={<EyeOff />}
                                            tooltip={"Hide"}
                                            variant="outline"
                                        />
                                        <ActionButton
                                            className="cursor-pointer hover:z-10"
                                            onClick={() => setCopied(el.i)}
                                            icon={<Copy />}
                                            tooltip={"Copy"}
                                            variant="outline"
                                        />
                                        <ActionButton
                                            className="drag cursor-grab hover:z-10"
                                            icon={<Grip />}
                                            tooltip="Drag"
                                            variant="outline"
                                        />
                                        <ActionButton
                                            className="remove cursor-pointer hover:z-10"
                                            onClick={() => {
                                                const newItems = items.filter(item => item.i != el.i);
                                                if (newItems.length == 0) {
                                                    setNewCounter(0);
                                                }
                                                setItems([...newItems]);
                                            }}
                                            icon={<X />}
                                            tooltip="Remove"
                                            variant="outline"
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </ResponsiveReactGridLayout>
        );
    };


    return (
        <div className="w-full h-full overflow-auto relative" ref={gridRef}>
            <Tabs
                value={interface_ || undefined}
                onValueChange={(value: string | undefined) => {
                    if (!deleting) {
                        setPending(true);
                        setDataPending(true);
                        setInterface(value || null);
                    }
                }}
                className="w-full tutorial-details-panel"
            >
                <div className="sticky top-0 z-10 bg-background p-2 flex justify-between w-full md:overflow-none overflow-x-auto">
                    {/* Project dropdown and add/delete buttons */}
                    <ProjectButtons
                        project={project}
                        projects={projects}
                        interfaces={interfaces_}
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
                        setProjects={setProjects}
                        setInterface={setInterface}
                        setProject={setProject}
                    />

                    {/* Interface tabs and add/delete buttons */}
                    {project && <InterfaceTabs
                        interface_={interface_}
                        interfaces={interfaces_}
                        project={project}
                        context={context}
                        items={items}
                        newCounter={newCounter}
                        tableData={tableData}
                        pending={pending}
                        dataPending={dataPending}
                        interfaceActions={interfaceActions}
                        setInterface={setInterface}
                        setInterfaces={setInterfaces}
                        setDeleting={setDeleting}
                        setPending={setPending}
                        setTilePending={setTilePending}
                    />}

                    {/* Interface buttons for focus, context, save, reset, add tile, etc. */}
                    <InterfaceButtons
                        project_={project_}
                        interface_={interface_}
                        contexts={contexts}
                        savedInterface={savedInterface}
                        updateInterface={updateInterface}
                    />
                </div>

            {interfaces_.length == 0 ? (
                project && pending ? (
                    <div className="flex justify-center">
                        <Loader2 className="animate-spin my-36" />
                    </div>
                ) : !project ? (
                    <DefaultProject
                        projects={projects}
                        logsActions={logsActions}
                        projectActions={projectActions}
                        interfaceActions={interfaceActions}
                        setProject={setProject}
                        setInterface={setInterface}
                    />
                ) : null
            ) : (
                interfaces_.map((int_, idx) => (
                    <TabsContent
                        key={idx}
                        value={int_}
                        className="tutorial-selection-pane relative"
                    >
                        {renderGridContent(idx, int_)}
                    </TabsContent>
                ))
            )}
        </Tabs>

        {focusDialog && (
            <Dialog open={true} onOpenChange={() => setFocusDialog(false)}>
                <DialogContent className="min-w-full h-full overflow-y-auto">
                    <Suspense fallback={<SkeletonLoader />}>
                        <FocusDialog
                            project={project || undefined}
                            edit={edit}
                            items={items}
                            maxTiles={maxTiles}
                            maxTileItems={maxTileItems}
                            context={context}
                            contexts={contexts}
                            tableNames={tableNames}
                            tableArguments={tableArguments}
                            plotData={plotData}
                            logsActions={logsActions}
                            fieldsActions={fieldsActions}
                            derivedEntryActions={derivedEntryActions}
                            filterExpressions={filterExpressions}
                            sortingExpressions={sortingExpressions}
                            groupingExpressions={groupingExpressions}
                            groupSortingExpressions={groupSortingExpressions}
                            limit={limit}
                            offsets={offsets}
                            updateInterface={updateInterface}
                            setMaxTiles={setMaxTiles}
                            setFocusDialog={setFocusDialog}
                        />
                    </Suspense>
                </DialogContent>
            </Dialog>
        )}

        {edit && editTile && (
            <EditTileName
                items={items}
                editTile={editTile}
                setItems={setItems}
                setEditTile={setEditTile}
            />
        )}

        {saveDialog && (
            <Dialog open={true} onOpenChange={() => setSaveDialog(false)}>
                <DialogContent className="w-1/4">
                    <div className="mt-4 flex flex-col gap-4">
                    <div>
                        Are you sure you want to save the changes to{" "}
                        <span className="font-semibold">{interface_}</span>?
                    </div>
                    <div className="flex justify-end pr-2">
                        <ActionButton
                            className="w-fit remove cursor-pointer mr-0 justify-self-end"
                            onClick={async () => {
                                if (saveSuccess === undefined) {
                                    let response: ResponseProps | undefined = undefined;
                                    if (interfaceCreated) {
                                        response = await interfaceActions.update(
                                            interface_ as string,
                                            project as string,
                                            context,
                                            items,
                                            newCounter,
                                            undefined,
                                            false
                                        );
                                    } else {
                                        response = await interfaceActions.create(
                                            interface_ as string,
                                            project as string,
                                            context,
                                            items,
                                            newCounter,
                                            false
                                        );
                                    }
                                    if (response && "info" in response) {
                                        setSaveSuccess(true);
                                    } else {
                                        setSaveSuccess(false);
                                    }
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
            </Dialog>
        )}
    </div>
)};

export default CardGrid;
