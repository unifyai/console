import { NextRequest } from "next/server";
import { demos } from "@/constants/logs";
import { CodeSandbox } from "@codesandbox/sdk";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;
const templateId = process.env.CODESANDBOX_TEMPLATE_ID;

export async function GET() {
    return Response.json(demos);
}

export async function POST(request: NextRequest) {
    const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
    const body = await request.json();
    const userId = body.user_id;
    const filePath = body.file_path;
    const files = body.files as { [fileName: string]: any };
    const sandboxList = await sdk.sandbox.list();
    let sandboxId = sandboxList.sandboxes.find(sandbox => sandbox.title === userId)?.id;
    if (sandboxId == null) {
        const sandbox = await sdk.sandbox.create({
            title: userId,
            template: templateId,
        });
        sandboxId = sandbox.id;
    }
    const sandbox = await sdk.sandbox.open(sandboxId);
    await Promise.all(Object.entries(files).map(([fileName, code]) => sandbox.fs.writeFile(fileName, code)));
    let envVars: { [key: string]: string } = {
        UNIFY_KEY: request.headers.get("apiKey") as string,
    };
    if (baseUrl.includes("staging")) {
        envVars = {
            ...envVars,
            UNIFY_BASE_URL: baseUrl
        };
    }

    // create command to run code
    const command = sandbox.shells.run(`python ${filePath}`, {
        env: envVars
    });

    try {
        // Create a promise that rejects after 40 seconds
        const timeout = new Promise((_, reject) => {
            setTimeout(() => {
                try {
                    command.kill();
                } catch (e) {
                    // Ignore errors when trying to kill a non-existent shell
                    console.log("Shell already terminated");
                }
                reject(new Error('Execution timed out'));
            }, 300000);
        });

        // Race between the command execution and timeout
        const res: any = await Promise.race([
            command.catch(error => {
                // If the shell doesn't exist, treat it as a successful completion
                if (error.message?.includes("Shell with id") && error.message?.includes("does not exist")) {
                    return { exitCode: 0, output: "Command completed successfully" };
                }
                throw error;
            }),
            timeout
        ]);

        // If the command failed, return an error
        if (res.exitCode !== 0)
            return Response.json({ detail: "Failed to run code", output: res.output }, { status: 500 });

        // If the command succeeded, return the output
        return Response.json(res);
    } catch (error: any) {
        // If the command timed out, return a timeout error
        if (error.message === "Execution timed out")
            return Response.json({ detail: "Code execution timed out" }, { status: 408 });

        // If the command failed, return an error
        return Response.json({ detail: "Failed to run code" }, { status: 500 });
    }
}
