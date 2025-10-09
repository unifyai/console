import { ResponseProps } from "@/types/common";
import { LogProps, LogsResponseProps } from "@/types/interfaces/logs";
import { Secret, SecretPayload } from "@/types/assistants/secret";

const PROJECT = "Assistants";
const CONTEXT_SUFFIX = "/Secrets";

const mapLogToSecret = (log: LogProps): Secret | null => {
    const { id, entries } = log;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId) || !entries || typeof entries.name !== 'string' || typeof entries.value !== 'string') {
        console.warn("Skipping log due to missing, invalid, or non-numeric ID in secret data:", log);
        return null;
    }
    return {
        log_id: numericId,
        name: entries.name,
        value: entries.value,
        description: typeof entries.description === 'string' ? entries.description : undefined,
    };
};

export const getSecrets = async (apiKey: string) => {
    return async (assistantContext: string): Promise<Secret[] | ResponseProps> => {
        "use server";
        try {
            const context = `${assistantContext}${CONTEXT_SUFFIX}`;
            const url = `${process.env.NEXTAUTH_URL}/api/logs?project=${PROJECT}&context=${context}`;
            
            const response = await fetch(url, { method: "GET", headers: { apiKey } });

            if (response.status === 404) return []; // No secrets found is not an error

            const data = await response.json();
            if (!response.ok) return { detail: data.detail || `Failed to get secrets: ${response.statusText}` };

            const logsResponse = data as LogsResponseProps;
            const secrets = (logsResponse.logs as LogProps[])
                .map(mapLogToSecret)
                .filter((secret): secret is Secret => secret !== null);
            
            return secrets;
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error getting secrets.";
            return { detail: message };
        }
    };
};

export const createSecret = async (apiKey: string) => {
    return async (assistantContext: string, payload: SecretPayload): Promise<ResponseProps> => {
        "use server";
        try {
            const context = `${assistantContext}${CONTEXT_SUFFIX}`;
            const body = { project: PROJECT, context, entries: [payload] };
            
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/logs`, {
                method: "POST",
                headers: { apiKey, "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const data = await response.json();
                return { detail: data.detail || `Failed to create secret: ${response.statusText}` };
            }

            return { info: "Secret created successfully." };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error creating secret.";
            return { detail: message };
        }
    };
};

export const deleteSecret = async (apiKey: string) => {
    return async (assistantContext: string, log_id: number): Promise<ResponseProps> => {
        "use server";
        try {
            const context = `${assistantContext}${CONTEXT_SUFFIX}`;
            const url = `${process.env.NEXTAUTH_URL}/api/logs`;
            const body = {
                project: PROJECT,
                context: context,
                ids_and_fields: [[log_id, null]]
            };

            const response = await fetch(url, { 
                method: "DELETE", 
                headers: { 
                    apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                return { info: "Secret deleted successfully." };
            }

            // Handle non-ok responses
            let detail = `Failed to delete secret: ${response.statusText}`;
            try {
                // Try to parse a JSON error body, but don't fail if it's empty
                const data = await response.json();
                detail = data.detail || detail;
            } catch (e) {
                // Ignore JSON parsing errors for empty bodies, use status text
            }
            return { detail };

        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error deleting secret.";
            return { detail: message };
        }
    };
};
