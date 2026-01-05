import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function DELETE(
    request: NextRequest,
    { params }: { params: { voiceId: string } }
) {
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.api_key || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }
    
    const provider = request.nextUrl.searchParams.get("provider");
    if (!provider) {
        return NextResponse.json({ detail: "Missing 'provider' query parameter." }, { status: 400 });
    }

    return await fetch(
        `${baseUrl}/assistant/voice/${params.voiceId}?provider=${provider}`, 
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
            },
        }
    );
}