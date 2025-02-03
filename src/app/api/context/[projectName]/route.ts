import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(
    request: NextRequest,
    { params }: { params: { projectName: string } }
) {
    const body = await request.json();
    return await fetch(
        `${baseUrl}/project/${params.projectName}/contexts`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body)
        },
    );
}
