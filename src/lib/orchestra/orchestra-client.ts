import axios, { AxiosInstance } from "axios";
import { snakeToCamelObject, camelToSnakeObject } from "@/utils/casing";

// Admin client timeout in milliseconds.
// Using a higher value here avoids spurious auth failures when Orchestra is slow.
const ADMIN_TIMEOUT_MS = 60_000;

/**
 * Add interceptors to transform request/response casing.
 * - Requests: camelCase → snake_case (for Orchestra API)
 * - Responses: snake_case → camelCase (for frontend)
 */
function addCasingInterceptors(client: AxiosInstance): AxiosInstance {
	// Transform request data from camelCase to snake_case
	client.interceptors.request.use((config) => {
		if (config.data && typeof config.data === 'object') {
			config.data = camelToSnakeObject(config.data);
		}
		return config;
	});

	// Transform response data from snake_case to camelCase
	client.interceptors.response.use((response) => {
		if (response.data && typeof response.data === 'object') {
			response.data = snakeToCamelObject(response.data);
		}
		return response;
	});

	return client;
}

export const OrchestraAdminClient = addCasingInterceptors(axios.create({
	baseURL: process.env.ORCHESTRA_URL + "/v0/admin",
	headers: {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${process.env.ORCHESTRA_ADMIN_KEY}`
	},
	// Prevent long hangs that block SSR; fail fast and allow graceful fallbacks
	timeout: ADMIN_TIMEOUT_MS,
}));

export async function getOrchestraUserClient(userAPIKey: string) {
    return addCasingInterceptors(axios.create({
        baseURL: process.env.ORCHESTRA_URL + "/v0",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userAPIKey}`
            }
        }));
}