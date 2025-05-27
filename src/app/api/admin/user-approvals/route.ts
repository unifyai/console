import { NextRequest, NextResponse } from "next/server";

const ORCHESTRA_BASE_URL = process.env.ORCHESTRA_URL;
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

export async function GET(request: NextRequest) {
    if (!ORCHESTRA_ADMIN_KEY) {
        return NextResponse.json({ detail: "Admin key not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status_filter");

    let backendUrl = `${ORCHESTRA_BASE_URL}/v0/admin/auth-user/assistant-hiring-approval`;
    const backendParams = new URLSearchParams();

    if (statusFilter) {
        backendParams.append("status_filter", statusFilter);
    }
    
    const backendQueryString = backendParams.toString();
    if (backendQueryString) {
        backendUrl += `?${backendQueryString}`;
    }

    try {
        const response = await fetch(backendUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${ORCHESTRA_ADMIN_KEY}`,
                "Accept": "application/json",
            },
            cache: 'no-store', // Ensure fresh data
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });

    } catch (error) {
        console.error("[API Admin User Approvals GET] Error proxying to Orchestra:", error);
        return NextResponse.json({ detail: "Failed to connect to backend service" }, { status: 503 });
    }
}
