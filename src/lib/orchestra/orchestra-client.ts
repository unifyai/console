import axios from "axios";

// Fixed timeout to prevent long hangs that block SSR.
// Keep this conservative; adjust in code if needed rather than via env.
const ADMIN_TIMEOUT_MS = 10_000;

export const OrchestraAdminClient = axios.create({
	baseURL: process.env.ORCHESTRA_URL + "/v0/admin",
	headers: {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${process.env.ORCHESTRA_ADMIN_KEY}`
	},
	// Prevent long hangs that block SSR; fail fast and allow graceful fallbacks
	timeout: ADMIN_TIMEOUT_MS,
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