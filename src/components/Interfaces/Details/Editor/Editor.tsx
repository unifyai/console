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
import { useTab, useTabData } from "@/contexts/hooks/tab";
import { useTiles } from "@/contexts/hooks";
import Tooltip from "@/components/Common/Misc/Tooltip";


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
    const { editorTile: editorTileState, editorTileActions } = useTile(tileId, tabId, interfaceId, projectId);
    const { data: tabData } = useTabData(tabId, interfaceId, projectId);
    const tileIds = tabData?.tileIds;
    const tiles = useTiles(tileIds, ["type", "editorTile.file_name", "editorTile.file_type", "editorTile.content"]);
    const editorTiles = tiles.filter((tile) => tile.type == "Editor");
    const allFiles = editorTiles.map((tile) => {
        return { [`${tile.editorTile?.file_name}.${tile.editorTile?.file_type}`]: tile.editorTile?.content || "" };
    }).reduce((acc, curr) => ({ ...acc, ...curr }), {});
    const [tempFileName, setTempFileName] = useState(editorTileState?.file_name || "main");
    const [tempFileType, setTempFileType] = useState(editorTileState?.file_type || "txt");
    const [tempCode, setTempCode] = useState(editorTileState?.content || "");
    const [saved, setSaved] = useState(false);
    const [pending, setPending] = useState(false);
    const [complete, setComplete] = useState(false);
    const [output, setOutput] = useState("");

    const language = fileTypes[editorTileState?.file_type || "txt"] || "text";

    useEffect(() => {
        if (saved)
            setTimeout(() => setSaved(false), 2000);
    }, [saved]);

    useEffect(() => {
        if (!pending && output !== "")
            setComplete(true);
    }, [pending]);

    useEffect(() => {
        if (complete)
            setTimeout(() => setComplete(false), 5000);
    }, [complete]);

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex flex-row items-center ml-4 text-sm gap-1">
                <Tooltip content="File Name" side="top">
                    <Input
                        value={tempFileName}
                    onChange={(e) => {
                        setTempFileName(e.target.value);
                        editorTileActions?.setFileName(e.target.value)
                    }}
                    placeholder="File Name"
                    className="text-sm w-24"
                    />
                </Tooltip>
                .
                <Tooltip content="File Type" side="top">
                    <Input
                        value={tempFileType}
                    onChange={(e) => {
                        setTempFileType(e.target.value);
                        editorTileActions?.setFileType(e.target.value);
                    }}
                    placeholder="File Type"
                    className="text-sm w-24"
                    />
                </Tooltip>
                {saved && <div className="text-primary text-sm font-semibold">File saved!</div>}
            </div>
            <CodeBlock
                code={tempCode}
                output={output}
                language={language}
                pending={pending}
                complete={complete}
                create={null}
                disabled={false}
                setTempCode={setTempCode}
                onRun={(code: string) => {
                    setPending(true);
                    setOutput("");
                    editorTileActions?.setFileName(tempFileName);
                    editorTileActions?.setContent(code);
                    const tempFilePath = `${tempFileName}.${editorTileState?.file_type}`;
                    allFiles[tempFilePath] = code;
                    codeActions.run(allFiles, tempFilePath, projectId).then(
                        (result: any) => {
                            result = result.output.replaceAll("/project/sandbox/", "")
                            setOutput(result == "" ? "Script execution completed." : result)
                        }
                    ).finally(() => setPending(false));
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
