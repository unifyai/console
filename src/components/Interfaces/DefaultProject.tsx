"use client";

import Image from "next/image";
import { Check, ExternalLink, Loader2, Play } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import MarkdownRender from "../Common/Code/MarkdownRender";
import { DerivedEntryActions, InterfaceActions, LogsActions, ProjectsActions, TileProps } from "@/types/evals/grid";
import { useEffect, useState } from "react";
import { examples } from "@/constants/logs";
import { useQueryState } from "nuqs";
import BaseDropdown from "../Common/Dropdowns/Base";
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "../UI/dropdown-menu";
import Link from "next/link";
import { DialogContent } from "../UI/dialog";
import { Dialog } from "../UI/dialog";
import { getLogsParameters } from "@/types/evals/logs";
import { Badge } from "../UI/badge";

const DefaultProject = ({
    projects,
    projectActions,
    interfaceActions,
    logsActions,
    derivedEntryActions,
}: {
    projects: string[] | undefined,
    projectActions: ProjectsActions,
    interfaceActions: InterfaceActions,
    logsActions: LogsActions,
    derivedEntryActions: DerivedEntryActions,
}) => {
    const disabled = projects == undefined
    const [pendingLocal, setPendingLocal] = useState(false);
    const [imageDialog, setImageDialog] = useState(false);
    const [example, setExample] = useQueryState("example");
    const [create, setCreate] = useQueryState("create");
    const reorganizedExamples: {
        [key: string]: {
            [key: string]: {
                project: string,
                name: string,
                items: TileProps[],
                new_counter: number,
                logs: any,
                code: string,
                gif: string,
                link: string,
                description: string,
            }
        }
    } = {};
    Object.keys(examples).forEach((ex) => {
        const [group, name] = ex.split("/");
        if (!reorganizedExamples[group]) {
            reorganizedExamples[group] = {};
        }
        reorganizedExamples[group][name] = examples[ex];
    });
    const {
        project: exampleProject,
        name: exampleName,
        items: exampleItems,
        new_counter: exampleNewCounter,
        logs: exampleLogs,
        code: exampleCode,
        gif: exampleGif,
        link: exampleLink,
        description: exampleDescription,
        derived_columns: exampleDerivedColumns
    } = examples[
        Object.keys(examples).includes(example || "")
            ? example || ""
            : Object.keys(examples)[0]
        ];

    const storeExample = (
        exampleProject: string,
        exampleName: string,
        exampleItems: TileProps[],
        exampleNewCounter: number,
        exampleLogs: any,
        exampleDerivedColumns: {
            project: string;
            context?: string | undefined;
            key: string;
            equation: string;
            referenced_logs: {
                [table_name: string]: getLogsParameters;
            };
        } | undefined
    ) => {
        if (projects?.includes(exampleProject)) {
            window.open(
                `/interfaces?project=${exampleProject}`,
                "_blank",
                "noopener,noreferrer"
            );
        } else {
            setPendingLocal(true);
            projectActions.create(exampleProject).then(() => {
                interfaceActions.create(
                    exampleName, exampleProject, undefined, exampleItems, exampleNewCounter, true
                ).then(() => {
                    if (exampleProject == "context-demo") {
                        Promise.all(Object.keys(exampleLogs).map(context => logsActions.create(
                            exampleProject, context, exampleLogs[context].params, exampleLogs[context].entries
                        ))).then(() => {
                            setTimeout(() => {
                                window.open(
                                    `/interfaces?project=${exampleProject}&tab=${exampleName}`,
                                    "_blank",
                                    "noopener,noreferrer"
                                );
                                setPendingLocal(false);
                            }, 3000);
                        });
                    }
                    else if (exampleProject == "MarkingAssistant") {
                        const context = Object.keys(exampleLogs)[0];
                        const length = exampleLogs[context].entries.length;
                        Promise.all(
                            Array.from(
                                { length: Math.ceil(length / 100) },
                                (_, i) => ({ i: i * 100, j: Math.min((i + 1) * 100, length) })
                            ).map(({ i, j }) => logsActions.create(
                                exampleProject,
                                context,
                                exampleLogs[context].params,
                                exampleLogs[context].entries.slice(i, j)
                            ))
                        ).then(() => {
                            setTimeout(() => {
                                window.open(
                                    `/interfaces?project=${exampleProject}&tab=${exampleName}`,
                                    "_blank",
                                    "noopener,noreferrer"
                                );
                                setPendingLocal(false);
                            }, 3000);
                        });
                    }
                    else {
                        logsActions.create(
                            exampleProject, null, exampleLogs.params, exampleLogs.entries
                        ).then(() => {
                            if (exampleDerivedColumns != undefined) {
                                derivedEntryActions.create(
                                    exampleDerivedColumns.project,
                                    exampleDerivedColumns.context,
                                    exampleDerivedColumns.key,
                                    exampleDerivedColumns.equation,
                                    exampleDerivedColumns.referenced_logs
                                ).then(() => {
                                    setTimeout(() => {
                                        window.open(
                                            `/interfaces?project=${exampleProject}&tab=${exampleName}`,
                                            "_blank",
                                            "noopener,noreferrer"
                                        );
                                        setPendingLocal(false);
                                    }, 3000);
                                });
                            }
                            else {
                                setTimeout(() => {
                                    window.open(
                                        `${process.env.NEXTAUTH_URL}/interfaces?project=${exampleProject}&tab=${exampleName}`,
                                        "_blank",
                                        "noopener,noreferrer"
                                    );
                                    setPendingLocal(false);
                                }, 3000);
                            }
                        });
                    }
                });
            });
        }
    };

    useEffect(() => {
        if (example == null)
            setExample(Object.keys(examples)[0]);
        if (create && example) {
            const {
                project: exampleProject,
                name: exampleName,
                items: exampleItems,
                new_counter: exampleNewCounter,
                logs: exampleLogs,
                derived_columns: exampleDerivedColumns
            } = examples[example];
            storeExample(
                exampleProject,
                exampleName,
                exampleItems,
                exampleNewCounter,
                exampleLogs,
                exampleDerivedColumns
            );
        }
    });

    return <>
        <div className="h-[94vh] flex flex-col gap-4 items-center">
            <div className="mt-4 flex justify-center font-semibold">
                Please select a project, create a project or select an example below
            </div>
            <div className="my-auto flex gap-8">
                {exampleGif != undefined && <div className="mb-1 flex flex-col items-center gap-4">
                    <div className="flex gap-4 w-full">
                        <div className="w-fit">
                            <BaseDropdown
                                button={<ActionButton
                                    tooltip={"Select Example"}
                                    text={"Select Example"}
                                    variant={"outline"}
                                    size="default"
                                />}
                            >
                                <div className="max-h-[80vh] overflow-y-auto">
                                    {Object.keys(reorganizedExamples).map((group) => (
                                        <DropdownMenuGroup key={group} className="w-48">
                                            <DropdownMenuSub>
                                                <DropdownMenuSubTrigger className="hover:text-white data-[state=open]:text-white">
                                                    {group}
                                                </DropdownMenuSubTrigger>
                                                <DropdownMenuPortal>
                                                    <DropdownMenuSubContent>
                                                        {Object.keys(reorganizedExamples[group]).map(ex =>
                                                            <DropdownMenuItem
                                                                key={ex}
                                                                onClick={() => setExample(`${group}/${ex}`)}
                                                                className="w-48 justify-between"
                                                            >
                                                                <span>{ex}</span>
                                                                {`${group}/${ex}` == example && <Check className="w-4 h-4" />}
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuSubContent>
                                                </DropdownMenuPortal>
                                            </DropdownMenuSub>
                                        </DropdownMenuGroup>
                                    ))}
                                </div>
                            </BaseDropdown>
                        </div>
                        {example && <div className="flex my-auto">
                            <Badge variant="primary">{example.replace("/", " / ")}</Badge>
                        </div>}
                    </div>
                    <div className="text-sm font-semibold w-[600px]">
                        {exampleDescription}
                    </div>
                    <div className="flex flex-col gap-1 border p-1 rounded-lg">
                        <Image
                            key={exampleGif}
                            src={`https://raw.githubusercontent.com/unifyai/unifyai.github.io/main/img/externally_linked/docs/${exampleGif}.gif`}
                            alt="GIF"
                            width={600}
                            height={600}
                            unoptimized
                            onClick={() => setImageDialog(true)}
                            className="cursor-zoom-in rounded-lg"
                        />
                        <div className="text-sm font-semibold text-center">
                            Click image to maximize
                        </div>
                    </div>
                </div>}
                <div className="relative max-w-[700px] max-h-[700px] overflow-y-auto rounded-md border border-1 p-2">
                    <div className="absolute z-10 top-3 right-12 flex gap-1">
                        <Link href={`https://docs.unify.ai/${exampleLink}`} target="_blank">
                            <ActionButton icon={<ExternalLink />} tooltip={"Learn more"} />
                        </Link>
                        <ActionButton
                            icon={pendingLocal ? <Loader2 className="animate-spin" /> : <Play />}
                            tooltip={"Run Example"}
                            onClick={() => storeExample(
                                exampleProject,
                                exampleName,
                                exampleItems,
                                exampleNewCounter,
                                exampleLogs,
                                exampleDerivedColumns
                            )}
                            disabled={disabled}
                        />
                    </div>
                    <MarkdownRender content={`\`\`\`python${exampleCode}\`\`\``} noBackground />
                </div>
            </div>
        </div>
        <Dialog open={imageDialog} onOpenChange={setImageDialog}>
            <DialogContent className="max-w-[1400px] max-h-[800px]">
                <Image
                    key={exampleGif}
                    src={`https://raw.githubusercontent.com/unifyai/unifyai.github.io/main/img/externally_linked/docs/${exampleGif}.gif`}
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
