import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function DELETE(
    request: NextRequest,
    { params }: { params: { voiceId: string } }
) {
    const provider = request.nextUrl.searchParams.get("provider");
    if (!provider) {
        return new Response(JSON.stringify({ detail: "Missing 'provider' query parameter." }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return await fetch(
        `${baseUrl}/assistant/voice/${params.voiceId}?provider=${provider}`, 
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
            },
        }
    );
}