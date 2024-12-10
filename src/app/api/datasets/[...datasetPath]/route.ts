import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(
    request: NextRequest,
    { params }: { params: { datasetPath: string[] } }
) {
    const datasetName = params.datasetPath.join("/");
    console.log(`dataset name ${datasetName}`);
    const response = await fetch(
        `${baseUrl}/dataset/${datasetName}`, 
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
            },
        }
    );
    if (!response.ok) {
       throw new Error("Network error");
    }
    return response;
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { datasetName: string } }
) {
    const response = await fetch(
        `${baseUrl}/dataset/${params.datasetName}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
            },
        }
    );
    if (!response.ok) {
       throw new Error("Network error");
    }
    return response;
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { datasetName: string } }
) {
    const response = await fetch(
        `${baseUrl}/dataset/${params.datasetName}`, 
        {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(request.body)
        }
    );
    if (!response.ok) {
       throw new Error("Network error");
    }
    return response;
}
