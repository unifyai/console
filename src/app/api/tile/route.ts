import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    
    // Check if we're getting a tile by ID, by parent+name, or listing tiles
    const hasId = searchParams.has('tile_id');
    const hasTabId = searchParams.has('tab_id');
    const hasName = searchParams.has('name');
    
    // Determine endpoint based on parameters
    let endpoint = "/tile/";
    
    // If we have a tab_id but no id or name, we're listing tiles
    if (hasTabId && !hasId && !hasName) {
        endpoint = "/tile/list";
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

export async function POST(request: NextRequest) {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    
    // Check if this is a template operation
    const isExportTemplate = searchParams.has('export_template');
    const isImportTemplate = searchParams.has('import_template');
    
    let endpoint = "/tile/";
    
    if (isExportTemplate) {
        endpoint = "/tile/export_template";
    } else if (isImportTemplate) {
        endpoint = "/tile/import_template";
    }
    
    const body = await request.json();
    // For POST, we always create a new resource, so the endpoint is fixed
    return await fetch(
        `${baseUrl}${endpoint}`,
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

export async function PUT(request: NextRequest) {
    const body = await request.json();
    const url = new URL(request.url);
    
    // Pass all query parameters to allow both ID and parent+name updates
    return await fetch(
        `${baseUrl}/tile/${url.search}`,
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

export async function DELETE(request: NextRequest) {
    const url = new URL(request.url);
    
    // Pass all query parameters to allow both ID and parent+name deletion
    return await fetch(
        `${baseUrl}/tile/${url.search}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "accept": "application/json",
            }
        },
    );
}

export async function PATCH(request: NextRequest) {
    const body = await request.json();
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);

    // Check if this is a specialized patch
    const hasTileType = searchParams.has('tile_type');

    // Determine endpoint based on parameters
    let endpoint = "/tile/";
    
    // If we have a tileType, we're patching a specialized tile
    if (hasTileType) {
        endpoint = "/tile/specialized";
    }

    // Pass all query parameters to allow both ID and parent+name updates
    return await fetch(
        `${baseUrl}${endpoint}${url.search}`,
        {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body)
        },
    );
}
