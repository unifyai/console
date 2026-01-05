import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

// Transfer project to organization
export async function POST(
    request: NextRequest,
    { params }: { params: { projectName: string } }
) {
    const user = await getCurrentUser();
    const apiKey = user?.api_key || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    const transferType = searchParams.get('type');
    
    // The projectName here is actually the project ID for transfer operations
    const projectId = params.projectName;
    
    try {
        if (transferType === 'organization') {
            const body = await request.json();
            const organizationId = body.organization_id;
            
            if (!organizationId) {
                return NextResponse.json({ detail: "organization_id is required" }, { status: 400 });
            }
            
            const response = await fetch(
                `${baseUrl}/project/${projectId}/transfer-to-organization`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        "accept": "application/json",
                    },
                    body: JSON.stringify({ organization_id: organizationId })
                }
            );
            
            const text = await response.text();
            return new NextResponse(text, { 
                status: response.status, 
                headers: { 'Content-Type': 'application/json' } 
            });
        } else if (transferType === 'personal') {
            const response = await fetch(
                `${baseUrl}/project/${projectId}/transfer-to-personal`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        "accept": "application/json",
                    }
                }
            );
            
            const text = await response.text();
            return new NextResponse(text, { 
                status: response.status, 
                headers: { 'Content-Type': 'application/json' } 
            });
        } else {
            return NextResponse.json({ detail: "Invalid transfer type. Use 'organization' or 'personal'" }, { status: 400 });
        }
    } catch (e: any) {
        console.error("Transfer error:", e);
        return NextResponse.json({ detail: e.message || "Failed to transfer project" }, { status: 500 });
    }
}

