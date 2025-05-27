import { NextRequest, NextResponse } from "next/server";

const ORCHESTRA_BASE_URL = process.env.ORCHESTRA_URL;
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

export async function PUT(
    request: NextRequest,
    { params }: { params: { userId: string; status: string } }
) {
    if (!ORCHESTRA_ADMIN_KEY) {
        return NextResponse.json({ detail: "Admin key not configured" }, { status: 500 });
    }

    const { userId, status } = params;
    if (!userId || !status) {
        return NextResponse.json({ detail: "User ID and status are required" }, { status: 400 });
    }
    
    const backendUrl = `${ORCHESTRA_BASE_URL}/v0/admin/auth-user/${userId}/assistant-hiring-approval/${status}`;

    try {
        const response = await fetch(backendUrl, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${ORCHESTRA_ADMIN_KEY}`,
                "Accept": "application/json",
            },
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });

    } catch (error) {
        console.error(`[API Admin User Approvals PUT ${userId}/${status}] Error proxying to Orchestra:`, error);
        return NextResponse.json({ detail: "Failed to connect to backend service" }, { status: 503 });
    }
}