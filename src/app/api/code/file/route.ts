import { NextRequest } from "next/server";
import { CodeSandbox } from "@codesandbox/sdk";

// ---------------------------------------------------------------------------
// Env & SDK initialisation
// ---------------------------------------------------------------------------
const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
const templateId = process.env.CODESANDBOX_TEMPLATE_ID;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function ensureSandbox(userId: string) {
  // Look for an existing sandbox with title === userId, otherwise clone template
  const list = await sdk.sandbox.list();
  let sandboxId = list.sandboxes.find((s: any) => s.title === userId)?.id;
  if (!sandboxId) {
    const sandbox = await sdk.sandbox.create({ title: userId, template: templateId });
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

    // Ensure sandbox exists and open the FS
    const sandboxId = await ensureSandbox(userId);
    const sandbox = await sdk.sandbox.open(sandboxId);

    const filePath = buildFilePath(project, filename);
    const encoded = new TextEncoder().encode(content);
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
   * Expected JSON body: { user_id, project, filename }
   */
  try {
    const { user_id: userId, project, filename } = await request.json();

    if (!userId || !project || !filename) {
      return Response.json({ detail: "Missing user_id, project or filename" }, { status: 400 });
    }

    const sandboxId = await ensureSandbox(userId);
    const sandbox = await sdk.sandbox.open(sandboxId);

    const filePath = buildFilePath(project, filename);
    await sandbox.fs.remove(filePath);

    return Response.json({ detail: "File deleted", file_path: filePath });
  } catch (err: any) {
    console.error("[file] DELETE error", err);
    return Response.json({ detail: "Failed to delete file" }, { status: 500 });
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
      console.log("decoded", decoded);
      return Response.json({ content: decoded });
    }
  } catch (err: any) {
    console.error("[file] GET error", err);
    return Response.json({ detail: "Failed to read from filesystem" }, { status: 500 });
  }
}
