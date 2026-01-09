"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { ExternalLink, Loader2, Play } from "lucide-react";
import Editor from "@monaco-editor/react";
import ActionButton from "../../../../Common/Buttons/Action";
import { DerivedEntryActions, LogsActions, ProjectsActions, CodeActions, GranularInterfaceActions, GranularTabActions, GranularTileActions, InterfaceData, TabData, TileData, FileActions } from "@/types/interfaces/grid";
import { useEffect, useState, useCallback } from "react";
import { demos } from "@/constants/logs";
import { useQueryState } from "nuqs";
import BaseDropdown from "../../../../Common/Dropdowns/Base";
import Link from "next/link";
import { DialogContent } from "../../../../UI/dialog";
import { Dialog } from "../../../../UI/dialog";
import { GetLogsParameters } from "@/types/interfaces/logs";
import { Badge } from "../../../../UI/badge";
import { buildNestedDropdownTree } from "@/utils/interfaces/common";
import RenderMenuItems from "../../../../Common/Dropdowns/RenderMenuItems";
import { CopyButton } from "../../../../Common/Buttons/Copy";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import CodeBlock from "../../../../Common/Code/CodeBlock";

// Import the unified demo query hook
import { useCreateDemoQuery } from "@/hooks/Interfaces/Query/useDemoQuery";

const DefaultProject = ({
    projectActions,
    interfaceActions,
    tabActions,
    tileActions,
    logsActions,
    codeActions,
    derivedEntryActions,
    fileActions,
    setTabQueryParam,
    setInterfaceQueryParam,
    setProjectQueryParam
}: {
    projectActions: ProjectsActions,
    interfaceActions: GranularInterfaceActions,
    tabActions: GranularTabActions,
    tileActions: GranularTileActions,
    logsActions: LogsActions,
    codeActions: CodeActions,
    derivedEntryActions: DerivedEntryActions,
    fileActions: FileActions,
    setTabQueryParam: (value: string | null) => void,
    setInterfaceQueryParam: (value: string | null) => void,
    setProjectQueryParam: (value: string | null) => void,
}) => {
    // Access projects getter and setter from the store
    const projects = useStoreContext(state => state.projects);

    // Initialize the unified demo creation mutation hook
    const createDemoMutation = useCreateDemoQuery();

    // Use React Query's state management
    const isPending = createDemoMutation.isPending;
    const isError = createDemoMutation.isError;

    const disabled = projects == undefined;
    const [imageDialog, setImageDialog] = useState(false);
    const [demo, setDemo] = useQueryState("demo");
    const [create, setCreate] = useQueryState("create");
    const demosTree = buildNestedDropdownTree(Object.keys(demos));
    const {
        code: demoCode,
        gif: demoGif,
        link: externalLink,
        description: demoDescription,
        derivedColumns: demoDerivedColumns,
        interface: demoInterface,
        tab: demoTab,
        tiles: demoTiles
    } = demos[
        Object.keys(demos).includes(demo || "")
            ? demo || ""
            : Object.keys(demos)[0]
        ];

    const storeDemo = useCallback(async () => {
        if (!demoInterface || !demoTab || !demoTiles) {
            return;
        }

        if (projects?.includes(demoInterface.projectId || "")) {
            setTimeout(() => {
                setProjectQueryParam(demoInterface.projectId || null);
                setDemo(null);
                setCreate(null);
            }, 3000);
            return;
        }
        
        try {
            // Make sure the demo data meets the expected types for the useCreateDemoQuery hook
            // by ensuring all required fields are defined
            const verifiedInterface: InterfaceData = {
                ...demoInterface,
                // Ensure projectId is defined (required by the hook)
                projectId: demoInterface.projectId || "",
            };
            
            const verifiedTab: TabData = {
                ...demoTab,
                // Other fields are optional
            };
            
            // Create verified tile objects with position formatting
            const verifiedTiles: TileData[] = demoTiles.map(tile => ({
                ...tile,
                // All other fields come from the demo data
            }));
            
            // Use the unified demo creation hook with type-safe inputs
            await createDemoMutation.mutateAsync({
                interface: verifiedInterface,
                tab: verifiedTab,
                tiles: verifiedTiles,
                derivedColumns: demoDerivedColumns,
                code: demoCode,
                actions: {
                    interfaceActions,
                    tabActions,
                    tileActions,
                    codeActions,
                    fileActions,
                    derivedEntryActions
                }
            });
            
            // After all operations complete successfully
            setTimeout(() => {
                setProjectQueryParam(demoInterface.projectId || null);
                setInterfaceQueryParam(demoInterface.name || null);
                setTabQueryParam(demoTab.name);
                setDemo(null);
                setCreate(null);
            }, 3000);
            
        } catch (error) {
            console.error("Error creating demo:", error);
            // Error handling is now managed by the hook
        }
    }, [demoInterface, demoTab, demoTiles, projects, setProjectQueryParam, setCreate, createDemoMutation, demoDerivedColumns, demoCode, interfaceActions, tabActions, tileActions, codeActions, fileActions, derivedEntryActions, setInterfaceQueryParam, setTabQueryParam, setDemo]);

    // Reset mutations if there was an error
    useEffect(() => {
        if (isError) {
            createDemoMutation.reset();
        }
    }, [isError, createDemoMutation]);

    useEffect(() => {
        if (demo == null)
            setDemo(Object.keys(demos)[0]);
        if (create && demo && !isPending) {
            storeDemo();
        }
    }, [create, demo, isPending, storeDemo, setDemo]);

    return <>
        <div className="h-[94vh] flex flex-col gap-4 items-center">
            <div className="mt-4 flex justify-center text-strong">
                {create && isPending
                    ? "Creating the project, please wait..."
                    : "Please select a project, create a project or select a demo below"
                }
            </div>
            <div className="my-auto">
                {isError && <div className="my-2 text-destructive">
                    Error running demo, please try again.
                </div>}
                <div className="flex gap-8">
                    {demoGif != undefined && <div className="mb-1 flex flex-col items-center gap-4">
                        <div className="flex gap-4 w-full">
                            <div className="w-fit">
                                <BaseDropdown
                                    button={<ActionButton
                                        tooltip={"Select demo"}
                                        text={"Select Demo"}
                                        variant={"outline"}
                                        size="default"
                                    />}
                                >
                                    <div className="max-h-[80vh] overflow-y-auto command-scrollbar">
                                        {Object.entries(demosTree.children).sort((a, b) => {
                                            if (a[0] === "<root>") return -1;
                                            if (b[0] === "<root>") return 1;
                                            return a[0].localeCompare(b[0]);
                                        }).map(([name, node], idx) => (
                                            <RenderMenuItems
                                                key={idx}
                                                node={node}
                                                nodeName={name}
                                                isTopLevel={true}
                                                selectableNodes={Object.keys(demos)}
                                                prefix={undefined}
                                                attr={demo || undefined}
                                                setter={(d: string) => setDemo(d)}
                                                isColumnContext={false}
                                            />
                                        ))}
                                    </div>
                                </BaseDropdown>
                            </div>
                            {demo && <div className="flex my-auto">
                                <Badge variant="primary">{demo.replaceAll("/", " / ")}</Badge>
                            </div>}
                        </div>
                        <div className="text-body text-strong w-[600px]">
                            {demoDescription}
                        </div>
                        <div className="flex flex-col gap-1 border p-1 rounded-lg">
                            <Image
                                key={demoGif}
                                src={`https://raw.githubusercontent.com/unifyai/unifyai.github.io/main/img/externally_linked/docs/${demoGif}.gif`}
                                alt="GIF"
                                width={600}
                                height={600}
                                unoptimized
                                onClick={() => setImageDialog(true)}
                                className="cursor-zoom-in rounded-lg"
                            />
                        </div>
                    </div>}

                    <div className="relative h-[400px] w-[600px] mb-auto overflow-y-auto command-scrollbar rounded-md border border-1 p-2">
                        <CodeBlock
                            code={demoCode}
                            language="python"
                            externalLink={externalLink}
                            pending={isPending}
                            create={create}
                            onRun={(_: string) => storeDemo()}
                            disabled={disabled || isPending}
                            readOnly={true}
                        />
                    </div>
                </div>
            </div>
        </div>
        <Dialog open={imageDialog} onOpenChange={setImageDialog}>
            <DialogContent className="max-w-[1400px] max-h-[800px]">
                <Image
                    key={demoGif}
                    src={`https://raw.githubusercontent.com/unifyai/unifyai.github.io/main/img/externally_linked/docs/${demoGif}.gif`}
                    alt="GIF"
                    width={1400}
                    height={800}
                    unoptimized
                    className="cursor-zoom-out"
                    onClick={() => setImageDialog(false)}
                />
            </DialogContent>
        </Dialog>
    </>
}

export default DefaultProject;