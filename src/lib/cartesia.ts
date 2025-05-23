import { CartesiaClient } from "@cartesia/cartesia-js";

const cartesiaApiKey = process.env.CARTESIA_API_KEY;

if (!cartesiaApiKey) {
    console.warn("WARN: CARTESIA_API_KEY environment variable is not set.");
}

export const cartesiaClient = new CartesiaClient({
    apiKey: cartesiaApiKey || "sk_mock_cartesia_api_key_for_development_only",
});