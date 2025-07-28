import { ResponseProps } from "@/types/common";
import { AvailablePhoneCountry, AvailableSocialPlatform } from "../../types/assistants/assistant";
import { getCountryFlag, getCountryName } from "../../utils/assistants/country-utils";

export const createAssistantEmail = async (apiKey: string) => {
    return async (local: string, first_name: string, last_name: string): Promise<{ email: string; user?: any; } | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/email`, {
                method: "POST",
                headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ local, first_name, last_name })
            });
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to create email: ${response.statusText}` };
            }
            if (data.email) {
                return data as { email: string; user?: any; };
            }
            return { detail: "Email creation succeeded but response format was unexpected." };
        } catch (error) {
            return { detail: error instanceof Error ? error.message : "Unknown error creating email." };
        }
    };
};

export const deleteAssistantEmail = async (apiKey: string) => {
    return async (primaryEmail: string): Promise<ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/email`, {
                method: "DELETE",
                headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ primaryEmail })
            });
            if (response.status === 204) {
                return { info: `Email ${primaryEmail} deleted successfully.` };
            }
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to delete email: ${response.statusText}` };
            }
            return { info: data.info || data.message || `Email ${primaryEmail} deleted successfully.` };
        } catch (error) {
            return { detail: error instanceof Error ? error.message : "Unknown error deleting email." };
        }
    };
};

export const createAssistantPhoneNumber = async (apiKey: string) => {
    return async (): Promise<{ phoneNumber: string } | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/phone`, {
                method: "POST",
                headers: { apiKey: apiKey, "Content-Type": "application/json" }
            });
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to create phone number: ${response.statusText}` };
            }
            if (data.phoneNumber) {
                return data as { phoneNumber: string };
            }
            return { detail: "Phone number creation succeeded but response format was unexpected." };
        } catch (error) {
            return { detail: error instanceof Error ? error.message : "Unknown error creating phone number." };
        }
    };
};

export const deleteAssistantPhoneNumber = async (apiKey: string) => {
    return async (phoneNumber: string): Promise<ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/phone`, {
                method: "DELETE",
                headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ phoneNumber })
            });
            if (response.status === 204) {
                return { info: `Phone number ${phoneNumber} deleted successfully.` };
            }
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to delete phone number: ${response.statusText}` };
            }
            return { info: data.info || data.message || `Phone number ${phoneNumber} deleted successfully.` };
        } catch (error) {
            return { detail: error instanceof Error ? error.message : "Unknown error deleting phone number." };
        }
    };
};

export const listAllAssistantEmails = async (apiKey: string) => {
    return async (): Promise<string[] | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/email`, {
                method: "GET",
                headers: { apiKey: apiKey }
            });
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to list all assistant emails: ${response.statusText}` };
            }
            // The /api/contact/email GET proxy should return { emails: string[] }
            if (data.emails && Array.isArray(data.emails)) {
                return data.emails as string[];
            }
            return { detail: "Listing all assistant emails succeeded but response format was unexpected." };
        } catch (error) {
            return { detail: error instanceof Error ? error.message : "Unknown error listing all assistant emails." };
        }
    };
};

export const createAssistantWhatsApp = async (apiKey: string) => {
    return async (phone_number: string, first_name: string, last_name: string): Promise<{ sid: string } | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/whatsapp`, {
                method: "POST",
                headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ phone_number, first_name, last_name })
            });
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to create WhatsApp sender: ${response.statusText}` };
            }
            if (data.sid) {
                return data as { sid: string };
            }
            return { detail: "WhatsApp sender creation succeeded but SID was not returned." };
        } catch (error) {
            return { detail: error instanceof Error ? error.message : "Unknown error creating WhatsApp sender." };
        }
    };
};

export const deleteAssistantWhatsApp = async (apiKey: string) => {
    return async (sid: string): Promise<ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/whatsapp`, {
                method: "DELETE",
                headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ sid })
            });
            if (response.status === 204) {
                return { info: `WhatsApp sender ${sid} deleted successfully.` };
            }
            const data = await response.json().catch(() => null); // Catch if body is empty but still OK
            if (!response.ok) {
                return { detail: data?.detail || `Failed to delete WhatsApp sender: ${response.statusText}` };
            }
            return { info: data?.info || data?.message || `WhatsApp sender ${sid} deleted successfully.` };
        } catch (error) {
            return { detail: error instanceof Error ? error.message : "Unknown error deleting WhatsApp sender." };
        }
    };
};

export const listAvailablePhoneCountries = async (apiKey: string) => {
    return async (): Promise<AvailablePhoneCountry[]> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/phone/available-countries`, {
                method: "GET",
                headers: { apiKey: apiKey }
            });
            if (!response.ok) {
                console.error("Failed to fetch available countries, status:", response.status);
                throw new Error('Failed to fetch available countries');
            }
            const data = await response.json();

            if (Array.isArray(data?.countries)) {
                return data.countries;
            } else {
                console.warn("Unexpected response format for countries:", data);
                const usName = getCountryName("US") || "United States";
                const usFlag = getCountryFlag("US");
                return [{ code: "US", name: usName, flag: usFlag }];
            }

        } catch (error) {
            console.error("Error fetching available countries:", error);
            // Fallback to US only in case of error
            const usName = getCountryName("US") || "United States";
            const usFlag = getCountryFlag("US");
            return [{ code: "US", name: usName, flag: usFlag }];
        }
    };
};

export const listAvailableSocialPlatforms = async (apiKey: string) => {
    return async (): Promise<AvailableSocialPlatform[] | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/social/available-platforms`, {
                method: "GET",
                headers: { apiKey: apiKey }
            });
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to list available social platforms: ${response.statusText}` };
            }
            if (data.platforms && Array.isArray(data.platforms)) {
                return data.platforms as AvailableSocialPlatform[];
            }
            return { detail: "Listing social platforms succeeded but response format was unexpected." };
        } catch (error) {
            return { detail: error instanceof Error ? error.message : "Unknown error listing social platforms." };
        }
    };
};

export const verifySocialAccount = async (apiKey: string) => {
    return async (platform: string, account_identifier: string): Promise<{ verification_code: string; sent_at: string; } | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/social/verify`, {
                method: "POST",
                headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ platform, account_identifier })
            });
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to send verification for ${platform}: ${response.statusText}` };
            }
            if (data.verification_code && data.sent_at) {
                return data as { verification_code: string; sent_at: string; };
            }
            return { detail: "Verification succeeded but response format was unexpected." };
        } catch (error) {
            return { detail: error instanceof Error ? error.message : "Unknown error during verification." };
        }
    };
};