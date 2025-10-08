import { NextRequest } from "next/server";
import { CodeSandbox } from "@codesandbox/sdk";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Env & SDK initialisation
// ---------------------------------------------------------------------------
const templateId = process.env.CODESANDBOX_TEMPLATE_ID;

// ---------------------------------------------------------------------------
// A tiny in-memory session registry
// ---------------------------------------------------------------------------
type TerminalEntry = {
  sandboxId: string;
  sandbox: any; // CodeSandbox Session type (not exported)
  terminal: any; // CodeSandbox Terminal type (not exported)
  outputBuffer: string;
};

const terminalStore: Map<string, TerminalEntry> = globalThis.__terminalStore__ ?? new Map();
// @ts-ignore – persist across hot-reloads in dev
globalThis.__terminalStore__ = terminalStore;

// Extend globalThis so TS knows about the property above
declare global {
  // eslint-disable-next-line no-var
  var __terminalStore__: Map<string, TerminalEntry> | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function ensureSandbox(userId: string) {
  // Look for an existing sandbox with title === userId, otherwise clone template
  const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
  const list = await sdk.sandbox.list();
  let sandboxId = list.sandboxes.find((s: any) => s.title === userId)?.id;
  if (!sandboxId) {
    const sandbox = await sdk.sandbox.create({ title: userId, template: templateId });
    sandboxId = sandbox.id;
  }
  return sandboxId;
}

async function createTerminal(
  userId: string,
  shell: string = "bash",
  cwd: string = "/project/workspace"
) {
  const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
  const sandboxId = await ensureSandbox(userId);
  // The current SDK typings don't yet expose .connect(), so cast to any
  const sandbox = await sdk.sandbox.open(sandboxId);
  const terminal = await sandbox.shells.create();

  if (shell === "zsh") {
    terminal.write("zsh\n");
  }

  if (cwd !== "/project/workspace") {
    terminal.write(`cd "${cwd}"\n`);
  }

  const sessionId = randomUUID();
  terminalStore.set(sessionId, { sandboxId: sandbox.id, sandbox, terminal, outputBuffer: "" });

  terminal.onOutput((output) => {
    const entry = terminalStore.get(sessionId);
    if (!entry) throw new Error("Invalid session_id");
    entry.outputBuffer += output;
  });

  return { sessionId };
}

async function runCommand(sessionId: string, command: string) {
  const entry = terminalStore.get(sessionId);
  if (!entry) throw new Error("Invalid session_id");

  // Run the command and wait until it exits or times out (5 min cap)
  const { terminal } = entry;
  const cmdPromise = terminal.write(command);

  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Execution timed out")), 300_000); // 5 min
  });

  try {
    const res = await Promise.race([cmdPromise, timeout]);
    if (timeoutId) clearTimeout(timeoutId);
    return res; // { exitCode, output }
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    throw err;
  }
}

async function getOutput(sessionId: string) {
  const entry = terminalStore.get(sessionId);
  if (!entry) throw new Error("Invalid session_id");
  const { terminal } = entry;
  const outputReturn = entry.outputBuffer;
  entry.outputBuffer = "";
  return outputReturn;
}

async function killSession(sessionId: string) {
  const entry = terminalStore.get(sessionId);
  if (!entry) throw new Error("Invalid session_id");
  await entry.terminal.kill();
  terminalStore.delete(sessionId);
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId) {
    return Response.json({ detail: "Missing session_id" }, { status: 400 });
  }

  try {
    const output = await getOutput(sessionId);    // existing helper
    return Response.json({ output });
  } catch (err: any) {
    console.error("[terminal] GET error", err);
    return Response.json(
      { detail: err.message ?? "Failed to get output" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body.user_id as string | undefined;
    const shell = (body.shell as string | undefined) ?? "bash";
    const cwd  = (body.cwd  as string | undefined) ?? "/project/workspace";

    if (!userId) return Response.json({ detail: "Missing user_id" }, { status: 400 });

    try {
      const { sessionId } = await createTerminal(userId, shell, cwd);
      return Response.json({ session_id: sessionId, shell, cwd });
    } catch (err: any) {
      console.error("[terminal] create error", err);
      return Response.json({ detail: "Failed to create terminal" }, { status: 500 });
    }
  } catch (err: any) {
    console.error("[terminal] POST error", err);
    return Response.json({ detail: "Failed to create terminal" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id: sessionId, command } = body as { session_id?: string; command?: string };

    if (!sessionId || typeof command !== "string")
      return Response.json({ detail: "Missing session_id or command" }, { status: 400 });

    const outputBefore = await getOutput(sessionId);
    const res = await runCommand(sessionId, command);
    return Response.json({ res });
  } catch (err: any) {
    console.error("[terminal] PUT error", err);
    const status = err?.message === "Execution timed out" ? 408 : 500;
    return Response.json({ detail: err.message ?? "Failed to run command" }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = body.session_id as string | undefined;
    if (!sessionId) return Response.json({ detail: "Missing session_id" }, { status: 400 });

    await killSession(sessionId);
    return Response.json({ detail: "Session terminated" });
  } catch (err: any) {
    console.error("[terminal] DELETE error", err);
    return Response.json({ detail: "Failed to terminate session" }, { status: 500 });
  }
}
