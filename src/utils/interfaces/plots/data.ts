"use client";

import { LogProps, LogItemProps, LogFieldsResponseProps } from "@/types/interfaces/logs";
import { timeValueToTime, timeDeltaValueToDuration } from "../format";

/**
 * Checks if a specific property exists within a log object, considering its potential location
 * (derived_entry, param, or entry) based on the field metadata.
 *
 * @param {LogFieldsResponseProps} fields - Metadata describing the fields, including their type ('derived_entry', 'param', 'entry').
 * @param {string} axisProperty - The name of the property (field) to check for.
 * @param {LogProps} log - The log object potentially containing the property.
 * @param {string} table - The name of the table associated with the log, used to access nested properties like `${table}.entries`.
 * @returns {boolean} True if the property exists in the expected location within the log object, false otherwise.
*/
export const hasProperty = (fields: LogFieldsResponseProps, axisProperty: string, log: LogProps, table: string) => {
    const fieldType = fields[axisProperty] ? fields[axisProperty].field_type : "entry"
    const hasValues = fieldType === "derived_entry"
        ? log[`${table}.derived_entries`] && (log[`${table}.derived_entries`] as LogItemProps)[axisProperty] !== undefined
        : fieldType === "param"
            ? log[`${table}.params`] && (log[`${table}.params`] as LogItemProps)[axisProperty] !== undefined
            : log[`${table}.entries`] && (log[`${table}.entries`] as LogItemProps)[axisProperty] !== undefined
    return hasValues
}

/**
 * Retrieves the value of a specific property from a log object.
 * It determines the correct location (derived_entry, param, entry) based on field metadata
 * and converts certain data types (timestamp, date, timedelta, time, bool) to a numerical representation.
 * Returns undefined if the property does not exist in the log.
 *
 * @param {LogFieldsResponseProps} fields - Metadata describing the fields, including type and data_type.
 * @param {string} axisProperty - The name of the property (field) whose value is to be retrieved.
 * @param {LogProps} log - The log object containing the data.
 * @param {string} table - The name of the table associated with the log.
 * @returns {number | undefined} The numerical value of the property after potential type conversion,
 * or undefined if the property is not found.
*/
export const getValue = (fields: LogFieldsResponseProps, axisProperty: string, log: LogProps, table: string) => {
    if (!hasProperty(fields, axisProperty, log, table)) return undefined;
    const fieldType = fields[axisProperty] ? fields[axisProperty].field_type : "entry"
    let value = fieldType === "derived_entry"
        ? (log[`${table}.derived_entries`] as LogItemProps)[axisProperty]
        : fieldType === "param"
            ? (log[`${table}.params`] as LogItemProps)[axisProperty]
            : (log[`${table}.entries`] as LogItemProps)[axisProperty]
    const dataType = fields[axisProperty] ? fields[axisProperty].data_type : "float"
    if (dataType === "timestamp" || dataType === "date") value = new Date(value).getTime()
    if (dataType === "timedelta") value = timeDeltaValueToDuration(value)
    if (dataType === "time") value = timeValueToTime(value).getTime()
    if (dataType === "bool") value = Number(typeof value === "string" ? value === "true" : value) 
    return value
}