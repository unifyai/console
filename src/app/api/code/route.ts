import { NextRequest, NextResponse } from "next/server";
import { demos } from "@/constants/logs";
import { CodeSandbox } from "@codesandbox/sdk";
import { getCurrentUser } from "@/lib/user/user";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;
const templateId = process.env.CODESANDBOX_TEMPLATE_ID;

type EditorEntry = {
    output: string;
    done?: boolean;
}

const editorStore: Map<string, EditorEntry> = globalThis.__editorStore__ ?? new Map();
// @ts-ignore – persist across hot-reloads in dev
globalThis.__editorStore__ = editorStore;

declare global {
    // eslint-disable-next-line no-var
    var __editorStore__: Map<string, EditorEntry> | undefined;
}

export async function GET(request: NextRequest) {
    const filePath = new URL(request.url).searchParams.get("file_path");
    if (filePath) {
        const entry = editorStore.get(filePath);
        if (!entry) return Response.json({ output: "", done: false });
        const entryRet = entry;
        if (entry.done) {
            editorStore.delete(filePath);
        }
        return Response.json(entryRet);
    }
    return Response.json({ detail: "No file path provided" }, { status: 400 });
}

export async function POST(request: NextRequest) {
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.api_key || request.headers.get("apiKey");
    
    const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
    const body = await request.json();
    const userId = body.user_id;
    const project_name = body.project_name;
    const filePath = body.file_path;

    const sandboxList = await sdk.sandbox.list();
    let sandboxId = sandboxList.sandboxes.find(sandbox => sandbox.title === userId)?.id;
    if (sandboxId == null) {
        const sandbox = await sdk.sandbox.create({
            title: userId,
            template: templateId,
            hibernationTimeoutSeconds: 300,
        });
        sandboxId = sandbox.id;
    }
    const sandbox = await sdk.sandbox.open(sandboxId);
    let envVars: { [key: string]: string } = {
        UNIFY_KEY: apiKey as string,
        UNIFY_PROJECT: project_name,
    };
    if (baseUrl.includes("staging")) {
        envVars = {
            ...envVars,
            UNIFY_BASE_URL: baseUrl,
        };
    }

    // Merge additional env variables provided by client (if any), without overriding defaults unless explicitly duplicated
    if (body.env && typeof body.env === "object") {
        envVars = {
            ...envVars,
            ...body.env,
        };
    }

    // Build full path inside project directory
    const fullPath = `${project_name}/${filePath}`;

    // create command to run code
    editorStore.set(fullPath, { output: "", done: false });

    const command = sandbox.shells.run(`python "${fullPath}"`, {
        env: envVars,
    });

    command.onOutput((output) => {
        const entry = editorStore.get(fullPath);
        if (!entry) return;
        entry.output += output;
    });

    // Run in background without blocking the HTTP response
    (async () => {
        let timeoutId: NodeJS.Timeout | undefined;
        const timeout = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                try {
                    command.kill();
                } catch {
                    /* ignore */
                }
                reject(new Error("Execution timed out"));
            }, 300000);
        });

        try {
            await Promise.race([
                command.catch(() => { /* handled below */ }),
                timeout,
            ]);
        } catch (e) {
            const entry = editorStore.get(fullPath);
            if (entry) {
                entry.output += `\n[Error] ${(e as Error).message}`;
                entry.done = true;
            }
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            const entry = editorStore.get(fullPath);
            if (entry) entry.done = true;
        }
    })();

    // Immediately respond that execution has started
    return Response.json({ status: "running" }, { status: 202 });
}
