"use client";

import { useTile } from "@/contexts/hooks/tile";
import CodeBlock from "../../CodeBlock";
import { useState } from "react";

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

    const language = (
        editorTileState?.file_type == "py" ? "python" :
        editorTileState?.file_type == "json" ? "json" :
        editorTileState?.file_type == "txt" ? "text" :
        undefined
    );

    return (
        <div className="w-full h-full flex flex-col">
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
