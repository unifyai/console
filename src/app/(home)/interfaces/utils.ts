/*
 Utility function to sanitize keys.
 Removes "Parameters/" or "Entries/" from the beginning of the string if they exist.
 */
export function sanitizeKey(key: string): string {
    if (key.startsWith("Parameters/")) {
        return key.slice("Parameters/".length);
    }
    if (key.startsWith("Entries/")) {
        return key.slice("Entries/".length);
    }
    return key;
}
