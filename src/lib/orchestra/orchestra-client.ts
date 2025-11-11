import axios from "axios";

const ADMIN_TIMEOUT_MS = Number(process.env.ORCHESTRA_ADMIN_CLIENT_TIMEOUT_MS ?? "10000");

export const OrchestraAdminClient = axios.create({
	baseURL: process.env.ORCHESTRA_URL + "/v0/admin",
	headers: {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${process.env.ORCHESTRA_ADMIN_KEY}`
	},
	// Prevent long hangs that block SSR; fail fast and allow graceful fallbacks
	timeout: Number.isFinite(ADMIN_TIMEOUT_MS) ? ADMIN_TIMEOUT_MS : 10000,
});

export async function getOrchestraUserClient(userAPIKey: string) {
    return axios.create({
        baseURL: process.env.ORCHESTRA_URL + "/v0",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userAPIKey}`
            }
        });
}