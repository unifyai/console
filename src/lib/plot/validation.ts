/**
 * Validation utilities for Plot API
 *
 * Validates LLM-inferred plot configurations with intelligent fallbacks.
 * Pure functions that are easy to unit test.
 */

import type { InferredPlotConfig } from "./llm-config";

/**
 * Custom error class for plot config validation failures
 */
export class PlotConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = "PlotConfigValidationError";
  }
}

/**
 * Define required fields per plot type
 */
const PLOT_TYPE_REQUIREMENTS: Record<
  string,
  {
    required: string[];
    optional: string[];
    numericRequired?: string[]; // Fields that must reference numeric columns
  }
> = {
  scatter: {
    required: ["x_axis", "y_axis"],
    optional: ["group_by", "show_regression"],
    numericRequired: ["x_axis", "y_axis"],
  },
  bar: {
    required: ["x_axis", "y_axis"],
    optional: ["aggregate", "group_by", "metric"],
  },
  histogram: {
    required: ["x_axis"],
    optional: ["bin_count"],
    numericRequired: ["x_axis"],
  },
  line: {
    required: ["x_axis", "y_axis"],
    optional: ["group_by"],
    numericRequired: ["y_axis"], // x can be datetime
  },
};

const VALID_PLOT_TYPES = ["scatter", "bar", "histogram", "line"];
const VALID_SCALES = ["linear", "log"];
const VALID_AGGREGATES = ["sum", "mean", "count", "min", "max"];
const VALID_METRICS = ["mean", "sum", "count", "min", "max"];

/**
 * Find a suitable fallback field based on plot type and requirements.
 *
 * @param fieldRole - The role of the field (x_axis, y_axis, etc.)
 * @param plotType - The plot type
 * @param availableFields - List of available field names
 * @param fieldTypes - Map of field names to their types
 * @param mustBeNumeric - Whether the field must be numeric
 * @returns A suitable fallback field name, or null if none found
 */
function findFallbackField(
  fieldRole: string,
  plotType: string,
  availableFields: string[],
  fieldTypes?: Record<string, string>,
  mustBeNumeric: boolean = false
): string | null {
  // Filter to numeric fields if required
  let candidates = availableFields;

  if (mustBeNumeric && fieldTypes) {
    const numericTypes = [
      "int",
      "float",
      "number",
      "integer",
      "double",
      "decimal",
    ];
    candidates = availableFields.filter((f) => {
      const type = (fieldTypes[f] || "").toLowerCase();
      return numericTypes.some((t) => type.includes(t));
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  // Heuristics for common field names
  const preferredPatterns: Record<string, string[]> = {
    x_axis: ["time", "date", "timestamp", "created", "id", "index"],
    y_axis: [
      "value",
      "count",
      "total",
      "amount",
      "score",
      "latency",
      "duration",
    ],
  };

  const patterns = preferredPatterns[fieldRole] || [];

  // Try to find a field matching patterns
  for (const pattern of patterns) {
    const match = candidates.find((f) => f.toLowerCase().includes(pattern));
    if (match) {
      return match;
    }
  }

  // If no pattern match, return first candidate
  return candidates[0];
}

/**
 * Validate an LLM-inferred plot config with fallbacks where possible.
 * Throws PlotConfigValidationError for unrecoverable issues.
 *
 * @param config - The inferred plot configuration from LLM
 * @param availableFields - List of available field names in the data
 * @param fieldTypes - Optional map of field names to their types
 * @returns Validated and possibly corrected configuration
 */
export function validateLLMResponse(
  config: InferredPlotConfig,
  availableFields: string[],
  fieldTypes?: Record<string, string>
): InferredPlotConfig {
  const warnings: string[] = [];

  // Clone to avoid mutating input
  const validated: InferredPlotConfig = { ...config };

  // 1. Validate plot type
  if (!config.type || !VALID_PLOT_TYPES.includes(config.type)) {
    throw new PlotConfigValidationError(
      `Invalid or missing plot type: ${config.type}. Must be one of: ${VALID_PLOT_TYPES.join(", ")}`,
      "type",
      false
    );
  }

  // 2. Get requirements for this plot type
  const requirements = PLOT_TYPE_REQUIREMENTS[config.type];

  // 3. Check required fields exist
  for (const field of requirements.required) {
    const value = config[field as keyof InferredPlotConfig] as
      | string
      | null
      | undefined;

    if (!value) {
      // Try to find a suitable fallback
      const fallback = findFallbackField(
        field,
        config.type,
        availableFields,
        fieldTypes,
        requirements.numericRequired?.includes(field) ?? false
      );

      if (fallback) {
        (validated as unknown as Record<string, unknown>)[field] = fallback;
        warnings.push(`Missing ${field}, using fallback: ${fallback}`);
      } else {
        throw new PlotConfigValidationError(
          `Required field '${field}' is missing for ${config.type} plot and no suitable fallback found`,
          field,
          false
        );
      }
    } else if (!availableFields.includes(value)) {
      // Field specified but doesn't exist in data
      const fallback = findFallbackField(
        field,
        config.type,
        availableFields,
        fieldTypes,
        requirements.numericRequired?.includes(field) ?? false
      );

      if (fallback) {
        (validated as unknown as Record<string, unknown>)[field] = fallback;
        warnings.push(
          `Field '${value}' not found for ${field}, using fallback: ${fallback}`
        );
      } else {
        throw new PlotConfigValidationError(
          `Field '${value}' specified for ${field} does not exist in available fields`,
          field,
          false
        );
      }
    }
  }

  // 4. Validate optional fields if provided
  if (config.group_by && !availableFields.includes(config.group_by)) {
    validated.group_by = null;
    warnings.push(`group_by field '${config.group_by}' not found, ignoring`);
  }

  // 5. Validate/default scales
  if (config.scale_x && !VALID_SCALES.includes(config.scale_x)) {
    validated.scale_x = "linear";
    warnings.push(`Invalid scale_x '${config.scale_x}', defaulting to linear`);
  }
  if (config.scale_y && !VALID_SCALES.includes(config.scale_y)) {
    validated.scale_y = "linear";
    warnings.push(`Invalid scale_y '${config.scale_y}', defaulting to linear`);
  }

  // 6. Validate aggregate
  if (config.aggregate && !VALID_AGGREGATES.includes(config.aggregate)) {
    validated.aggregate = "mean";
    warnings.push(
      `Invalid aggregate '${config.aggregate}', defaulting to mean`
    );
  }

  // 7. Validate metric
  if (config.metric && !VALID_METRICS.includes(config.metric)) {
    validated.metric = "mean";
    warnings.push(`Invalid metric '${config.metric}', defaulting to mean`);
  }

  // 8. Validate bin_count
  if (config.type === "histogram") {
    if (config.bin_count === undefined || config.bin_count === null) {
      validated.bin_count = 10;
    } else if (config.bin_count < 1 || config.bin_count > 100) {
      validated.bin_count = Math.max(1, Math.min(100, config.bin_count));
      warnings.push(`bin_count clamped to valid range: ${validated.bin_count}`);
    }
  }

  // 9. Ensure confidence is valid
  if (
    config.confidence === undefined ||
    config.confidence < 0 ||
    config.confidence > 1
  ) {
    validated.confidence = 0.5; // Default to medium confidence
  }

  // Add warnings to reasoning if any
  if (warnings.length > 0) {
    validated.reasoning = [
      validated.reasoning || "",
      `Validation notes: ${warnings.join("; ")}`,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  return validated;
}

/**
 * Quick check if a config is minimally valid (for pre-flight checks).
 *
 * @param config - Partial plot configuration to check
 * @returns true if the config has minimum required fields for its type
 */
export function isConfigMinimallyValid(
  config: Partial<InferredPlotConfig>
): boolean {
  if (!config.type || !VALID_PLOT_TYPES.includes(config.type)) {
    return false;
  }

  const requirements = PLOT_TYPE_REQUIREMENTS[config.type];
  for (const field of requirements.required) {
    if (!config[field as keyof InferredPlotConfig]) {
      return false;
    }
  }

  return true;
}

/**
 * Get the list of valid plot types
 */
export function getValidPlotTypes(): string[] {
  return [...VALID_PLOT_TYPES];
}

/**
 * Get requirements for a specific plot type
 */
export function getPlotTypeRequirements(plotType: string): {
  required: string[];
  optional: string[];
  numericRequired?: string[];
} | null {
  return PLOT_TYPE_REQUIREMENTS[plotType] || null;
}


