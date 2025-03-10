"use client";

import { Loader2, Play } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import MarkdownRender from "../Common/Code/MarkdownRender";
import { InterfaceActions, LogsActions, ProjectsActions } from "@/types/evals/grid";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../UI/tabs";
import { examples } from "@/constants/logs";
import { useQueryState } from "nuqs";

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
    if (example == null) {
        setExample(Object.keys(examples)[0]);
    }

    return <div className="flex flex-col gap-4 justify-center items-center">
        <div className="mt-4 flex justify-center font-semibold">
            Please select a project, create a project or get started some of the examples below
        </div>
        <Tabs
            value={example || undefined}
            onValueChange={(value: string) => setExample(value)}
            className="tutorial-details-panel w-full flex gap-2 px-4"
        >
            <TabsList className="h-full m-2 border rounded-md flex flex-col gap-2">
                {Object.keys(examples).map((ex, idx) => <TabsTrigger
                    key={idx}
                    value={ex}
                    className="w-full relative flex flex-row gap-2 data-[state=active]:text-accent"
                >
                    {ex}
                </TabsTrigger>)}
            </TabsList>
            {Object.keys(examples).map((ex, idx) => {
                const {
                    project: exampleProject,
                    name: exampleName,
                    items: exampleItems,
                    new_counter: exampleNewCounter,
                    logs: exampleLogs,
                    code: exampleCode,
                } = examples[ex];
                return <TabsContent
                    key={idx}
                    value={ex}
                    className="tutorial-selection-pane relative flex-1"
                >
                    <div className="relative h-[700px] overflow-y-auto rounded-md border border-1 p-2">
                        <div className="absolute z-10 top-3 right-12">
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
                </TabsContent>;
            })}
        </Tabs>
    </div>
}

export default DefaultProject;
