import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(
    request: NextRequest,
    { params }: { params: { projectName: string } }
) {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    
    // Check if this is a template operation
    const isExportTemplate = searchParams.has('export_template');
    const isImportTemplate = searchParams.has('import_template');
    
    let endpoint = "/project";
    let requestBody;
    
    if (isExportTemplate) {
        endpoint = "/project/export_template";
        requestBody = JSON.stringify(await request.json());
    } else if (isImportTemplate) {
        endpoint = "/project/import_template";
        requestBody = JSON.stringify(await request.json());
    } else {
        // Regular project creation - preserve original behavior
        requestBody = JSON.stringify({ name: params.projectName });
    }
    
    return await fetch(
        `${baseUrl}${endpoint}`, 
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "accept": "application/json",
                "Content-Type": "application/json",
            },
            body: requestBody
        },
    );
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { projectName: string } }
) {
    return await fetch(
        `${baseUrl}/project/${params.projectName}`, 
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
            },
        }
    );
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { projectName: string } }
) {
    return await fetch(
        `${baseUrl}/project/${params.projectName}`, 
        {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "accept": "application/json",
            },
            body: JSON.stringify(request.body)
        }
    );
}
