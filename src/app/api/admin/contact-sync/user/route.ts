import { NextRequest, NextResponse } from "next/server";

const ORCHESTRA_BASE_URL = process.env.ORCHESTRA_URL;
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

/**
 * Sync user profile fields (timezone, bio) via assistant lookup.
 * 
 * POST /api/admin/contact-sync/user
 * Body: { assistant_id: number, target_user_email: string, timezone?: string, bio?: string }
 * 
 * Proxies to: POST /v0/admin/assistant/update-user
 */
export async function POST(request: NextRequest) {
    if (!ORCHESTRA_ADMIN_KEY) {
        console.error("[API contact-sync/user] ORCHESTRA_ADMIN_KEY not configured");
        return NextResponse.json({ detail: "Admin key not configured" }, { status: 500 });
    }

    if (!ORCHESTRA_BASE_URL) {
        console.error("[API contact-sync/user] ORCHESTRA_URL not configured");
        return NextResponse.json({ detail: "Backend URL not configured" }, { status: 500 });
    }

    let body: {
        assistant_id?: number;
        target_user_email?: string;
        timezone?: string;
        bio?: string;
    };

    try {
        body = await request.json();
    } catch (error) {
        return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
    }

    const { assistant_id, target_user_email, timezone, bio } = body;

    if (!assistant_id || typeof assistant_id !== "number") {
        return NextResponse.json({ detail: "assistant_id (number) is required" }, { status: 400 });
    }

    if (!target_user_email || typeof target_user_email !== "string") {
        return NextResponse.json({ detail: "target_user_email (string) is required" }, { status: 400 });
    }

    if (timezone === undefined && bio === undefined) {
        return NextResponse.json({ detail: "At least one of timezone or bio must be provided" }, { status: 400 });
    }

    const backendUrl = `${ORCHESTRA_BASE_URL}/v0/admin/assistant/update-user`;

    const payload: Record<string, any> = {
        assistant_id,
        target_user_email,
    };
    if (timezone !== undefined) payload.timezone = timezone;
    if (bio !== undefined) payload.bio = bio;

    try {
        const response = await fetch(backendUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${ORCHESTRA_ADMIN_KEY}`,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        let data;
        try {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                const text = await response.text();
                data = { detail: text || "Non-JSON response from backend" };
            }
        } catch (parseError) {
            data = { detail: "Failed to parse backend response" };
        }

        if (!response.ok) {
            console.warn(`[API contact-sync/user] Backend error ${response.status}:`, data);
        }

        return NextResponse.json(data, { status: response.status });

    } catch (error) {
        console.error("[API contact-sync/user] Error proxying to backend:", error);
        return NextResponse.json({ detail: "Failed to connect to backend service" }, { status: 503 });
    }
}

