import { QueryResult } from "@/types/usage";
import { formatDate } from "@/utils/formatDate";

/**
 * Given a list of query results, extract all unique conversation entries 
 * (i.e. user -> assistant message pairs) from the history. 
 * 
 * The function uses a simple heuristic to exclude duplicate entries 
 * from the result set, as the input data includes incremental chat history.
 * 
 * The heuristic is to use a combination of the model, provider, tags, prompt, 
 * and response as a unique key.
 * 
 * @param history - The list of query results
 * @returns A list of unique conversation entries
 */
export function ExtractUniqueConversationEntries(history: QueryResult[] | undefined) {
    const entries : {date: string, model: string, provider: string, tags: string | undefined, prompt: string, response: string}[] = [];
    const seen = new Set<string>();

    history?.forEach(item => {
        const messages = item.messages;
        for (let i = 0; i < messages.length; i += 2) {
            // Ensure there's a corresponding assistant message
            if (i + 1 < messages.length) {
                
                // User (Assistant) messages are even (odd) indexed
                const userMessage = messages[i];
                const assistantMessage = messages[i + 1]; 

                const entry = {
                    date: formatDate(new Date(item.at), "DD MMM YYYY, HH:mm:ss"),
                    model: item.endpoint.split("@").at(0) as string,
                    provider: item.endpoint.split("@").at(-1) as string,
                    tags: item.tags ? item.tags.join(", ") : "-",
                    prompt: userMessage.content,
                    response: assistantMessage.content
                };

                // Exclude duplicates with a heuristic because data includes incremental chat history
                const key = `${entry.model}|${entry.provider}|${entry.tags}|${entry.prompt}|${entry.response}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    entries.push(entry);
                }
            }
        }
    });

    return entries;
}