"use client";

import Link from "next/link";
import { ExternalLink, Loader2, Play, Save } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import { CopyButton } from "../Common/Buttons/Copy";
import { Editor } from "@monaco-editor/react";
import { useState, useEffect } from "react";
import { DoublePanels } from "../Common/Body/DoublePanels";

const CodeBlock = ({
    code,
    language,
    demoLink,
    pendingLocal,
    create,
    disabled,
    readOnly,
    onRunDemo,
    onSave,
}: {
    code: string;
    language: string | undefined;
    demoLink?: string;
    pendingLocal: boolean;
    create: string | null;
    disabled: boolean;
    readOnly?: boolean;
    onRunDemo: () => void;
    onSave?: (value: string | undefined) => void;
}) => {
    const [tempCode, setTempCode] = useState(code);
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (!readOnly && onSave) {
                    onSave(tempCode);
                    setSaved(true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [tempCode, readOnly, onSave]);

    useEffect(() => {
        if (saved)
            setTimeout(() => setSaved(false), 2000);
    }, [saved]);

    return (<>
        <div className="absolute z-10 top-2 right-3 py-1 rounded-md flex gap-1 text-[var(--white-smoke)]">
            {demoLink && <Link href={`https://docs.unify.ai/${demoLink}`} target="_blank">
                <ActionButton icon={<ExternalLink />} tooltip={"Learn more"} />
            </Link>}
            <ActionButton
                icon={(pendingLocal || create != null)
                    ? <Loader2 className="animate-spin" />
                    : <Play />
                }
                tooltip={"Run Demo"}
                onClick={onRunDemo}
                disabled={disabled}
            />
            {!readOnly && <ActionButton
                icon={<Save />}
                tooltip={"Save"}
                onClick={() => {
                    if (onSave != undefined) {
                        onSave(tempCode);
                        setSaved(true);
                    }
                }}
            />}
            <CopyButton content={code} copyMessage="Copied!" />
        </div>
        <div className={`h-full w-full ${!readOnly ? "p-4" : ""}`}>
            {readOnly ? <Editor
                options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    readOnly: readOnly,
                    padding: {
                        top: 24,
                        bottom: 24,
                    },
                    fontSize: !readOnly ? 14 : undefined
                }}
                theme="vs-dark"
                language={language}
                value={code}
                onChange={(value) => setTempCode(value || "")}
            /> : <>
                {saved && <div className="text-primary text-sm font-semibold">Saved!</div>}
                <DoublePanels
                    isLoading={false}
                    direction="vertical"
                    defaultSecondSize={5.3}
                    first={<Editor
                        options={{
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            wordWrap: "on",
                            readOnly: readOnly,
                            padding: {
                                top: 24,
                                bottom: 24,
                            },
                            fontSize: !readOnly ? 14 : undefined
                        }}
                        theme="vs-dark"
                        language={language}
                        value={code}
                        onChange={(value) => setTempCode(value || "")}
                    />}
                    second={<div className="pt-2 h-full w-full flex flex-col gap-2">
                        <div className="font-semibold text-gray-400">Output</div>
                        <div className="h-full w-full">
                            <Editor
                                options={{
                                    minimap: { enabled: false },
                                    scrollBeyondLastLine: false,
                                    wordWrap: "on",
                                    lineNumbers: "off",
                                    readOnly: true,
                                    padding: {
                                        top: 12,
                                        bottom: 12,
                                    },
                                    fontSize: 14,
                                    renderLineHighlight: "none",
                                    hideCursorInOverviewRuler: true,
                                    overviewRulerBorder: false,
                                    overviewRulerLanes: 0,
                                    scrollbar: {
                                        vertical: "hidden",
                                        horizontal: "hidden",
                                        useShadows: false,
                                        verticalScrollbarSize: 0,
                                        horizontalScrollbarSize: 0
                                    },
                                    glyphMargin: false,
                                    folding: false,
                                    lineDecorationsWidth: 20,
                                    lineNumbersMinChars: 0,
                                    guides: {
                                        indentation: false,
                                        highlightActiveIndentation: false
                                    },
                                    cursorStyle: "line-thin",
                                    cursorBlinking: "solid"
                                }}
                                theme="vs-dark"
                                value={code}
                            />
                        </div>
                    </div>}
                />
            </>}
        </div>
    </>);
}

export default CodeBlock;
