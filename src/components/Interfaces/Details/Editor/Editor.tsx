"use client";

import CodeBlock from "../../CodeBlock";
import { useEffect, useState, useRef, useMemo, useCallback, Dispatch, SetStateAction } from "react";
import { Input } from "@/components/UI/input";
import { fileTypes } from "@/constants/logs";
import { CodeActions, FileActions } from "@/types/evals/grid";
import { useTabData } from "@/contexts/hooks/tab";
import { useTiles } from "@/contexts/hooks";
import Tooltip from "@/components/Common/Misc/Tooltip";
import { useEditorTileSync } from "@/contexts/hooks/tile/sync";
import { GranularTileActions, ProjectsActions, ContextActions, LogsActions, FieldsActions } from "@/types/evals/grid";
import ActionButton from "@/components/Common/Buttons/Action";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { FilePlus, FolderPlus, FolderOpen, Trash2, Loader2, Plus } from "lucide-react";

const Editor = ({
    tileId,
    tabId,
    interfaceId,
    projectId,
    codeActions,
    fileActions,
    tileActions,
    projectsActions,
    contextActions,
    logsActions,
    fieldsActions
}: {
    tileId: string,
    tabId: string,
    interfaceId: string,
    projectId: string,
    codeActions: CodeActions,
    fileActions: FileActions,
    tileActions: GranularTileActions,
    projectsActions: ProjectsActions,
    contextActions: ContextActions,
    logsActions: LogsActions,
    fieldsActions: FieldsActions
}) => {
    // SYNCHRONISED TABLE-SPECIFIC ACTIONS (optimistic + router refresh)
    const { editorTile: editorTileState, editorTileActions } = useEditorTileSync(
        tileId,
        tabId,
        tileActions,
        projectsActions,
        contextActions,
        logsActions,
        fieldsActions
    );
    const { data: tabData } = useTabData(tabId, interfaceId);
    const tileIds = tabData?.tileIds;
    const tiles = useTiles(tileIds, ["type", "editorTile.file_name", "editorTile.file_type", "editorTile.content"]);
    const editorTiles = tiles.filter((tile) => tile.type == "Editor");
    const [allFiles, setAllFiles] = useState<Record<string,string>>({});
    const [loadingFiles, setLoadingFiles] = useState(false);

    /* ------------------------------------------------------------------
       Helpers
    ------------------------------------------------------------------*/
    const fetchFiles = useCallback(async () => {
        try {
            const files = await fileActions.list(projectId);
            setAllFiles(files);
        } catch (e) {
            console.error("Failed to list files", e);
        }
    }, [fileActions, projectId]);

    // initial load
    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    const handleUpload = async (payload: Record<string,string>) => {
        try {
            await fileActions.write(projectId, payload);
            await fetchFiles();
        } catch (e) { console.error('upload error', e); }
    };

    const handleDelete = async (path: string) => {
        try {
            await fileActions.delete(projectId, path);
            await fetchFiles();
        } catch (e) { console.error('delete error', e); }
    };

    const [tempFileName, setTempFileName] = useState(editorTileState?.file_name || "main");
    const [tempFileType, setTempFileType] = useState(editorTileState?.file_type || "txt");
    const [tempCode, setTempCode] = useState(editorTileState?.content || "");
    const [selectedPath, setSelectedPath] = useState<string | undefined>(() => {
        if (editorTileState?.file_name && editorTileState?.file_type) {
            return `${editorTileState.file_name}.${editorTileState.file_type}`;
        }
        return undefined;
    });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const [saved, setSaved] = useState(false);
    const [pending, setPending] = useState(false);
    const [complete, setComplete] = useState(false);
    const [output, setOutput] = useState("");

    /* Dropdown open state – fetch latest list before opening */
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const handleDropdownToggle: Dispatch<SetStateAction<boolean>> = (value) => {
        const open = typeof value === "function" ? value(dropdownOpen) : value;
        if (open) {
            setLoadingFiles(true);
            fetchFiles().finally(() => {
                setDropdownOpen(true);
                setLoadingFiles(false);
            });
        } else {
            setDropdownOpen(false);
        }
    };

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

    // Set directory attributes for folder upload once ref is available
    useEffect(() => {
        if (folderInputRef.current) {
            // @ts-ignore
            folderInputRef.current.setAttribute('webkitdirectory', '');
            // @ts-ignore
            folderInputRef.current.setAttribute('directory', '');
        }
    }, [folderInputRef]);

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
                <div className="flex flex-row gap-1 mr-2">
                    <ActionButton
                        icon={<FilePlus size={16} />}
                        variant="ghost"
                        tooltip="Upload File"
                        onClick={() => fileInputRef.current?.click()}
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        style={{ display: "none" }}
                        onChange={async (e) => {
                            const files = e.target.files;
                            if (!files || files.length === 0) return;
                            Array.from(files).forEach((file) => {
                                const reader = new FileReader();
                                reader.onload = () => {
                                    const content = reader.result as string;
                                    const path = file.name;
                                    handleUpload({ [path]: content });
                                };
                                reader.readAsText(file);
                            });
                        }}
                    />
                    <ActionButton
                        icon={<FolderPlus size={16} />}
                        variant="ghost"
                        tooltip="Upload Folder"
                        onClick={() => folderInputRef.current?.click()}
                    />
                    <input
                        ref={folderInputRef}
                        type="file"
                        style={{ display: "none" }}
                        multiple
                        onChange={(e) => {
                            const files = e.target.files;
                            if (!files || files.length === 0) return;
                            Array.from(files).forEach((file) => {
                                const reader = new FileReader();
                                reader.onload = () => {
                                    const content = reader.result as string;
                                    const relativePath = (file as any).webkitRelativePath || file.name;
                                    handleUpload({ [relativePath]: content });
                                };
                                reader.readAsText(file);
                            });
                        }}
                    />
                    <BaseDropdown
                        open={dropdownOpen}
                        setOpen={handleDropdownToggle}
                        button={<ActionButton variant="ghost" icon={loadingFiles ? <Loader2 className="animate-spin" size={16} /> : <FolderOpen size={16} />} tooltip="Select File" />}
                    >
                        {Object.keys(allFiles).length === 0 ? (
                            <DropdownMenuItem disabled>No files</DropdownMenuItem>
                        ) : (
                            Object.keys(allFiles).map((path, idx) => (
                                <DropdownMenuItem
                                    key={idx}
                                    onSelect={() => {
                                        const dotIdx = path.lastIndexOf(".");
                                        const ext = dotIdx !== -1 ? path.substring(dotIdx + 1) : "txt";
                                        const name = dotIdx !== -1 ? path.substring(0, dotIdx) : path;
                                        setTempFileName(name);
                                        setTempFileType(ext);
                                        setTempCode(allFiles[path]);
                                        setSelectedPath(path);
                                        // editorTileActions?.updateFile(name, ext, allFiles[path]);
                                    }}
                                >
                                    {path}
                                </DropdownMenuItem>
                            ))
                        )}
                    </BaseDropdown>
                    <ActionButton
                        icon={<Trash2 size={16} />}
                        variant="ghost"
                        tooltip="Delete File"
                        disabled={!selectedPath}
                        onClick={() => {
                            if (selectedPath) {
                                handleDelete(selectedPath);
                                setSelectedPath(undefined);
                                setTempFileName("main");
                                setTempFileType("txt");
                                setTempCode("");
                            }
                        }}
                    />
                </div>
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
                    const filesForRun = { ...allFiles, [tempFilePath]: code };
                    codeActions.run(filesForRun, tempFilePath, projectId).then(
                        (result: any) => {
                            result = result.output.replaceAll("/project/sandbox/", "")
                            setOutput(result == "" ? "Script execution completed." : result)
                        }
                    ).finally(() => setPending(false));
                }}
                readOnly={false}
                onSave={(value: string | undefined) => {
                    if (value !== undefined) {
                        const path = `${tempFileName}.${tempFileType}`;
                        // editorTileActions?.updateFile(tempFileName, tempFileType, value);
                        handleUpload({ [path]: value });
                        setSaved(true);
                    }
                }}
            />
        </div>
    )
}

export default Editor;
