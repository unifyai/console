import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(
    request: NextRequest,
    { params }: { params: { projectName: string } }
) {
    return await fetch(
        `${baseUrl}/project/${params.projectName}/contexts`,
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "Content-Type": "application/json",
            }
        },
    );
}

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

export async function DELETE(
    request: NextRequest,
    { params }: { params: { projectName: string } }
) {
    return await fetch(
        `${baseUrl}/project/${params.projectName}/contexts`,
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "Content-Type": "application/json",
            }
        },
    );
}
