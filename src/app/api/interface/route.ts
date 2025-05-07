import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    
    // Check if we're getting interface by ID, by path components, or listing interfaces
    const hasId = searchParams.has('id');
    const hasProjectId = searchParams.has('project_id');
    const hasName = searchParams.has('name');
    
    // Determine endpoint based on parameters
    let endpoint = "/interfaces";
    
    // If project_id is present but no name or id, we're listing
    if (hasProjectId && !hasName && !hasId) {
        endpoint = "/interfaces/list";
    }
    
    // Let the backend handle the routing based on the query parameters
    return await fetch(
        `${baseUrl}${endpoint}${url.search}`,
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "accept": "application/json",
            },
            cache: "no-store"
        },
    );
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    const url = new URL(request.url);
    
    // Pass all query parameters to allow both ID and path-based updates
    return await fetch(
        `${baseUrl}/interfaces${url.search}`,
        {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body)
        },
    );
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    // For POST, we always create a new resource, so the endpoint is fixed
    return await fetch(
        `${baseUrl}/interfaces/`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body)
        },
    );
}

export async function DELETE(request: NextRequest) {
    const url = new URL(request.url);
    
    // Pass all query parameters to allow both ID and path-based deletion
    return await fetch(
        `${baseUrl}/interfaces${url.search}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "accept": "application/json",
            }
        },
    );
}
