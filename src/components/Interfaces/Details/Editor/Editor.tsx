"use client";

import CodeBlock from "../../CodeBlock";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Input } from "@/components/UI/input";
import { fileTypes } from "@/constants/logs";
import { CodeActions, FileActions } from "@/types/evals/grid";
import { useTabData } from "@/contexts/hooks/tab";
import { useTiles } from "@/contexts/hooks";
import Tooltip from "@/components/Common/Misc/Tooltip";
import { useEditorTileSync } from "@/contexts/hooks/tile/sync";
import { GranularTileActions, ProjectsActions, ContextActions, LogsActions, FieldsActions } from "@/types/evals/grid";
import ActionButton from "@/components/Common/Buttons/Action";
import FileDirectory from "@/components/Tree/Directory/FileDirectory";
import { FilePlus, FolderPlus, Trash2, Plus } from "lucide-react";
import { FileEntry } from "@/types/evals/grid";
import EditableSecret from "@/components/Common/Code/EditableSecret";

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
    // Maintain list of file entries (name + type). Content is fetched lazily on demand
    const [allFiles, setAllFiles] = useState<FileEntry[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);

    /* ------------------------------------------------------------------
       Helpers
    ------------------------------------------------------------------*/
    const fetchFiles = useCallback(async () => {
        try {
            const res = await fileActions.list(projectId) as any;

            let fileEntries: FileEntry[] = [];

            const normalize = (obj: any): FileEntry => ({
                name: obj.name ?? obj,
                type: obj.type ?? "file",
                isSymlink: obj.isSymlink,
            });

            if (Array.isArray(res)) {
                // Either FileEntry[] or string[]
                if (res.length > 0 && typeof res[0] === "object") {
                    fileEntries = (res as any[]).map(normalize);
                } else {
                    fileEntries = (res as string[]).map((name) => ({ name, type: "file" }));
                }
            } else if (res && Array.isArray(res.files)) {
                const inner = res.files;
                if (inner.length > 0 && typeof inner[0] === "object") {
                    fileEntries = inner.map(normalize);
                } else {
                    fileEntries = inner.map((name: string) => ({ name, type: "file" }));
                }
            }

            setAllFiles(fileEntries);
        } catch (e) {
            console.error("Failed to list files", e);
        }
    }, [fileActions, projectId]);

    // initial load
    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    const [saved, setSaved] = useState(false);
    const [uploading, setUploading] = useState(false);

    const handleUpload = async (payload: Record<string,string>) => {
        try {
            setUploading(true);
            await fileActions.write(projectId, payload);
            await fetchFiles();
        } catch (e) { console.error('upload error', e); }
        finally { setUploading(false); }
    };

    const handleDelete = async (path: string, isDirectory: boolean = false) => {
        try {
            await fileActions.delete(projectId, path, isDirectory);
            await fetchFiles();
        } catch (e) { console.error('delete error', e); }
    };

    const handleRename = async (oldPath: string, newPath: string, code?: string, isDirectory: boolean = false) => {
        try {
            if (!isDirectory) {
                if (!code) {
                    const res: any = await fileActions.read(projectId, oldPath);
                    const content = (res && typeof res === "object" && "content" in res) ? (res as any).content : "";
                    await handleUpload({ [newPath]: content });
                } else {
                    await handleUpload({ [newPath]: code });
                }
                await handleDelete(oldPath, isDirectory);
            } else {
                await fileActions.rename(projectId, oldPath, newPath);
            }
            await fetchFiles();
        } catch (e) { console.error('rename error', e); }
    };

    const initialFileName = (editorTileState?.file_type === "env" && editorTileState?.file_name === "")
        ? ""
        : (editorTileState?.file_name ?? "main");
    const [tempFileName, setTempFileName] = useState(initialFileName);
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
    const [pending, setPending] = useState(false);
    const [complete, setComplete] = useState(false);
    const [output, setOutput] = useState("");

    /* FileDirectory dialog open state */
    const [selectFilesOpen, setSelectFilesOpen] = useState(false);

    const language = fileTypes[editorTileState?.file_type || "txt"] || "text";

    useEffect(() => {
        if (saved)
            setTimeout(() => setSaved(false), 2000);
    }, [saved]);

    useEffect(() => {
        if (!pending && output !== "")
            setComplete(true);
    }, [pending, output]);

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

    useEffect(() => {
        const id = setInterval(async () => {
          if (!pending) return;
          try {
            // @ts-ignore helper exists
            const res = await codeActions.get(`${projectId}/${tempFileName}.${tempFileType}`);
            if (res?.output) {
              setOutput(res.output.replaceAll("/project/sandbox/", ""));
              if (res.done) setPending(false);
            } else if (res?.done) {
              setOutput("Script execution completed.");
              setPending(false);
            }
          } catch {}
        }, 1000);
    
        return () => clearInterval(id);
      }, [pending, codeActions, projectId, tempFileName, tempFileType]);

    // Memoized env variables parsing
    const envVars = useMemo(() => {
        if (tempFileType !== "env") return [] as { key: string; value: string }[];
        return tempCode.split("\n").filter(Boolean).map(line => {
            const [k,...rest] = line.split("=");
            return { key: k, value: rest.join("=") };
        });
    }, [tempCode, tempFileType]);

    const updateEnvValue = async (key:string, newVal:string) => {
        const newLines = envVars.map(ev => ev.key===key?`${key}=${newVal}`:`${ev.key}=${ev.value}`);
        const newContent = newLines.join("\n");
        setTempCode(newContent);
        editorTileActions?.setContent(newContent);
        await handleUpload({ [`.env`]: newContent });
    };

    const updateEnvKey = async (oldKey:string, newKey:string) => {
        if (!newKey || oldKey === newKey) return;
        const newLines = envVars.map(ev => ev.key===oldKey?`${newKey}=${ev.value}`:`${ev.key}=${ev.value}`);
        const newContent = newLines.join("\n");
        setTempCode(newContent);
        editorTileActions?.setContent(newContent);
        await handleUpload({ [`.env`]: newContent });
    };

    const deleteEnvVar = async (delKey:string) => {
        const newLines = envVars.filter(ev => ev.key !== delKey).map(ev => `${ev.key}=${ev.value}`);
        const newContent = newLines.join("\n");
        setTempCode(newContent);
        editorTileActions?.setContent(newContent);
        await handleUpload({ [`.env`]: newContent });
        if (newContent === "") {
            const res: any = await fileActions.read(projectId, ".env");
            const content = (res && typeof res === "object" && "content" in res) ? (res as any).content : "";
            setTempCode(content);
            editorTileActions?.setContent(content);
        }
    };

    const addEnvVar = async () => {
        const existingKeys = envVars.map(ev => ev.key);
        let base = "NEW_KEY";
        let idx = 1;
        let candidate = base;
        while (existingKeys.includes(candidate)) {
            candidate = `${base}_${idx++}`;
        }
        const newLines = [...envVars.map(ev => `${ev.key}=${ev.value}`), `${candidate}=`];
        const newContent = newLines.join("\n");
        setTempCode(newContent);
        editorTileActions?.setContent(newContent);
        await handleUpload({ [`.env`]: newContent });
    };

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex flex-row items-center ml-4 text-sm gap-1">
                <Tooltip content="File Name" side="top">
                    <Input
                        value={tempFileName}
                        disabled={tempFileType === "env"}
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
                        onChange={async (e) => {
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
                    {/* File selector using FileDirectory */}
                    <FileDirectory
                        type={projectId}
                        text=""
                        variant="ghost"
                        data={allFiles.map((f) => ({ path: f.name, type: f.type }))}
                        defaultValue={selectedPath}
                        setterFunction={async (file) => {
                            if (!file) return;
                            const path = file.path;
                            const dotIdx = path.lastIndexOf(".");
                            const ext = dotIdx !== -1 ? path.substring(dotIdx + 1) : "txt";
                            const name = dotIdx !== -1 ? path.substring(0, dotIdx) : path;
                            try {
                                const res: any = await fileActions.read(projectId, path);
                                const content: string = (res && typeof res === "object" && "content" in res) ? (res as any).content : "";
                                setTempFileName(name);
                                setTempFileType(ext);
                                setTempCode(content);
                                setSelectedPath(path);
                                editorTileActions?.setFileName(name);
                                editorTileActions?.setFileType(ext);
                                editorTileActions?.setContent(content);
                            } catch (e) {
                                console.error("Failed to read file", e);
                            }
                            // Close dialog if using controlled open state
                            setSelectFilesOpen(false);
                        }}
                        renamingFunction={async (oldPath, newPath) => { return { info: "Rename not implemented" }; }}
                        onOpen={() => {
                            setLoadingFiles(true);
                            fetchFiles().finally(() => setLoadingFiles(false));
                        }}
                        loading={loadingFiles}
                        hideAutocomplete
                        hideNewFolderButton
                        showDeleteFolder
                        deleteFolderFunction={(path) => handleDelete(path, true)}
                        customOpen={selectFilesOpen}
                        setCustomOpen={setSelectFilesOpen}
                    />
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
                                editorTileActions?.setFileName("main");
                                editorTileActions?.setFileType("txt");
                                editorTileActions?.setContent("");
                            }
                        }}
                    />
                </div>
                {uploading && <div className="text-sm text-muted-foreground">Uploading...</div>}
                {saved && <div className="text-primary text-sm font-semibold">File saved!</div>}
            </div>
            {tempFileType !== "env" ? (
            <CodeBlock
                code={tempCode}
                output={output}
                language={language}
                pending={pending}
                complete={complete}
                create={null}
                disabled={false}
                setTempCode={setTempCode}
                onRun={async (code: string) => {
                    setPending(true);
                    setOutput("");
                    editorTileActions?.setFileName(tempFileName);
                    editorTileActions?.setFileType(tempFileType);
                    editorTileActions?.setContent(code);

                    try {
                        const tempFilePath = `${tempFileName}.${tempFileType}`;
                        if (selectedPath && allFiles.find((f) => f.name === selectedPath) && selectedPath !== tempFilePath) {
                            await handleRename(selectedPath, tempFilePath, code);
                        }
                        // Read freshest .env file from project (if exists) to build env vars
                        let envObject: { [key: string]: string } = {};
                        try {
                            const res: any = await fileActions.read(projectId, ".env");
                            const envContent: string = (res && typeof res === "object" && "content" in res) ? res.content : "";
                            if (envContent) {
                                envContent.split("\n").filter(Boolean).forEach(line => {
                                    const [k, ...rest] = line.split("=");
                                    envObject[k] = rest.join("=");
                                });
                            }
                        } catch (e) {
                            // .env might not exist, ignore
                        }
                        // Save / overwrite file first
                        await handleUpload({ [tempFilePath]: code });
                        setSelectedPath(tempFilePath);
                        const result: any = await codeActions.run(projectId, tempFilePath, envObject);
                    } catch (err) {
                        console.error(err);
                        setOutput("Failed to run code");
                    }
                }}
                readOnly={false}
                onSave={async (value: string | undefined) => {
                    if (value !== undefined) {
                        const path = `${tempFileName}.${tempFileType}`;
                        if (selectedPath && allFiles.find((f) => f.name === selectedPath) && selectedPath !== path) {
                            await handleRename(selectedPath, path, value);
                        }
                        editorTileActions?.setContent(value);
                        await handleUpload({ [path]: value });
                        setSelectedPath(path);
                        setSaved(true);
                    }
                }}
            />
            ) : (
              <div className="flex flex-col p-4 gap-2 overflow-auto">
                {envVars.map(({key,value}, idx) => (
                  <div key={`${key}-${idx}`} className="flex items-center gap-2">
                    <EditableSecret className="w-24" conceal={false} value={key} onSave={(newKey: string)=>updateEnvKey(key,newKey)} />
                    <span className="font-mono text-foreground">=</span>
                    <EditableSecret className="w-24" value={value} onSave={(v: string)=>updateEnvValue(key,v)} />
                    <ActionButton
                      icon={<Trash2 size={14} />}
                      variant="ghost"
                      tooltip="Delete secret"
                      onClick={()=>deleteEnvVar(key)}
                    />
                  </div>
                ))}
                <ActionButton
                  icon={<Plus size={16} />}
                  variant="ghost"
                  tooltip="Add secret"
                  onClick={addEnvVar}
                  className="mt-2 self-start"
                />
              </div>
            )}
        </div>
    )
}

export default Editor;
