"use client";

import { useTile } from "@/contexts/hooks/tile";
import CodeBlock from "../../CodeBlock";
import { useState } from "react";
import { Input } from "@/components/UI/input";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import { fileTypes } from "@/constants/logs";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";

const Editor = ({
    tileId,
    tabId,
    interfaceId,
    projectId,
}: {
    tileId: string,
    tabId: string,
    interfaceId: string,
    projectId: string,
}) => {
    const {
       editorTile: editorTileState,
       editorTileActions,
    } = useTile(tileId, tabId, interfaceId, projectId);
    const [tempFileName, setTempFileName] = useState(editorTileState?.file_name || "");

    const language = (
        editorTileState?.file_type == "py" ? "python" :
        editorTileState?.file_type == "json" ? "json" :
        editorTileState?.file_type == "txt" ? "text" :
        undefined
    );

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex flex-row justify-between">
                <div className="flex flex-row ml-4 text-sm gap-2">
                    <Input
                        value={tempFileName}
                        onChange={(e) => setTempFileName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter")
                                editorTileActions?.setFileName(tempFileName);
                        }}
                        placeholder="File Name"
                        size={12}
                        className="text-sm"
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
                </div>
            </div>
            <CodeBlock
                code={editorTileState?.content || ""}
                language={language}
                pendingLocal={false}
                create={null}
                onRunDemo={() => {}}
                disabled={true}
                readOnly={false}
                onSave={(value: string | undefined) => {
                    if (value != undefined)
                        editorTileActions?.setContent(value);
                }}
            />
        </div>
    )
}

export default Editor;
