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
  mountBase?: string;
  mountPoints?: string[];
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
    terminal.write(`mkdir -p "${cwd}"\n`);
    terminal.write(`cd "${cwd}"\n`);
  }

  // terminal.write("clear\n");

  const sessionId = randomUUID();
  terminalStore.set(sessionId, { sandboxId: sandbox.id, sandbox, terminal, outputBuffer: "" });

  terminal.onOutput((output) => {
    const entry = terminalStore.get(sessionId);
    if (!entry) throw new Error("Invalid session_id");
    entry.outputBuffer += output;
  });

  return { sessionId };
}

function buildGDriveMountScript(params: {
  assistantEmail: string;
  userLocal: string;
  mountBase: string;
}) {
  const { assistantEmail, userLocal, mountBase } = params;

  // The script relies on these environment variables being present in the shell:
  // - RCLONE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS_BASE64 (preferred)
  // - or RCLONE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS (raw JSON)
  // It writes the JSON to a local file and configures rclone to use it.

  const script = `
set -e
set -o pipefail

export RCLONE_IMPERSONATE_EMAIL="${assistantEmail}"
EMAIL="$RCLONE_IMPERSONATE_EMAIL"

# Ensure rclone is available (user-space install if missing)
if ! command -v rclone >/dev/null 2>&1; then
  echo "Installing rclone to $HOME/bin" >&2
  curl https://rclone.org/install.sh | bash
fi

mkdir -p "$HOME/.config/rclone"
# Build rclone.conf using env-based auth only, with unique remote names per user
REMOTE_BASE_NAME="gdrive_${userLocal}"
cat >> "$HOME/.config/rclone/rclone.conf" <<EOF
[$REMOTE_BASE_NAME]
type = drive
scope = drive
impersonate = $EMAIL
env_auth = true

EOF
chmod 600 "$HOME/.config/rclone/rclone.conf"

# Ensure jq exists (required); if missing, abort with a clear message
if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed" >&2
  exit 1
fi

# Query shared drives for this user's remote
DRIVES_JSON=$(rclone backend drives "$REMOTE_BASE_NAME:" || echo "[]")

# Prepare remote and mount name lists
REMOTE_NAMES=("$REMOTE_BASE_NAME")
MOUNT_NAMES=("gdrive")

# Append per-shared-drive sections
echo "$DRIVES_JSON" | jq -r '.[] | [.id, .name] | @tsv' | while IFS=$'\t' read -r DRIVE_ID DRIVE_NAME; do
  SAFE_NAME=$(echo "$DRIVE_NAME" | tr -cd '[:alnum:] _-' | tr ' ' '_')
  REMOTE_NAME="${'${userLocal}'}_${'${SAFE_NAME}'}_drive"
  {
    echo "[${'${REMOTE_NAME}'}]"
    echo "type = drive"
    echo "scope = drive"
    echo "env_auth = true"
    echo "impersonate = $EMAIL"
    echo "team_drive = ${'${DRIVE_ID}'}"
    echo "root_folder_id = "
    echo ""
  } >> "$HOME/.config/rclone/rclone.conf"
  REMOTE_NAMES+=("${'${REMOTE_NAME}'}")
  MOUNT_NAMES+=("${'${SAFE_NAME}'}_drive")
done

# Mount all remotes
MOUNT_BASE="${mountBase}"
mkdir -p "$MOUNT_BASE"

MOUNT_POINTS_FILE="$MOUNT_BASE/.mount_points"
: > "$MOUNT_POINTS_FILE"

for IDX in "${'${!REMOTE_NAMES[@]}'}"; do
  REMOTE="${'${REMOTE_NAMES[$IDX]}'}"
  MOUNT_NAME="${'${MOUNT_NAMES[$IDX]}'}"
  MOUNT_DIR="$MOUNT_BASE/$MOUNT_NAME"
  mkdir -p "$MOUNT_DIR"
  # best-effort daemon mount
  if rclone mount "$REMOTE:" "$MOUNT_DIR" --daemon; then
    echo "$MOUNT_DIR" >> "$MOUNT_POINTS_FILE"
  fi
done

echo "gdrive mounts ready under $MOUNT_BASE"
`;

  return script;
}

async function setupGDriveMount(sessionId: string, assistantEmail: string, mountBase: string) {
  const entry = terminalStore.get(sessionId);
  if (!entry) throw new Error("Invalid session_id");

  const userLocal = (assistantEmail.split("@")[0] || "user").replace(/[^a-zA-Z0-9_-]/g, "_");
  const script = buildGDriveMountScript({ assistantEmail, userLocal, mountBase });
  // Run script non-interactively via bash -lc; do not block the request
  // Escape newlines safely by using a here-doc
  const command = `bash -lc 'set -e; tmpfile=$(mktemp); cat >"$tmpfile" <<"EOS"\n${script}\nEOS\n bash "$tmpfile" || true; rm -f "$tmpfile"'`;
  await runCommand(sessionId, command);

  const updated = terminalStore.get(sessionId);
  if (updated) {
    updated.mountBase = mountBase;
  }
}

async function cleanupMounts(sessionId: string) {
  const entry = terminalStore.get(sessionId);
  if (!entry) return;
  const mountBase = entry.mountBase || "google_drives";
  const cleanupScript = `
set -e
MOUNT_BASE="${mountBase}"
POINTS_FILE="$MOUNT_BASE/.mount_points"
if [ -f "$POINTS_FILE" ]; then
  while IFS= read -r MP; do
    [ -n "$MP" ] || continue
    if [ -d "$MP" ] && command -v mountpoint >/dev/null 2>&1 && mountpoint -q "$MP"; then
      if command -v fusermount >/dev/null 2>&1; then
        fusermount -u "$MP" || umount "$MP" || true
      else
        umount "$MP" || true
      fi
    fi
  done < "$POINTS_FILE"
fi
`;
  const command = `bash -lc 'set -e; tmpfile=$(mktemp); cat >"$tmpfile" <<"EOS"\n${cleanupScript}\nEOS\n bash "$tmpfile" || true; rm -f "$tmpfile"'`;
  try {
    await runCommand(sessionId, command);
  } catch (_) {
    // ignore cleanup errors
  }
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
    const mountGdrive = (body.mount_gdrive as boolean | undefined) ?? true;

    if (!userId) return Response.json({ detail: "Missing user_id" }, { status: 400 });

    try {
      const { sessionId } = await createTerminal(userId, shell, cwd);
      if (mountGdrive) {
        // Fetch assistant emails internally
        let assistantEmail: string | undefined;
        try {
          const emailsRes = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/emails`, {
            method: "GET",
            headers: {
              apiKey: req.headers.get("apiKey") || "",
            },
            cache: 'no-store',
          });
          if (emailsRes.ok) {
            const data = await emailsRes.json();
            const emails: string[] = data?.emails || [];
            assistantEmail = emails.find((e: string) => typeof e === 'string' && e.includes('@'));
          }
        } catch (e) {
          console.error("[terminal] failed to fetch assistant emails", e);
        }

        if (assistantEmail) {
          const localPart = assistantEmail.split("@")[0] || "user";
          const safeLocal = localPart.replace(/[^a-zA-Z0-9_-]/g, "_");
          const mountBase = `google_drives/${safeLocal}`;
          try {
            await setupGDriveMount(sessionId, assistantEmail, mountBase);
          } catch (e) {
            console.error("[terminal] gdrive mount setup error", e);
          }
          return Response.json({ session_id: sessionId, shell, cwd, mount_base: mountBase });
        }
      }
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

    try {
      await cleanupMounts(sessionId);
    } catch (e) {
      console.error("[terminal] cleanup error", e);
    }
    await killSession(sessionId);
    return Response.json({ detail: "Session terminated" });
  } catch (err: any) {
    console.error("[terminal] DELETE error", err);
    return Response.json({ detail: "Failed to terminate session" }, { status: 500 });
  }
}
