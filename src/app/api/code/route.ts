import { NextRequest } from "next/server";
import { demos } from "@/constants/logs";
import { CodeSandbox } from "@codesandbox/sdk";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;
const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
const templateId = process.env.CODESANDBOX_TEMPLATE_ID;
console.log(process.env.CODESANDBOX_API_TOKEN, templateId);

export async function GET() {
    return Response.json(demos);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const userId = body.user_id;
    const code = body.code;
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
    await sandbox.fs.writeFile("main.py", code);
    let envVars: { [key: string]: string } = {
        UNIFY_KEY: request.headers.get("apiKey") as string,
    };
    if (baseUrl.includes("staging")) {
        envVars = {
            ...envVars,
            UNIFY_BASE_URL: baseUrl
        };
    }
    const res = await sandbox.shells.run("python main.py", {
        env: envVars
    });
    if (res.exitCode !== 0)
        return Response.json({ detail: "Failed to run code" }, { status: 500 });
    return Response.json(res);
}
