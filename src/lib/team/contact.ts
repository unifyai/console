import { ResponseProps } from "@/types/common";

export const createAssistantEmail = async (apiKey: string) => {
    return async (email: string): Promise<{ email: string; user?: any; } | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/email`, {
                method: "POST",
                headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ email: email })
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