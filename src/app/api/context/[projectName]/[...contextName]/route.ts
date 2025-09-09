import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

// DELETE a single context (supports nested names)
export async function DELETE(
	request: NextRequest,
	{ params }: { params: { projectName: string, contextName: string[] } }
) {
	const contextPath = encodeURIComponent((params.contextName || []).join("/"));
	return await fetch(
		`${baseUrl}/project/${params.projectName}/contexts/${contextPath}`,
		{
			method: "DELETE",
			headers: {
				"Authorization": `Bearer ${request.headers.get("apiKey")}`,
				"Content-Type": "application/json",
			}
		},
	);
}

// PATCH rename a single context (supports nested names)
export async function PATCH(
	request: NextRequest,
	{ params }: { params: { projectName: string, contextName: string[] } }
) {
	const body = await request.json();
	const contextPath = encodeURIComponent((params.contextName || []).join("/"));
	return await fetch(
		`${baseUrl}/project/${params.projectName}/contexts/${contextPath}/rename`,
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