import axios from "axios";

// Admin client timeout in milliseconds.
// Using a higher value here avoids spurious auth failures when Orchestra is slow.
const ADMIN_TIMEOUT_MS = 60_000;

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