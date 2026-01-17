'use client';

import { LogProps, LogItemProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { timeValueToTime, timeDeltaValueToDuration } from '../format';

/**
 * Checks if a specific property exists within a log object, considering its potential location
 * (derived_entry or entry) based on the field metadata.
 *
 * @param {LogFieldsResponseProps} fields - Metadata describing the fields, including their type ('derived_entry', 'entry').
 * @param {string} axisProperty - The name of the property (field) to check for.
 * @param {LogProps} log - The log object potentially containing the property.
 * @param {string} table - The name of the table associated with the log, used to access nested properties like `${table}.entries`.
 * @returns {boolean} True if the property exists in the expected location within the log object, false otherwise.
 */
export const hasProperty = (
  fields: LogFieldsResponseProps,
  axisProperty: string,
  log: LogProps,
  table: string
) => {
  const fieldType = fields[axisProperty] ? fields[axisProperty].fieldType : 'entry';
  // Params support removed - only check derived_entry or entry
  const hasValues =
    fieldType === 'derived_entry'
      ? log[`${table}.derivedEntries`] &&
        (log[`${table}.derivedEntries`] as LogItemProps)[axisProperty] !== undefined
      : log[`${table}.entries`] &&
        (log[`${table}.entries`] as LogItemProps)[axisProperty] !== undefined;
  return hasValues;
};

/**
 * Retrieves the value of a specific property from a log object.
 * It determines the correct location (derived_entry, param, entry) based on field metadata
 * and converts certain data types (timestamp, date, timedelta, time, bool) to a numerical representation.
 * Returns undefined if the property does not exist in the log.
 *
 * @param {LogFieldsResponseProps} fields - Metadata describing the fields, including type and dataType.
 * @param {string} axisProperty - The name of the property (field) whose value is to be retrieved.
 * @param {LogProps} log - The log object containing the data.
 * @param {string} table - The name of the table associated with the log.
 * @returns {number | undefined} The numerical value of the property after potential type conversion,
 * or undefined if the property is not found.
 */
export const getValue = (
  fields: LogFieldsResponseProps,
  axisProperty: string,
  log: LogProps,
  table: string
) => {
  if (!hasProperty(fields, axisProperty, log, table)) return undefined;
  const fieldType = fields[axisProperty] ? fields[axisProperty].fieldType : 'entry';
  // Params support removed - only get from derived_entry or entry
  let value =
    fieldType === 'derived_entry'
      ? (log[`${table}.derivedEntries`] as LogItemProps)[axisProperty]
      : (log[`${table}.entries`] as LogItemProps)[axisProperty];
  const dataType = fields[axisProperty] ? fields[axisProperty].dataType : 'float';
  if (dataType === 'timestamp' || dataType === 'date') value = new Date(value).getTime();
  if (dataType === 'timedelta') value = timeDeltaValueToDuration(value);
  if (dataType === 'time') value = timeValueToTime(value).getTime();
  if (dataType === 'bool') value = Number(typeof value === 'string' ? value === 'true' : value);

  // Runtime type inference for "Any" type fields
  if (dataType === 'Any' && value !== undefined && value !== null) {
    // Try parsing as date
    value = new Date(value).getTime();
    if (!isNaN(value)) return value;
    // Try parsing as number first
    value = Number(value);
    if (!isNaN(value)) return value;
  }

  return value;
};

/**
 * Retrieves the raw value of a property without type conversions.
 * Useful for bar charts where categorical x-axis values (like dates) should remain as strings.
 *
 * @param {LogFieldsResponseProps} fields - Metadata describing the fields.
 * @param {string} axisProperty - The name of the property to retrieve.
 * @param {LogProps} log - The log object containing the data.
 * @param {string} table - The table name associated with the logs.
 * @returns {any} The raw value without type conversion.
 */
export const getRawValue = (
  fields: LogFieldsResponseProps,
  axisProperty: string,
  log: LogProps,
  table: string
) => {
  if (!hasProperty(fields, axisProperty, log, table)) return undefined;
  const fieldType = fields[axisProperty] ? fields[axisProperty].fieldType : 'entry';
  const value =
    fieldType === 'derived_entry'
      ? (log[`${table}.derivedEntries`] as LogItemProps)[axisProperty]
      : (log[`${table}.entries`] as LogItemProps)[axisProperty];
  return value;
};

/**
 * Infers the display type for "Any" type fields based on actual data values.
 * Used to determine proper axis formatting when the field type is "Any".
 *
 * @param {LogFieldsResponseProps} fields - Metadata describing the fields.
 * @param {string} axisProperty - The name of the property to check.
 * @param {LogProps[]} logs - Array of log objects to sample for type inference.
 * @param {string} table - The table name associated with the logs.
 * @returns {string} The inferred display type ("timestamp", "float", or the original dataType).
 */
export const inferDisplayType = (
  fields: LogFieldsResponseProps,
  axisProperty: string,
  logs: LogProps[],
  table: string
): string => {
  const dataType = fields[axisProperty]?.dataType;
  if (dataType !== 'Any') return dataType || 'float';

  // Sample up to 5 logs to infer type
  const sampleSize = Math.min(5, logs.length);
  for (let i = 0; i < sampleSize; i++) {
    const log = logs[i];
    if (!hasProperty(fields, axisProperty, log, table)) continue;

    const fieldType = fields[axisProperty]?.fieldType || 'entry';
    // Params support removed - only get from derived_entry or entry
    const value =
      fieldType === 'derived_entry'
        ? (log[`${table}.derivedEntries`] as LogItemProps)?.[axisProperty]
        : (log[`${table}.entries`] as LogItemProps)?.[axisProperty];

    if (value === undefined || value === null) continue;

    // Check if it looks like a date string
    if (typeof value === 'string') {
      const dateMs = new Date(value).getTime();
      if (!isNaN(dateMs)) return 'timestamp';
    }

    // If it's already a number, return float
    if (typeof value === 'number') return 'float';
  }

  return 'float'; // Default fallback
};
