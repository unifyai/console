import { NextRequest } from "next/server";
import { CodeSandbox } from "@codesandbox/sdk";

// ---------------------------------------------------------------------------
// Env & SDK initialisation
// ---------------------------------------------------------------------------
const templateId = process.env.CODESANDBOX_TEMPLATE_ID;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function ensureSandbox(userId: string) {
  // Look for an existing sandbox with title === userId, otherwise clone template
  const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
  const list = await sdk.sandbox.list();
  let sandboxId = list.sandboxes.find((s: any) => s.title === userId)?.id;
  if (!sandboxId) {
    const sandbox = await sdk.sandbox.create({ title: userId, template: templateId, hibernationTimeoutSeconds: 300 });
    sandboxId = sandbox.id;
  }
  return sandboxId;
}

function buildFilePath(project: string, filename?: string) {
  // Always place files under their project directory inside the sandbox.
  return filename ? `${project}/${filename}` : project;
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  /**
   * Create or overwrite a file inside the CodeSandbox FS.
   * Expected JSON body: { user_id, project, filename, content }
   */
  try {
    const { user_id: userId, project, filename, content } = await request.json();

    if (!userId || !project || !filename || typeof content !== "string") {
      return Response.json({ detail: "Missing user_id, project, filename or content" }, { status: 400 });
    }

    let contentToWrite = content;
    if (filename === ".env" && content === "") {
      contentToWrite = `UNIFY_KEY=${request.headers.get("apiKey")}\nUNIFY_PROJECT=${project}`;
    }

    // Ensure sandbox exists and open the FS
    const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
    const sandboxId = await ensureSandbox(userId);
    const sandbox = await sdk.sandbox.open(sandboxId);

    const filePath = buildFilePath(project, filename);
    const encoded = new TextEncoder().encode(contentToWrite);
    await sandbox.fs.writeFile(filePath, encoded);

    return Response.json({ detail: "File written", file_path: filePath });
  } catch (err: any) {
    console.error("[file] POST error", err);
    return Response.json({ detail: "Failed to write file" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  /**
   * Delete a file from the CodeSandbox FS.
   * Expected JSON body: { user_id, project, filename, isDirectory }
   */
  try {
    const { user_id: userId, project, filename, isDirectory = false } = await request.json();

    if (!userId || !project || (!isDirectory && !filename)) {
      return Response.json({ detail: "Missing user_id, project or filename" }, { status: 400 });
    }

    const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
    const sandboxId = await ensureSandbox(userId);
    const sandbox = await sdk.sandbox.open(sandboxId);

    const filePath = buildFilePath(project, filename);

    if (isDirectory) {
      // Use shell command to remove directory recursively
      const cmd = sandbox.shells.run(`rm -rf "${filePath}"`);
      await cmd;
    } else {
      await sandbox.fs.remove(filePath);
    }

    return Response.json({ detail: "File or directory deleted", file_path: filePath });
  } catch (err: any) {
    console.error("[file] DELETE error", err);
    return Response.json({ detail: "Failed to delete file" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  /**
   * Rename a file inside the CodeSandbox FS.
   * Expected JSON body: { user_id, project, old_filename, new_filename }
   */
  try {
    const { user_id: userId, project, old_filename, new_filename } = await request.json();

    if (!userId || !project || !old_filename || !new_filename) {
      return Response.json({ detail: "Missing user_id, project, old_filename or new_filename" }, { status: 400 });
    }

    const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
    const sandboxId = await ensureSandbox(userId);
    const sandbox = await sdk.sandbox.open(sandboxId);

    const oldPath = buildFilePath(project, old_filename);
    const newPath = buildFilePath(project, new_filename);

    const cmd = sandbox.shells.run(`mv "${oldPath}" "${newPath}"`);
    await cmd;

    return Response.json({ detail: "File renamed", old_path: oldPath, new_path: newPath });
  } catch (err: any) {
    console.error("[file] PUT error", err);
    return Response.json({ detail: "Failed to rename file" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  /**
   * Retrieve file content or list project directory.
   * Search params: user_id, project, filename?, isDirectory ("true" | "false")
   */
  const params = new URL(request.url).searchParams;
  const userId = params.get("user_id");
  const project = params.get("project");
  const filename = params.get("filename") ?? undefined;
  const isDirectory = params.get("isDirectory") === "true";

  if (!userId || !project) {
    return Response.json({ detail: "Missing user_id or project" }, { status: 400 });
  }

  try {
    const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
    const sandboxId = await ensureSandbox(userId);
    const sandbox = await sdk.sandbox.open(sandboxId);

    if (isDirectory) {
      // Recursively list files/folders under the project directory

      const readDirRecursive = async (currentPath: string, prefix: string, visited: Set<string>): Promise<any[]> => {
        // Avoid cycles (e.g. via symlinks)
        if (visited.has(currentPath)) return [];
        visited.add(currentPath);

        const entries: any[] = await sandbox.fs.readdir(currentPath);
        const results: any[] = [];

        for (const entry of entries) {
          // Build new name with prefix
          const fullName = prefix ? `${prefix}${entry.name}` : entry.name;
          results.push({ ...entry, name: fullName });

          // Recurse into directories (skip symlinked dirs to avoid loops)
          if (entry.type === "directory" && !entry.isSymlink) {
            const childPath = `${currentPath}/${entry.name}`;
            const childPrefix = `${fullName}/`;
            const childEntries = await readDirRecursive(childPath, childPrefix, visited);
            results.push(...childEntries);
          }
        }
        return results;
      };

      const dirPath = buildFilePath(project);
      const files = await readDirRecursive(dirPath, "", new Set());
      return Response.json({ files });
    } else {
      if (!filename) {
        return Response.json({ detail: "Missing filename for file read" }, { status: 400 });
      }
      const filePath = buildFilePath(project, filename);
      const data = await sandbox.fs.readFile(filePath);
      const decoded = new TextDecoder().decode(data);
      return Response.json({ content: decoded });
    }
  } catch (err: any) {
    console.error("[file] GET error", err);
    return Response.json({ detail: "Failed to read from filesystem" }, { status: 500 });
  }
}

