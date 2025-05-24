import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function DELETE(
    request: NextRequest,
    { params }: { params: { voiceId: string } }
) {
    return await fetch(
        `${baseUrl}/assistant/voice/${params.voiceId}`, 
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
            },
        }
    );
}