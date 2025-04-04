"use client";

import { useTile } from "@/contexts/hooks/tile";
import CodeBlock from "../../CodeBlock";
import { useEffect, useState } from "react";
import { Input } from "@/components/UI/input";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import { fileTypes } from "@/constants/logs";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { CodeActions } from "@/types/evals/grid";

const Editor = ({
    tileId,
    tabId,
    interfaceId,
    projectId,
    codeActions
}: {
    tileId: string,
    tabId: string,
    interfaceId: string,
    projectId: string,
    codeActions: CodeActions
}) => {
    const {
        editorTile: editorTileState,
        editorTileActions,
    } = useTile(tileId, tabId, interfaceId, projectId);
    const [tempFileName, setTempFileName] = useState(editorTileState?.file_name || "main");
    const [saved, setSaved] = useState(false);
    const [pending, setPending] = useState(false);
    const [output, setOutput] = useState("");

    const language = (
        editorTileState?.file_type == "py" ? "python" :
            editorTileState?.file_type == "json" ? "json" :
                editorTileState?.file_type == "txt" ? "text" :
                    undefined
    );

    useEffect(() => {
        if (saved)
            setTimeout(() => setSaved(false), 2000);
    }, [saved]);

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex flex-row items-center ml-4 text-sm gap-2">
                <Input
                    value={tempFileName}
                    onChange={(e) => setTempFileName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter")
                            editorTileActions?.setFileName(tempFileName);
                    }}
                    placeholder="File Name"
                    className="text-sm w-24"
                />
                <BaseDropdown
                    button={<ActionButton
                        tooltip="Select File Type"
                        text={editorTileState?.file_type || "Select File Type"}
                        variant="outline"
                        size="default"
                    />}
                >
                    {fileTypes.map((fileType, idx) => {
                        return (
                            <DropdownMenuItem key={idx} onSelect={() => {
                                editorTileActions?.setFileType(fileType as "py" | "txt" | "json");
                            }}>
                                {fileType}
                            </DropdownMenuItem>
                        )
                    })}
                </BaseDropdown>
                {saved && <div className="text-primary text-sm font-semibold">File saved!</div>}
            </div>
            <CodeBlock
                code={editorTileState?.content || ""}
                output={output}
                language={language}
                pending={pending}
                create={null}
                disabled={false}
                onRun={(code: string) => {
                    setPending(true);
                    editorTileActions?.setFileName(tempFileName);
                    editorTileActions?.setContent(code);
                    codeActions.run(code, tempFileName).then((result: any) => {
                        if (result.exitCode == 0)
                            setOutput(result.output);
                        setPending(false);
                    }).catch((error: Error) => {
                        setOutput(error.message);
                        setPending(false);
                    });
                }}
                readOnly={false}
                onSave={(value: string | undefined) => {
                    if (value != undefined) {
                        editorTileActions?.setFileName(tempFileName);
                        editorTileActions?.setContent(value);
                        setSaved(true);
                    }
                }}
            />
        </div>
    )
}

export default Editor;
