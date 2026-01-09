import { NextRequest } from "next/server";
import { CodeSandbox } from "@codesandbox/sdk";

const templateId = process.env.CODESANDBOX_TEMPLATE_ID;

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") as string;
    const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
    const sandboxes = await sdk.sandbox.list();
    const sandbox = sandboxes.sandboxes.find(
        sandbox => sandbox.title === userId
    );
    return Response.json(sandbox || null);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const userId = body.userId as string;
    const sdk = new CodeSandbox(process.env.CODESANDBOX_API_TOKEN);
    const sandbox = await sdk.sandbox.create({
        title: userId,
        template: templateId,
        hibernationTimeoutSeconds: 300,
    });
    return Response.json(sandbox);
}
