"use client";

import Image from "next/image";
import { ExternalLink, Loader2, Play } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import MarkdownRender from "../Common/Code/MarkdownRender";
import { InterfaceActions, LogsActions, ProjectsActions, TileProps } from "@/types/evals/grid";
import { useEffect, useState } from "react";
import { examples } from "@/constants/logs";
import { useQueryState } from "nuqs";
import BaseDropdown from "../Common/Dropdowns/Base";
import { DropdownMenuItem } from "../UI/dropdown-menu";
import Link from "next/link";

const DefaultProject = ({
    projects,
    projectActions,
    interfaceActions,
    logsActions,
    setInterface,
    setProject
}: {
    projects: string[] | undefined,
    projectActions: ProjectsActions,
    interfaceActions: InterfaceActions,
    logsActions: LogsActions,
    setInterface: (value: string | null) => void,
    setProject: (value: string | null) => void,
}) => {
    const disabled = projects == undefined
    const [pendingLocal, setPendingLocal] = useState(false);
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
        link: exampleLink
    } = examples[
        Object.keys(examples).includes(example || "")
            ? example || ""
            : Object.keys(examples)[0]
        ];
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
            } = examples[example];
            if (projects?.includes(exampleProject)) {
                setProject(exampleProject);
            } else {
                setPendingLocal(true);
                projectActions.create(exampleProject).then(() => {
                    interfaceActions.create(
                        exampleName, exampleProject, undefined, exampleItems, exampleNewCounter, true
                    ).then(() => {
                        logsActions.create(
                            exampleProject, exampleLogs.params, exampleLogs.entries
                        ).then(() => {
                            setPendingLocal(false);
                            setProject(exampleProject);
                            setInterface(exampleName);
                            setCreate(null);
                            setExample(null);
                        });
                    });
                });
            }
        }
    });

    return <div className="flex flex-col gap-4 justify-center items-center">
        <div className="mt-4 flex justify-center font-semibold">
            Please select a project, create a project or get started some of the examples below
        </div>
        <BaseDropdown
            button={<ActionButton
                tooltip={"Select Example"}
                text={example ? example.split("/")[1] : "Select Example"}
                variant={"outline"}
                size="default"
            />}
        >
            {Object.keys(reorganizedExamples).map((group) => {
                return <div key={group} className="w-[300px] mt-2 pb-1 px-3 border-b">
                    <div className="font-semibold text-sm mb-1">{group}</div>
                    {Object.keys(reorganizedExamples[group]).map(ex =>
                        <DropdownMenuItem key={ex} onClick={() => setExample(`${group}/${ex}`)}>
                            {ex}
                        </DropdownMenuItem>
                    )}
                </div>
            })}
        </BaseDropdown>
        <div className="relative max-w-[700px] max-h-[700px] overflow-y-auto rounded-md border border-1 p-2">
            <div className="absolute z-10 top-3 right-12 flex gap-1">
                <Link href={`https://docs.unify.ai/${exampleLink}`} target="_blank">
                    <ActionButton icon={<ExternalLink />} tooltip={"Learn more"} />
                </Link>
                <ActionButton
                    icon={pendingLocal ? <Loader2 className="animate-spin" /> : <Play />}
                    tooltip={"Run Example"}
                    onClick={() => {
                        if (projects?.includes(exampleProject)) {
                            setProject(exampleProject);
                        } else {
                            setPendingLocal(true);
                            projectActions.create(exampleProject).then(() => {
                                interfaceActions.create(
                                    exampleName, exampleProject, undefined, exampleItems, exampleNewCounter, true
                                ).then(() => {
                                    logsActions.create(
                                        exampleProject, exampleLogs.params, exampleLogs.entries
                                    ).then(() => {
                                        setPendingLocal(false);
                                        setProject(exampleProject);
                                        setInterface(exampleName);
                                    });
                                });
                            });
                        }
                    }}
                    disabled={disabled}
                />
            </div>
            <MarkdownRender content={`\`\`\`python${exampleCode}\`\`\``} noBackground />
        </div>
        {exampleGif != undefined && <div className="mb-auto">
            <Image
                key={exampleGif}
                src={`https://raw.githubusercontent.com/unifyai/unifyai.github.io/main/img/externally_linked/docs/${exampleGif}.gif`}
                alt="GIF"
                width={600}
                height={600}
                unoptimized
            />
        </div>}
    </div>
}

export default DefaultProject;
