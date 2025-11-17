import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
  // Try to get API key from header; if not available fallback to user session
  let apiKey = request.headers.get("apiKey") || "";
  if(!apiKey){
    const user = await getCurrentUser();
    apiKey = user?.apiKey ?? "";
  }
  try {
    const url = `${baseUrl}/projects/tree`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        accept: "application/json",
      },
      cache: "no-store",
    });
    const body = await res.text();
    return new NextResponse(body, { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return NextResponse.json({ detail: "Failed to fetch project tree" }, { status: 500 });
  }
} 