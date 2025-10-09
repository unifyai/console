import { NextRequest, NextResponse } from "next/server";

const ORCHESTRA_BASE_URL = process.env.ORCHESTRA_URL;

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("apiKey");
  if (!apiKey) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  if (!ORCHESTRA_BASE_URL) {
    return NextResponse.json({ detail: "Backend URL not configured" }, { status: 500 });
  }

  try {
    const response = await fetch(
      `${ORCHESTRA_BASE_URL}/v0/assistant`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          accept: "application/json",
        },
        cache: 'no-store',
      }
    );

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = data?.detail || "Failed to fetch assistants";
      return NextResponse.json({ detail }, { status: response.status });
    }

    const assistants = Array.isArray(data)
      ? data
      : Array.isArray((data as any)?.info)
      ? (data as any).info
      : Array.isArray((data as any)?.results)
      ? (data as any).results
      : [];
    const emailsSet = new Set<string>();
    const emails: string[] = [];
    for (const a of assistants) {
      const email = a?.email;
      if (typeof email === "string" && email.trim().length > 0 && !emailsSet.has(email)) {
        emailsSet.add(email);
        emails.push(email);
      }
    }
    return NextResponse.json({ emails });
  } catch (err) {
    console.error("[/api/assistant/emails] GET error", err);
    return NextResponse.json({ detail: "Failed to list assistant emails" }, { status: 500 });
  }
}


