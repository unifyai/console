import { NextRequest, NextResponse } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

// This route handles deleting a specific contact method from an assistant.
export async function DELETE(
    request: NextRequest,
    { params }: { params: { assistantId: string } }
) {
    const apiKey = request.headers.get("apiKey");
    if (!apiKey) {
        return NextResponse.json({ detail: "API key is missing" }, { status: 401 });
    }

    let requestBody;
    try {
        requestBody = await request.json();
    } catch (error) {
        return NextResponse.json({ detail: "Invalid JSON body for contact deletion" }, { status: 400 });
    }

    // Proxying to the backend. The backend endpoint is assumed to be DELETE /assistant/{id}/contact
    // This is a DELETE request with a body, which is supported by fetch and HTTP/1.1+.
    const orchestraResponse = await fetch(
        `${baseUrl}/assistant/${params.assistantId}/contact`,
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody)
        }
    );

    const responseData = await orchestraResponse.json().catch(() => ({ detail: "Invalid JSON response from backend" }));

    return NextResponse.json(responseData, { status: orchestraResponse.status });
}
