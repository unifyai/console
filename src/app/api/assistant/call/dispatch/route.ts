import { NextResponse, NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/user/user";

// This route dispatches an agent to join a LiveKit room for a voice call.
// It proxies to your backend/agents orchestrator.

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { assistantId, agentName, roomName } = body;

        if (!assistantId || !agentName || !roomName) {
            return NextResponse.json({ detail: "assistantId, agentName, and roomName are required" }, { status: 400 });
        }

        // Hardcode the base URL as requested
        const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;
        const baseDispatchUrl = "https://us-central1-gcp-project-runtime.cloudfunctions.net/unify-call-webhook";
        
        // Append '-staging' if in a staging/preview environment (using Vercel's env var as an example)
        const isStaging = baseUrl.includes("staging");
        const DISPATCH_URL = isStaging ? `${baseDispatchUrl}-staging` : baseDispatchUrl;
        
        const ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

        if (!ADMIN_KEY) {
            console.warn("[API /dispatch] Admin Key not configured. Simulating success for local development.");
            return NextResponse.json({ info: "Dispatch accepted (no backend configured)" }, { status: 202 });
        }
        
        // The request to the orchestrator needs to tell the assistant which room to join.
        const dispatchPayload = {
            assistant_id: assistantId,
            agent_name: agentName,
            room_name: roomName,
        };

        const resp = await fetch(DISPATCH_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ADMIN_KEY}`,
            },
            body: JSON.stringify(dispatchPayload),
        });

        if (!resp.ok) {
            const detail = await resp.text().catch(() => "Failed to dispatch agent");
            console.error(`[API /dispatch] Error dispatching agent to ${DISPATCH_URL}: ${detail}`);
            return NextResponse.json({ detail }, { status: 502 });
        }

        const data = await resp.json().catch(() => ({}));
        return NextResponse.json({ info: "Agent dispatched", data }, { status: 202 });
    } catch (error: any) {
        console.error(`[API /dispatch] Internal server error: ${error.message}`);
        return NextResponse.json({ detail: error?.message || "Unknown error" }, { status: 500 });
    }
}
