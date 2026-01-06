import { NextRequest, NextResponse } from "next/server";
import { withCacheHeaders } from "../../_utils/cacheResponse";
import { getCurrentUser } from "@/lib/user/user";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(
    request: NextRequest,
    { params }: { params: { projectName: string } }
) {
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.apiKey || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }
    
    const upstreamResponse = await fetch(
        `${baseUrl}/project/${params.projectName}/contexts`,
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            }
        },
    );
    
    // Cache contexts list for 5 minutes - rarely changes
    return withCacheHeaders(upstreamResponse, 'LONG');
}

export async function POST(
    request: NextRequest,
    { params }: { params: { projectName: string } }
) {
    const body = await request.json();
    
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.apiKey || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }
    
    return await fetch(
        `${baseUrl}/project/${params.projectName}/contexts`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
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
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.apiKey || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }
    
    return await fetch(
        `${baseUrl}/project/${params.projectName}/contexts`,
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            }
        },
    );
}
