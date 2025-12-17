import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";
import { buildCacheControl } from "../../../_utils/cacheResponse";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  
  // Try to get API key from header; if not available fallback to user session
  let apiKey = request.headers.get("apiKey") || "";
  if (!apiKey) {
    const user = await getCurrentUser();
    apiKey = user?.apiKey ?? "";
  }
  
  try {
    const url = `${baseUrl}/organizations/${orgId}/teams`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        accept: "application/json",
      },
    });
    const body = await res.text();
    
    // Build response with caching headers
    const headers: HeadersInit = { 
      "Content-Type": "application/json",
    };
    
    // Only cache successful responses
    if (res.ok) {
      const cacheControl = buildCacheControl('SHORT');
      if (cacheControl) {
        headers["Cache-Control"] = cacheControl;
      }
    }
    
    return new NextResponse(body, { status: res.status, headers });
  } catch (e) {
    return NextResponse.json({ detail: "Failed to fetch teams" }, { status: 500 });
  }
}

