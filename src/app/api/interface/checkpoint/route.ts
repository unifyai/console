import { NextRequest } from "next/server";
import { getApiKeyFromRequest } from "@/lib/auth/getApiKey";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
	const url = new URL(request.url);
	const apiKey = await getApiKeyFromRequest(request);
	const controller = new AbortController();
	const ttl = setTimeout(() => controller.abort(), 30000);
	const res = await fetch(
		`${baseUrl}/interfaces/checkpoint${url.search}`,
		{
			method: "GET",
			headers: {
				"Authorization": `Bearer ${apiKey}`,
				"accept": "application/json",
			},
			cache: "no-store",
			signal: controller.signal,
		},
	);
	clearTimeout(ttl);
	return res;
}

export async function POST(request: NextRequest) {
	const url = new URL(request.url);
	const body = await request.json();
	const apiKey = await getApiKeyFromRequest(request);
	const controller = new AbortController();
	const ttl = setTimeout(() => controller.abort(), 30000);
	const res = await fetch(
		`${baseUrl}/interfaces/checkpoint${url.search}`,
		{
			method: "POST",
			headers: {
				"Authorization": `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		},
	);
	clearTimeout(ttl);
	return res;
} 