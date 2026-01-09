import { NextRequest, NextResponse } from "next/server";
import { CodeSandbox } from "@codesandbox/sdk";
import { getCurrentUser } from "@/lib/user/user";

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

function buildFilePath(projectName: string, filename?: string) {
  // Always place files under their project directory inside the sandbox.
  return filename ? `${projectName}/${filename}` : projectName;
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  /**
   * Create or overwrite a file inside the CodeSandbox FS.
   * Expected JSON body: { userId, projectName, filename, content }
   */
  try {
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.apiKey || request.headers.get("apiKey");
    
    const { userId: userId, projectName, filename, content } = await request.json();

    if (!userId || !projectName || !filename || typeof content !== "string") {
      return NextResponse.json({ detail: "Missing userId, projectName, filename or content" }, { status: 400 });
    }

    let contentToWrite = content;
    if (filename === ".env" && content === "") {
      contentToWrite = `UNIFY_KEY=${apiKey}\nUNIFY_PROJECT=${projectName}`;
    }

    // Ensure sandbox exists and open the FS
    const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
    const sandboxId = await ensureSandbox(userId);
    const sandbox = await sdk.sandbox.open(sandboxId);

    const filePath = buildFilePath(projectName, filename);
    const encoded = new TextEncoder().encode(contentToWrite);
    await sandbox.fs.writeFile(filePath, encoded);

    return Response.json({ detail: "File written", filePath: filePath });
  } catch (err: any) {
    console.error("[file] POST error", err);
    return Response.json({ detail: "Failed to write file" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  /**
   * Delete a file from the CodeSandbox FS.
   * Expected JSON body: { userId, projectName, filename, isDirectory }
   */
  try {
    const { userId: userId, projectName, filename, isDirectory = false } = await request.json();

    if (!userId || !projectName || (!isDirectory && !filename)) {
      return Response.json({ detail: "Missing userId, projectName or filename" }, { status: 400 });
    }

    const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
    const sandboxId = await ensureSandbox(userId);
    const sandbox = await sdk.sandbox.open(sandboxId);

    const filePath = buildFilePath(projectName, filename);

    if (isDirectory) {
      // Use shell command to remove directory recursively
      const cmd = sandbox.shells.run(`rm -rf "${filePath}"`);
      await cmd;
    } else {
      await sandbox.fs.remove(filePath);
    }

    return Response.json({ detail: "File or directory deleted", filePath: filePath });
  } catch (err: any) {
    console.error("[file] DELETE error", err);
    return Response.json({ detail: "Failed to delete file" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  /**
   * Rename a file inside the CodeSandbox FS.
   * Expected JSON body: { userId, projectName, oldFilename, newFilename }
   */
  try {
    const { userId: userId, projectName, oldFilename, newFilename } = await request.json();

    if (!userId || !projectName || !oldFilename || !newFilename) {
      return Response.json({ detail: "Missing userId, projectName, oldFilename or newFilename" }, { status: 400 });
    }

    const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
    const sandboxId = await ensureSandbox(userId);
    const sandbox = await sdk.sandbox.open(sandboxId);

    const oldPath = buildFilePath(projectName, oldFilename);
    const newPath = buildFilePath(projectName, newFilename);

    const cmd = sandbox.shells.run(`mv "${oldPath}" "${newPath}"`);
    await cmd;

    return Response.json({ detail: "File renamed", oldPath: oldPath, newPath: newPath });
  } catch (err: any) {
    console.error("[file] PUT error", err);
    return Response.json({ detail: "Failed to rename file" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  /**
   * Retrieve file content or list project directory.
   * Search params: userId, projectName, filename?, isDirectory ("true" | "false")
   */
  const params = new URL(request.url).searchParams;
  const userId = params.get("userId");
  const projectName = params.get("projectName");
  const filename = params.get("filename") ?? undefined;
  const isDirectory = params.get("isDirectory") === "true";

  if (!userId || !projectName) {
    return Response.json({ detail: "Missing userId or projectName" }, { status: 400 });
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

      const dirPath = buildFilePath(projectName);
      const files = await readDirRecursive(dirPath, "", new Set());
      return Response.json({ files });
    } else {
      if (!filename) {
        return Response.json({ detail: "Missing filename for file read" }, { status: 400 });
      }
      const filePath = buildFilePath(projectName, filename);
      const data = await sandbox.fs.readFile(filePath);
      const decoded = new TextDecoder().decode(data);
      return Response.json({ content: decoded });
    }
  } catch (err: any) {
    console.error("[file] GET error", err);
    return Response.json({ detail: "Failed to read from filesystem" }, { status: 500 });
  }
}

