"use client";

import Image from "next/image";
import { ExternalLink, Loader2, Play } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import MarkdownRender from "../Common/Code/MarkdownRender";
import { DerivedEntryActions, InterfaceActions, LogsActions, ProjectsActions, TileProps } from "@/types/evals/grid";
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

const DefaultProject = ({
    projects,
    projectActions,
    interfaceActions,
    logsActions,
    derivedEntryActions,
    setInterface,
    setProject
}: {
    projects: string[] | undefined,
    projectActions: ProjectsActions,
    interfaceActions: InterfaceActions,
    logsActions: LogsActions,
    derivedEntryActions: DerivedEntryActions,
    setInterface: (value: string | null) => void,
    setProject: (value: string | null) => void,
}) => {
    const disabled = projects == undefined
    const [pendingLocal, setPendingLocal] = useState(false);
    const [imageDialog, setImageDialog] = useState(false);
    const [demo, setDemo] = useQueryState("demo");
    const [create, setCreate] = useQueryState("create");
    const demosTree = buildNestedDropdownTree(Object.keys(demos));
    const {
        project: demoProject,
        name: demoName,
        items: demoItems,
        new_counter: demoNewCounter,
        logs: demoLogs,
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
        demoLogs: any,
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
                setProject(demoProject);
                setCreate(null);
            }, 3000);
        } else {
            setPendingLocal(true);
            projectActions.create(demoProject).then(() => {
                interfaceActions.create(
                    demoName, demoProject, undefined, demoItems, demoNewCounter, true
                ).then(() => {
                    if (demoProject == "context-demo") {
                        Promise.all(Object.keys(demoLogs).map(context => logsActions.create(
                            demoProject, context, demoLogs[context].params, demoLogs[context].entries
                        ))).then(() => {
                            setTimeout(() => {
                                setPendingLocal(false);
                                setProject(demoProject);
                                setInterface(demoName);
                                setDemo(null);
                                setCreate(null);
                            }, 3000);
                        });
                    }
                    else if (demoProject == "MarkingAssistant") {
                        const context = Object.keys(demoLogs)[0];
                        const length = demoLogs[context].entries.length;
                        Promise.all(
                            Array.from(
                                { length: Math.ceil(length / 100) },
                                (_, i) => ({ i: i * 100, j: Math.min((i + 1) * 100, length) })
                            ).map(({ i, j }) => logsActions.create(
                                demoProject,
                                context,
                                demoLogs[context].params,
                                demoLogs[context].entries.slice(i, j)
                            ))
                        ).then(() => {
                            setTimeout(() => {
                                setPendingLocal(false);
                                setProject(demoProject);
                                setInterface(demoName);
                                setDemo(null);
                                setCreate(null);
                            }, 3000);
                        });
                    }
                    else {
                        logsActions.create(
                            demoProject, null, demoLogs.params, demoLogs.entries
                        ).then((logIds) => {
                            if (demoItems.find(item => item.i == "View")) {
                                const columns = Object.keys(demoLogs.entries[0]);
                                const selected = columns.map(
                                    column => `${logIds[0]}_Entries/${column}`
                                ).join(",");
                                demoItems[0].selected = selected;
                                interfaceActions.update(
                                    demoName,
                                    demoProject,
                                    undefined,
                                    demoItems,
                                    demoNewCounter,
                                    undefined,
                                    true
                                ).then(() => {
                                    setTimeout(() => {
                                        setPendingLocal(false);
                                        setProject(demoProject);
                                        setInterface(demoName);
                                        setDemo(null);
                                        setCreate(null);
                                    }, 3000);
                                });
                            } else {
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
                                            setProject(demoProject);
                                            setInterface(demoName);
                                            setDemo(null);
                                            setCreate(null);
                                        }, 3000);
                                    });
                                } else {
                                    setTimeout(() => {
                                        setPendingLocal(false);
                                        setProject(demoProject);
                                        setInterface(demoName);
                                        setDemo(null);
                                        setCreate(null);
                                    }, 3000);
                                }
                            }
                        });
                    }
                });
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
                logs: demoLogs,
                derived_columns: demoDerivedColumns
            } = demos[demo];
            storeDemo(
                demoProject,
                demoName,
                demoItems,
                demoNewCounter,
                demoLogs,
                demoDerivedColumns
            );
        }
    });

    return <>
        <div className="h-[94vh] flex flex-col gap-4 items-center">
            <div className="mt-4 flex justify-center font-semibold">
                {create
                    ? "Creating the project, please wait..."
                    : "Please select a project, create a project or select a demo below"
                }
            </div>
            <div className="my-auto flex gap-8">
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
                <div className="relative max-w-[700px] max-h-[700px] overflow-y-auto rounded-md border border-1 p-2">
                    <div className="absolute z-10 top-3 right-12 flex gap-1">
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
                                demoLogs,
                                demoDerivedColumns
                            )}
                            disabled={disabled}
                        />
                    </div>
                    <MarkdownRender content={`\`\`\`python${demoCode}\`\`\``} darkOnly />
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
