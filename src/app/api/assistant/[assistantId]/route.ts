import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function DELETE(
    request: NextRequest,
    { params }: { params: { assistantId: string } }
) {
    return await fetch(
        `${baseUrl}/assistant/${params.assistantId}`, 
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
    { params }: { params: { assistantId: string } }
) {
    return await fetch(
        `${baseUrl}/assistant/${params.assistantId}`, 
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
