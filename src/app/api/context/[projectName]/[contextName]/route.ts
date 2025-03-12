import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function DELETE(
    request: NextRequest,
    { params }: { params: { projectName: string, contextName: string } }
) {
    return await fetch(
        `${baseUrl}/project/${params.projectName}/contexts/${params.contextName}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "Content-Type": "application/json",
            }
        },
    );
}