/**
 * LLM-based Plot Configuration Inference
 *
 * Uses Orchestra's chat completions endpoint to infer plot configurations
 * from natural language descriptions. Leverages existing infrastructure
 * and billing through the user's API key.
 */

import { validateLLMResponse } from "./validation";

const ORCHESTRA_URL = process.env.ORCHESTRA_URL;

/**
 * Request structure for plot inference
 */
export interface PlotDescriptionRequest {
  description: string;
  available_fields: string[];
  field_types: Record<string, string>;
  apiKey: string; // User's API key for billing through Orchestra
}

/**
 * Structure of the inferred plot configuration
 */
export interface InferredPlotConfig {
  type: string;
  x_axis: string;
  y_axis?: string | null;
  group_by?: string | null;
  aggregate?: string | null;
  scale_x?: string;
  scale_y?: string;
  metric?: string | null;
  bin_count?: number | null;
  show_regression?: boolean;
  confidence: number; // 0-1 confidence score
  reasoning?: string; // Optional explanation
}

/**
 * System prompt for the LLM to understand its role
 */
const SYSTEM_PROMPT = `You are a data visualization expert. Given a user's description and available data fields, determine the best plot configuration.

Available plot types:
- scatter: Requires x_axis (numeric) and y_axis (numeric). Good for correlations, relationships between two variables.
- bar: Requires x_axis (categorical/string) and y_axis (numeric). Good for comparisons across categories.
- histogram: Requires x_axis (numeric) only. Good for showing distributions of a single variable.
- line: Requires x_axis (numeric/datetime) and y_axis (numeric). Good for trends over time or ordered data.

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "type": "scatter|bar|histogram|line",
  "x_axis": "field_name",
  "y_axis": "field_name or null if histogram",
  "group_by": "field_name or null",
  "aggregate": "sum|mean|count|min|max or null",
  "scale_x": "linear|log",
  "scale_y": "linear|log",
  "metric": "mean|sum|count|min|max or null",
  "show_regression": true/false,
  "bin_count": number or null,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this configuration was chosen"
}`;

/**
 * Build the user prompt with field information
 */
function buildUserPrompt(
  description: string,
  availableFields: string[],
  fieldTypes: Record<string, string>
): string {
  const fieldList = availableFields
    .map((f) => `- ${f}: ${fieldTypes[f] || "unknown"}`)
    .join("\n");

  return `Available fields with types:
${fieldList}

User description: "${description}"`;
}

/**
 * Parse LLM response content, handling potential markdown code blocks
 */
function parseLLMResponse(content: string): InferredPlotConfig {
  let jsonContent = content.trim();

  // Remove markdown code block if present
  if (jsonContent.startsWith("```")) {
    jsonContent = jsonContent
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "");
  }

  try {
    return JSON.parse(jsonContent) as InferredPlotConfig;
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${content}`);
  }
}

/**
 * Infer plot configuration from a natural language description.
 * Uses Orchestra chat completions endpoint for LLM inference.
 *
 * @param request - The inference request with description and field info
 * @returns The inferred and validated plot configuration
 * @throws Error if inference fails or response is invalid
 */
export async function inferPlotConfigFromDescription(
  request: PlotDescriptionRequest
): Promise<InferredPlotConfig> {
  if (!ORCHESTRA_URL) {
    throw new Error("ORCHESTRA_URL not configured");
  }

  const userPrompt = buildUserPrompt(
    request.description,
    request.available_fields,
    request.field_types
  );

  const payload = {
    model: "gpt-4o-mini@openai",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    stream: false,
    temperature: 0.2, // Low temperature for consistent results
    max_tokens: 500,
  };

  const response = await fetch(`${ORCHESTRA_URL}/v0/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${request.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { detail?: string }).detail ||
        `LLM request failed with status ${response.status}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response content from LLM");
  }

  // Parse the JSON response
  const parsed = parseLLMResponse(content);

  // Validate and apply fallbacks
  const validated = validateLLMResponse(
    parsed,
    request.available_fields,
    request.field_types
  );

  return validated;
}

/**
 * Check if inference is available (ORCHESTRA_URL configured)
 */
export function isInferenceAvailable(): boolean {
  return !!ORCHESTRA_URL;
}


