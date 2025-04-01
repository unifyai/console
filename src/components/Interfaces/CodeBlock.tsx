import Link from "next/link";
import { ExternalLink, Loader2, Play } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import { CopyButton } from "../Common/Buttons/Copy";
import { Editor } from "@monaco-editor/react";

const CodeBlock = ({
    code,
    language = "python",
    demoLink,
    pendingLocal,
    create,
    onRunDemo,
    disabled
}: {
    code: string;
    language?: string;
    demoLink?: string;
    pendingLocal: boolean;
    create: string | null;
    onRunDemo: () => void;
    disabled: boolean;
}) => {
    return (<>
        <div className="absolute z-10 top-2 right-0 px-4 py-1 rounded-md flex gap-1 text-[var(--white-smoke)]">
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
            <CopyButton content={code} copyMessage="Copied!" />
        </div>
        <div className="h-full w-full">
            <Editor
                height="100%"
                width="100%"
                options={{
                    automaticLayout: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    readOnly: true,
                }}
                theme="vs-dark"
                language={language}
                value={code}
            />
        </div>
    </>);
}

export default CodeBlock;
