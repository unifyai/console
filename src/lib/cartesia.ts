import { CartesiaClient } from "@cartesia/cartesia-js";

const cartesiaApiKey = process.env.CARTESIA_API_KEY;

if (!cartesiaApiKey && process.env.NODE_ENV === "production") {
    console.error("FATAL: CARTESIA_API_KEY environment variable is not set in production.");
    throw new Error("Cartesia API Key is not configured for production environment.");
} else if (!cartesiaApiKey) {
    console.warn("WARN: CARTESIA_API_KEY environment variable is not set. Using a mock key for development/testing.");
}

export const cartesiaClient = new CartesiaClient({
    apiKey: cartesiaApiKey || "sk_mock_cartesia_api_key_for_development_only",
});