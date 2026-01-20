/**
 * Utility functions for formatting context names used in the Assistants logging project.
 *
 * Context paths follow the pattern: {UserContext}/{AssistantContext}/{Suffix}
 * e.g., "JohnDoe/AdaLovelace/Tasks"
 *
 * Names are formatted by capitalizing the first letter of each space-separated word
 * and lowercasing all other characters (including those after hyphens).
 * This matches the Python behavior in unity/session_details.py.
 */

/**
 * Formats a name for use in Assistants project context paths.
 *
 * Capitalizes the first letter of each space-separated word,
 * lowercases all other characters (including after hyphens).
 *
 * @example
 * formatContextName("Ji-Yeon Kim") → "Ji-yeonKim"
 * formatContextName("John Doe") → "JohnDoe"
 * formatContextName("Mary-Jane Watson") → "Mary-janeWatson"
 * formatContextName("JOHN DOE") → "JohnDoe"
 */
export function formatContextName(name: string): string {
  return name
    .split(' ')
    .filter(Boolean) // Handle multiple spaces
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Constructs an owner/user context from first and last name.
 *
 * @example
 * formatUserContext("Ji-Yeon", "Kim") → "Ji-yeonKim"
 * formatUserContext("John", "Doe") → "JohnDoe"
 */
export function formatUserContext(firstName: string, lastName: string): string {
  return formatContextName(`${firstName} ${lastName}`.trim());
}

/**
 * Constructs an assistant context from first name and surname.
 *
 * @example
 * formatAssistantContext("Ada", "Lovelace") → "AdaLovelace"
 * formatAssistantContext("Ji-Yeon", "Kim") → "Ji-yeonKim"
 */
export function formatAssistantContext(firstName: string, surname: string): string {
  return formatContextName(`${firstName} ${surname}`.trim());
}
