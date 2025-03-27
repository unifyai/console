"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { ExternalLink, Loader2, Play } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import MarkdownRender from "../Common/Code/MarkdownRender";
import { DerivedEntryActions, TabActions, LogsActions, ProjectsActions, TileProps, CodeActions } from "@/types/evals/grid";
import { useEffect, useState } from "react";
import { demos } from "@/constants/logs";
import { useQueryState } from "nuqs";
import BaseDropdown from "../Common/Dropdowns/Base";
import Link from "next/link";
import { DialogContent } from "../UI/dialog";
import { Dialog } from "../UI/dialog";
import { getLogsParameters } from "@/types/evals/logs";
import { Badge } from "../UI/badge";
import { buildNestedDropdownTree } from "@/utils/evals/common";
import RenderMenuItems from "../Common/Dropdowns/RenderMenuItems";
import { useStoreContext } from "@/contexts/providers/StoreProvider";

const DefaultProject = ({
    projectActions,
    tabActions,
    logsActions,
    codeActions,
    derivedEntryActions,
    setTabQueryParam,
    setProjectQueryParam
}: {
    projectActions: ProjectsActions,
    tabActions: TabActions,
    logsActions: LogsActions,
    codeActions: CodeActions
    derivedEntryActions: DerivedEntryActions,
    setTabQueryParam: (value: string | null) => void,
    setProjectQueryParam: (value: string | null) => void,
}) => {
    // Access projects getter and setter from the store
    const projects = useStoreContext(state => state.projects);

    const { theme } = useTheme();

    const disabled = projects == undefined
    const [pendingLocal, setPendingLocal] = useState(false);
    const [error, setError] = useState(false);
    const [imageDialog, setImageDialog] = useState(false);
    const [demo, setDemo] = useQueryState("demo");
    const [create, setCreate] = useQueryState("create");
    const demosTree = buildNestedDropdownTree(Object.keys(demos));
    const {
        project: demoProject,
        name: demoName,
        items: demoItems,
        new_counter: demoNewCounter,
        code: demoCode,
        gif: demoGif,
        link: demoLink,
        description: demoDescription,
        derived_columns: demoDerivedColumns
    } = demos[
        Object.keys(demos).includes(demo || "")
            ? demo || ""
            : Object.keys(demos)[0]
        ];

    const storeDemo = (
        demoProject: string,
        demoName: string,
        demoItems: TileProps[],
        demoNewCounter: number,
        demoDerivedColumns: {
            project: string;
            context?: string | undefined;
            key: string;
            equation: string;
            referenced_logs: {
                [table_name: string]: getLogsParameters;
            };
        } | undefined
    ) => {
        if (projects?.includes(demoProject)) {
            setTimeout(() => {
                setProjectQueryParam(demoProject);
                setCreate(null);
            }, 3000);
        } else {
            setPendingLocal(true);
            codeActions.run(demoCode).then(() => {
                tabActions.create(
                    demoName, demoProject, undefined, demoItems, demoNewCounter, true
                ).then(() => {
                    if (demoDerivedColumns != undefined) {
                        derivedEntryActions.create(
                            demoDerivedColumns.project,
                            demoDerivedColumns.context,
                            demoDerivedColumns.key,
                            demoDerivedColumns.equation,
                            demoDerivedColumns.referenced_logs
                        ).then(() => {
                            setTimeout(() => {
                                setPendingLocal(false);
                                setProjectQueryParam(demoProject);
                                setTabQueryParam(demoName);
                                setDemo(null);
                                setCreate(null);
                            }, 3000);
                        });
                    } else {
                        setTimeout(() => {
                            setPendingLocal(false);
                            setProjectQueryParam(demoProject);
                            setTabQueryParam(demoName);
                            setDemo(null);
                            setCreate(null);
                        }, 3000);
                    }
                });
            }).catch(() => {
                projectActions.delete(demoProject);
                setPendingLocal(false);
                setError(true);
            });
        }
    };

    useEffect(() => {
        if (demo == null)
            setDemo(Object.keys(demos)[0]);
        if (create && demo) {
            const {
                project: demoProject,
                name: demoName,
                items: demoItems,
                new_counter: demoNewCounter,
                derived_columns: demoDerivedColumns
            } = demos[demo];
            storeDemo(
                demoProject,
                demoName,
                demoItems,
                demoNewCounter,
                demoDerivedColumns
            );
        }
    });

    useEffect(() => {
        if (error) {
            setTimeout(() => {
                setError(false);
            }, 5000);
        }
    }, [error]);

    return <>
        <div className="h-[94vh] flex flex-col gap-4 items-center">
            <div className="mt-4 flex justify-center font-semibold">
                {create
                    ? "Creating the project, please wait..."
                    : "Please select a project, create a project or select a demo below"
                }
            </div>
            <div className="my-auto">
                {error && <div className="my-2 text-destructive">
                    Error running demo, please try again.
                </div>}
                <div className="flex gap-8">
                    {demoGif != undefined && <div className="mb-1 flex flex-col items-center gap-4">
                        <div className="flex gap-4 w-full">
                            <div className="w-fit">
                                <BaseDropdown
                                    button={<ActionButton
                                        tooltip={"Select Demo"}
                                        text={"Select Demo"}
                                        variant={"outline"}
                                        size="default"
                                    />}
                                >
                                    <div className="max-h-[80vh] overflow-y-auto">
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
                                                showRoot={false}
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
                        <div className="text-sm font-semibold w-[600px]">
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
                    <div className="relative max-w-[700px] max-h-[700px] mb-auto overflow-y-auto rounded-md border border-1 p-2">
                        <div className={"absolute z-10 top-3 right-12 flex gap-1 " + (theme == "dark" ? "text-foreground" : "text-muted")}>
                            <Link href={`https://docs.unify.ai/${demoLink}`} target="_blank">
                                <ActionButton icon={<ExternalLink />} tooltip={"Learn more"} />
                            </Link>
                            <ActionButton
                                icon={(pendingLocal || create != null)
                                    ? <Loader2 className="animate-spin" />
                                    : <Play />
                                }
                                tooltip={"Run Demo"}
                                onClick={() => storeDemo(
                                    demoProject,
                                    demoName,
                                    demoItems,
                                    demoNewCounter,
                                    demoDerivedColumns
                                )}
                                disabled={disabled}
                            />
                        </div>
                        <MarkdownRender content={`\`\`\`python${demoCode}\`\`\``} darkOnly />
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
