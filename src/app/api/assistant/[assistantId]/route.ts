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
    let requestBody;
    try {
        requestBody = await request.json();
    } catch (error) {
        console.error("Failed to parse JSON body in PATCH /api/assistant/[assistantId]:", error);
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    return await fetch(
        `${baseUrl}/assistant/${params.assistantId}/config`,
        {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody)
        }
    );
}
