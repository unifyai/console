import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
	const url = new URL(request.url);
	return await fetch(
		`${baseUrl}/interfaces/checkpoint${url.search}`,
		{
			method: "GET",
			headers: {
				"Authorization": `Bearer ${request.headers.get("apiKey")}`,
				"accept": "application/json",
			},
			cache: "no-store",
		},
	);
}

export async function POST(request: NextRequest) {
	const url = new URL(request.url);
	const body = await request.json();
	return await fetch(
		`${baseUrl}/interfaces/checkpoint${url.search}`,
		{
			method: "POST",
			headers: {
				"Authorization": `Bearer ${request.headers.get("apiKey")}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		},
	);
} 