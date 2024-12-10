import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(
    request: NextRequest,
    { params }: { params: { projectName: string } }
) {
    return await fetch(
        `${baseUrl}/project`, 
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "accept": "application/json",
            },
            body: JSON.stringify({ name: params.projectName })
        },
    );
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { projectName: string } }
) {
    return await fetch(
        `${baseUrl}/project/${params.projectName}`, 
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
            },
        }
    );
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { projectName: string } }
) {
    return await fetch(
        `${baseUrl}/project/${params.projectName}`, 
        {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "accept": "application/json",
            },
            body: JSON.stringify(request.body)
        }
    );
}
