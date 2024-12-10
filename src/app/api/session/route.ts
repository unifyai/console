import { getSession } from "@/lib/user/user";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const session = await getSession();
    const headers = {
        "Access-Control-Allow-Origin": "https://unify.ai",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Credentials": "true"
    };

    if (session) {
        // User is authenticated
        return NextResponse.json({ session }, { status: 200, headers: headers });
    } else {
        // User is not authenticated
        return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: headers });
    }
}
