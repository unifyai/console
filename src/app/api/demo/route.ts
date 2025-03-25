import { NextRequest } from "next/server";
import { demos } from "@/constants/logs";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET() {
    return Response.json(demos);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    return await fetch(
        `${baseUrl}/admin/run_demo`, 
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...body, staging: baseUrl.includes("staging") })
        },
    );
}
