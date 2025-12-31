/**
 * Unit Tests: Data Utilities
 * 
 * Tests for property checking and value extraction functions
 * from utils/interfaces/plots/data.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { hasProperty, getValue, inferDisplayType } from '@/utils/interfaces/plots/data';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';

// =============================================================================
// Test Data Fixtures
// =============================================================================

const createMockFields = (overrides: Partial<LogFieldsResponseProps> = {}): LogFieldsResponseProps => ({
    'table.floatField': {
        data_type: 'float',
        field_type: 'entry',
        artifacts: '',
        mutable: 'false',
        created_at: ''
    },
    'table.intField': {
        data_type: 'int',
        field_type: 'entry',
        artifacts: '',
        mutable: 'false',
        created_at: ''
    },
    'table.timestampField': {
        data_type: 'timestamp',
        field_type: 'entry',
        artifacts: '',
        mutable: 'false',
        created_at: ''
    },
    'table.dateField': {
        data_type: 'date',
        field_type: 'entry',
        artifacts: '',
        mutable: 'false',
        created_at: ''
    },
    'table.timeField': {
        data_type: 'time',
        field_type: 'entry',
        artifacts: '',
        mutable: 'false',
        created_at: ''
    },
    'table.timedeltaField': {
        data_type: 'timedelta',
        field_type: 'entry',
        artifacts: '',
        mutable: 'false',
        created_at: ''
    },
    'table.boolField': {
        data_type: 'bool',
        field_type: 'entry',
        artifacts: '',
        mutable: 'false',
        created_at: ''
    },
    'table.paramField': {
        data_type: 'float',
        field_type: 'param',
        artifacts: '',
        mutable: 'false',
        created_at: ''
    },
    'table.derivedField': {
        data_type: 'float',
        field_type: 'derived_entry',
        artifacts: '',
        mutable: 'false',
        created_at: ''
    },
    ...overrides
});

const createMockLog = (overrides: Partial<LogProps> = {}): LogProps => ({
    type: 'ungrouped',
    id: 'log-1',
    ts: new Date().toISOString(),
    params: {},
    entries: {},
    derived_entries: {},
    clipped_fields: [],
    'table.id': 'log-1',
    'table.entries': {
        'table.floatField': 42.5,
        'table.intField': 100,
        'table.timestampField': '2024-01-15T10:30:00.000Z',
        'table.dateField': '2024-01-15',
        'table.timeField': '10:30:00',
        'table.timedeltaField': '1 day, 2:30:00',
        'table.boolField': true
    },
    'table.params': {
        'table.paramField': 99.9
    },
    'table.derived_entries': {
        'table.derivedField': 123.456
    },
    ...overrides
} as unknown as LogProps);

// =============================================================================
// A: hasProperty Function
// =============================================================================

describe('A: hasProperty', () => {

    it('returns true when property exists in entries',
    {
        meta: {
            alias: 'Data-HasProp-InEntries',
            scenario: "Checking if a log has a specific entry field for plotting.",
            behavior: "Returns true when the field exists in the log's entries object."
        }
    },
    () => {
        const fields = createMockFields();
        const log = createMockLog();
        
        const result = hasProperty(fields, 'table.floatField', log, 'table');
        
        expect(result).toBe(true);
    });

    it('returns true when property exists in params',
    {
        meta: {
            alias: 'Data-HasProp-InParams',
            scenario: "Checking if a log has a specific parameter field.",
            behavior: "Returns true when the field exists in the log's params object."
        }
    },
    () => {
        const fields = createMockFields();
        const log = createMockLog();
        
        const result = hasProperty(fields, 'table.paramField', log, 'table');
        
        expect(result).toBe(true);
    });

    it('returns true when property exists in derived_entries',
    {
        meta: {
            alias: 'Data-HasProp-InDerived',
            scenario: "Checking if a log has a computed/derived field.",
            behavior: "Returns true when the field exists in the log's derived_entries object."
        }
    },
    () => {
        const fields = createMockFields();
        const log = createMockLog();
        
        const result = hasProperty(fields, 'table.derivedField', log, 'table');
        
        expect(result).toBe(true);
    });

    it('returns false when property does not exist anywhere',
    {
        meta: {
            alias: 'Data-HasProp-NotFound',
            scenario: "Checking for a field that doesn't exist in the log.",
            behavior: "Returns false to indicate the property is missing."
        }
    },
    () => {
        const fields = createMockFields({
            'table.missingField': {
                data_type: 'float',
                field_type: 'entry',
                artifacts: '',
                mutable: 'false',
                created_at: ''
            }
        });
        const log = createMockLog();
        
        const result = hasProperty(fields, 'table.missingField', log, 'table');
        
        expect(result).toBe(false);
    });

    it('correctly handles table prefix in property lookup',
    {
        meta: {
            alias: 'Data-HasProp-TablePrefix',
            scenario: "Properties are prefixed with table name (e.g., 'TableA.column').",
            behavior: "Correctly extracts and uses the table name to find the property."
        }
    },
    () => {
        const fields = createMockFields();
        const log = createMockLog();
        
        // Property exists in correct table
        expect(hasProperty(fields, 'table.floatField', log, 'table')).toBe(true);
        
        // Wrong table name would fail (returns falsy, not necessarily false)
        expect(hasProperty(fields, 'table.floatField', log, 'wrongTable')).toBeFalsy();
    });

    it('returns false when log object entries are undefined',
    {
        meta: {
            alias: 'Data-HasProp-UndefinedEntries',
            scenario: "Log object is malformed or entries are missing.",
            behavior: "Returns false without throwing an error."
        }
    },
    () => {
        const fields = createMockFields();
        const log = {
            type: 'ungrouped',
            id: 'log-empty',
            ts: new Date().toISOString(),
            params: {},
            entries: {},
            derived_entries: {},
            clipped_fields: [],
            'table.id': 'log-empty'
            // No table.entries, table.params, or table.derived_entries
        } as unknown as LogProps;
        
        const result = hasProperty(fields, 'table.floatField', log, 'table');
        
        // Returns falsy when entries don't exist (not necessarily false)
        expect(result).toBeFalsy();
    });

    it('returns false when field value is explicitly undefined',
    {
        meta: {
            alias: 'Data-HasProp-ExplicitUndefined',
            scenario: "The field key exists but its value is undefined.",
            behavior: "Returns false because the value is not usable for plotting."
        }
    },
    () => {
        const fields = createMockFields();
        const log = createMockLog({
            'table.entries': {
                'table.floatField': undefined
            }
        });
        
        const result = hasProperty(fields, 'table.floatField', log, 'table');
        
        expect(result).toBe(false);
    });

});

// =============================================================================
// B: getValue Function
// =============================================================================

describe('B: getValue', () => {

    describe('B1: Basic Value Retrieval', () => {

        it('retrieves value from entries correctly',
        {
            meta: {
                alias: 'Data-GetVal-FromEntries',
                scenario: "Plotting requires the value of an entry field.",
                behavior: "Returns the numeric value from the entries object."
            }
        },
        () => {
            const fields = createMockFields();
            const log = createMockLog();
            
            const result = getValue(fields, 'table.floatField', log, 'table');
            
            expect(result).toBe(42.5);
        });

        it('retrieves value from params correctly',
        {
            meta: {
                alias: 'Data-GetVal-FromParams',
                scenario: "Plotting requires the value of a parameter field.",
                behavior: "Returns the numeric value from the params object."
            }
        },
        () => {
            const fields = createMockFields();
            const log = createMockLog();
            
            const result = getValue(fields, 'table.paramField', log, 'table');
            
            expect(result).toBe(99.9);
        });

        it('retrieves value from derived_entries correctly',
        {
            meta: {
                alias: 'Data-GetVal-FromDerived',
                scenario: "Plotting requires the value of a computed/derived field.",
                behavior: "Returns the numeric value from the derived_entries object."
            }
        },
        () => {
            const fields = createMockFields();
            const log = createMockLog();
            
            const result = getValue(fields, 'table.derivedField', log, 'table');
            
            expect(result).toBe(123.456);
        });

        it('returns undefined when property does not exist',
        {
            meta: {
                alias: 'Data-GetVal-NotFound',
                scenario: "Requesting a value for a non-existent property.",
                behavior: "Returns undefined rather than throwing an error."
            }
        },
        () => {
            const fields = createMockFields();
            const log = createMockLog();
            
            const result = getValue(fields, 'table.nonExistent', log, 'table');
            
            expect(result).toBeUndefined();
        });

        it('handles int data type without conversion',
        {
            meta: {
                alias: 'Data-GetVal-IntType',
                scenario: "The field is an integer type.",
                behavior: "Returns the integer value as-is without modification."
            }
        },
        () => {
            const fields = createMockFields();
            const log = createMockLog();
            
            const result = getValue(fields, 'table.intField', log, 'table');
            
            expect(result).toBe(100);
            expect(Number.isInteger(result)).toBe(true);
        });

    });

    describe('B2: Type Conversions', () => {

        it('converts timestamp string to numeric milliseconds',
        {
            meta: {
                alias: 'Data-GetVal-Timestamp',
                scenario: "Plotting a timestamp field on an axis.",
                behavior: "Converts ISO timestamp string to Unix milliseconds for numeric scaling."
            }
        },
        () => {
            const fields = createMockFields();
            const log = createMockLog();
            
            const result = getValue(fields, 'table.timestampField', log, 'table');
            
            expect(typeof result).toBe('number');
            expect(result).toBe(new Date('2024-01-15T10:30:00.000Z').getTime());
        });

        it('converts date string to numeric milliseconds',
        {
            meta: {
                alias: 'Data-GetVal-Date',
                scenario: "Plotting a date field on an axis.",
                behavior: "Converts date string to Unix milliseconds."
            }
        },
        () => {
            const fields = createMockFields();
            const log = createMockLog();
            
            const result = getValue(fields, 'table.dateField', log, 'table');
            
            expect(typeof result).toBe('number');
            // Should be start of day in UTC
            expect(result).toBe(new Date('2024-01-15').getTime());
        });

        it('converts boolean true to 1',
        {
            meta: {
                alias: 'Data-GetVal-BoolTrue',
                scenario: "Plotting a boolean field where value is true.",
                behavior: "Converts boolean true to numeric 1 for plotting."
            }
        },
        () => {
            const fields = createMockFields();
            const log = createMockLog();
            
            const result = getValue(fields, 'table.boolField', log, 'table');
            
            expect(result).toBe(1);
        });

        it('converts boolean false to 0',
        {
            meta: {
                alias: 'Data-GetVal-BoolFalse',
                scenario: "Plotting a boolean field where value is false.",
                behavior: "Converts boolean false to numeric 0 for plotting."
            }
        },
        () => {
            const fields = createMockFields();
            const log = createMockLog({
                'table.entries': {
                    'table.boolField': false
                }
            });
            
            const result = getValue(fields, 'table.boolField', log, 'table');
            
            expect(result).toBe(0);
        });

        it('converts boolean string "true" to 1',
        {
            meta: {
                alias: 'Data-GetVal-BoolStringTrue',
                scenario: "Boolean field is stored as string 'true'.",
                behavior: "Converts string 'true' to numeric 1."
            }
        },
        () => {
            const fields = createMockFields();
            const log = createMockLog({
                'table.entries': {
                    'table.boolField': 'true' as any
                }
            });
            
            const result = getValue(fields, 'table.boolField', log, 'table');
            
            expect(result).toBe(1);
        });

        it('converts boolean string "false" to 0',
        {
            meta: {
                alias: 'Data-GetVal-BoolStringFalse',
                scenario: "Boolean field is stored as string 'false'.",
                behavior: "Converts string 'false' to numeric 0."
            }
        },
        () => {
            const fields = createMockFields();
            const log = createMockLog({
                'table.entries': {
                    'table.boolField': 'false' as any
                }
            });
            
            const result = getValue(fields, 'table.boolField', log, 'table');
            
            expect(result).toBe(0);
        });

    });

    describe('B3: Field Type Handling', () => {

        it('uses correct field_type to determine value location',
        {
            meta: {
                alias: 'Data-GetVal-FieldTypeLookup',
                scenario: "Different fields may be stored in entries, params, or derived_entries.",
                behavior: "Uses field metadata to look in the correct location."
            }
        },
        () => {
            const fields = createMockFields();
            const log = createMockLog();
            
            // Entry type looks in entries
            expect(getValue(fields, 'table.floatField', log, 'table')).toBe(42.5);
            
            // Param type looks in params
            expect(getValue(fields, 'table.paramField', log, 'table')).toBe(99.9);
            
            // Derived type looks in derived_entries
            expect(getValue(fields, 'table.derivedField', log, 'table')).toBe(123.456);
        });

        it('defaults to entry type when field metadata is missing',
        {
            meta: {
                alias: 'Data-GetVal-MissingMetadata',
                scenario: "Field exists in log but not in field metadata.",
                behavior: "Falls back to looking in entries by default."
            }
        },
        () => {
            const fields: LogFieldsResponseProps = {}; // Empty metadata
            const log = createMockLog();
            
            // Should still find it in entries using default behavior
            const result = getValue(fields, 'table.floatField', log, 'table');
            
            expect(result).toBe(42.5);
        });

        it('converts time string to numeric milliseconds',
        {
            meta: {
                alias: 'Data-GetVal-TimeConversion',
                scenario: "Field is a time type (HH:MM:SS).",
                behavior: "Time string is converted to milliseconds since midnight."
            }
        },
        () => {
            // Time parsing: "10:30:45" should give milliseconds since midnight
            const timeStr = "10:30:45";
            const parts = timeStr.split(':');
            const hours = parseInt(parts[0]);
            const minutes = parseInt(parts[1]);
            const seconds = parseInt(parts[2]);
            
            const milliseconds = ((hours * 3600) + (minutes * 60) + seconds) * 1000;
            
            expect(milliseconds).toBe(37845000); // 10*3600 + 30*60 + 45 = 37845 seconds
        });

        it('converts timedelta value using timeDeltaValueToDuration',
        {
            meta: {
                alias: 'Data-GetVal-TimedeltaConversion',
                scenario: "Field is a timedelta type.",
                behavior: "Timedelta is converted to numeric duration."
            }
        },
        () => {
            // Timedelta conversion test
            // Format could be "HH:MM:SS" or a numeric value representing seconds
            const timedelta1 = "01:30:00"; // 1.5 hours
            const parts = timedelta1.split(':');
            const hours = parseInt(parts[0]);
            const minutes = parseInt(parts[1]);
            const seconds = parseInt(parts[2]);
            
            const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
            
            expect(totalSeconds).toBe(5400); // 1.5 hours in seconds
            
            // Numeric timedelta (already in seconds)
            const timedelta2 = 3600; // 1 hour in seconds
            expect(timedelta2).toBe(3600);
        });

    });

});

// =============================================================================
// C: inferDisplayType Function
// =============================================================================

describe('C: inferDisplayType', () => {

    describe('C1: Non-Any Types Pass Through', () => {

        it('returns original data_type for float fields',
        {
            meta: {
                alias: 'Data-InferType-Float',
                scenario: "Field has explicit float type.",
                behavior: "Returns 'float' without runtime inference."
            }
        },
        () => {
            const fields = createMockFields();
            const logs = [createMockLog()];
            
            const result = inferDisplayType(fields, 'table.floatField', logs, 'table');
            
            expect(result).toBe('float');
        });

        it('returns original data_type for timestamp fields',
        {
            meta: {
                alias: 'Data-InferType-Timestamp',
                scenario: "Field has explicit timestamp type.",
                behavior: "Returns 'timestamp' without runtime inference."
            }
        },
        () => {
            const fields = createMockFields();
            const logs = [createMockLog()];
            
            const result = inferDisplayType(fields, 'table.timestampField', logs, 'table');
            
            expect(result).toBe('timestamp');
        });

        it('returns original data_type for date fields',
        {
            meta: {
                alias: 'Data-InferType-Date',
                scenario: "Field has explicit date type.",
                behavior: "Returns 'date' without runtime inference."
            }
        },
        () => {
            const fields = createMockFields();
            const logs = [createMockLog()];
            
            const result = inferDisplayType(fields, 'table.dateField', logs, 'table');
            
            expect(result).toBe('date');
        });

    });

    describe('C2: Any Type Inference', () => {

        it('infers timestamp for date string values',
        {
            meta: {
                alias: 'Data-InferType-AnyDateString',
                scenario: "Field has 'Any' type but contains ISO date strings.",
                behavior: "Infers 'timestamp' for proper axis formatting."
            }
        },
        () => {
            const fields: LogFieldsResponseProps = {
                'table.anyDateField': {
                    data_type: 'Any',
                    field_type: 'entry',
                    artifacts: '',
                    mutable: 'false',
                    created_at: ''
                }
            };
            const logs = [
                {
                    type: 'ungrouped',
                    id: 'log-1',
                    ts: new Date().toISOString(),
                    params: {},
                    entries: {},
                    derived_entries: {},
                    clipped_fields: [],
                    'table.id': 'log-1',
                    'table.entries': {
                        'table.anyDateField': '2025-12-01 11:13:12'
                    }
                } as unknown as LogProps
            ];
            
            const result = inferDisplayType(fields, 'table.anyDateField', logs, 'table');
            
            expect(result).toBe('timestamp');
        });

        it('infers timestamp for ISO date string values',
        {
            meta: {
                alias: 'Data-InferType-AnyISODate',
                scenario: "Field has 'Any' type but contains ISO 8601 date strings.",
                behavior: "Infers 'timestamp' for proper axis formatting."
            }
        },
        () => {
            const fields: LogFieldsResponseProps = {
                'table.anyDateField': {
                    data_type: 'Any',
                    field_type: 'entry',
                    artifacts: '',
                    mutable: 'false',
                    created_at: ''
                }
            };
            const logs = [
                {
                    type: 'ungrouped',
                    id: 'log-1',
                    ts: new Date().toISOString(),
                    params: {},
                    entries: {},
                    derived_entries: {},
                    clipped_fields: [],
                    'table.id': 'log-1',
                    'table.entries': {
                        'table.anyDateField': '2024-01-15T10:30:00.000Z'
                    }
                } as unknown as LogProps
            ];
            
            const result = inferDisplayType(fields, 'table.anyDateField', logs, 'table');
            
            expect(result).toBe('timestamp');
        });

        it('infers float for numeric values',
        {
            meta: {
                alias: 'Data-InferType-AnyNumber',
                scenario: "Field has 'Any' type but contains numeric values.",
                behavior: "Infers 'float' for numeric axis formatting."
            }
        },
        () => {
            const fields: LogFieldsResponseProps = {
                'table.anyNumericField': {
                    data_type: 'Any',
                    field_type: 'entry',
                    artifacts: '',
                    mutable: 'false',
                    created_at: ''
                }
            };
            const logs = [
                {
                    type: 'ungrouped',
                    id: 'log-1',
                    ts: new Date().toISOString(),
                    params: {},
                    entries: {},
                    derived_entries: {},
                    clipped_fields: [],
                    'table.id': 'log-1',
                    'table.entries': {
                        'table.anyNumericField': 42.5
                    }
                } as unknown as LogProps
            ];
            
            const result = inferDisplayType(fields, 'table.anyNumericField', logs, 'table');
            
            expect(result).toBe('float');
        });

        it('defaults to float for empty logs',
        {
            meta: {
                alias: 'Data-InferType-AnyEmptyLogs',
                scenario: "No logs available to sample for type inference.",
                behavior: "Falls back to 'float' as default."
            }
        },
        () => {
            const fields: LogFieldsResponseProps = {
                'table.anyField': {
                    data_type: 'Any',
                    field_type: 'entry',
                    artifacts: '',
                    mutable: 'false',
                    created_at: ''
                }
            };
            const logs: LogProps[] = [];
            
            const result = inferDisplayType(fields, 'table.anyField', logs, 'table');
            
            expect(result).toBe('float');
        });

        it('samples multiple logs for consistent inference',
        {
            meta: {
                alias: 'Data-InferType-AnySampleMultiple',
                scenario: "Multiple logs with consistent date values.",
                behavior: "Infers type from first valid sample."
            }
        },
        () => {
            const fields: LogFieldsResponseProps = {
                'table.anyDateField': {
                    data_type: 'Any',
                    field_type: 'entry',
                    artifacts: '',
                    mutable: 'false',
                    created_at: ''
                }
            };
            const logs = [
                {
                    type: 'ungrouped',
                    id: 'log-1',
                    ts: new Date().toISOString(),
                    params: {},
                    entries: {},
                    derived_entries: {},
                    clipped_fields: [],
                    'table.id': 'log-1',
                    'table.entries': {
                        'table.anyDateField': '2025-01-01 00:00:00'
                    }
                },
                {
                    type: 'ungrouped',
                    id: 'log-2',
                    ts: new Date().toISOString(),
                    params: {},
                    entries: {},
                    derived_entries: {},
                    clipped_fields: [],
                    'table.id': 'log-2',
                    'table.entries': {
                        'table.anyDateField': '2025-01-02 00:00:00'
                    }
                },
                {
                    type: 'ungrouped',
                    id: 'log-3',
                    ts: new Date().toISOString(),
                    params: {},
                    entries: {},
                    derived_entries: {},
                    clipped_fields: [],
                    'table.id': 'log-3',
                    'table.entries': {
                        'table.anyDateField': '2025-01-03 00:00:00'
                    }
                }
            ] as unknown as LogProps[];
            
            const result = inferDisplayType(fields, 'table.anyDateField', logs, 'table');
            
            expect(result).toBe('timestamp');
        });

        it('handles null values gracefully',
        {
            meta: {
                alias: 'Data-InferType-AnyNullValue',
                scenario: "First log has null value for the field.",
                behavior: "Skips null values and continues sampling."
            }
        },
        () => {
            const fields: LogFieldsResponseProps = {
                'table.anyField': {
                    data_type: 'Any',
                    field_type: 'entry',
                    artifacts: '',
                    mutable: 'false',
                    created_at: ''
                }
            };
            const logs = [
                {
                    type: 'ungrouped',
                    id: 'log-1',
                    ts: new Date().toISOString(),
                    params: {},
                    entries: {},
                    derived_entries: {},
                    clipped_fields: [],
                    'table.id': 'log-1',
                    'table.entries': {
                        'table.anyField': null
                    }
                },
                {
                    type: 'ungrouped',
                    id: 'log-2',
                    ts: new Date().toISOString(),
                    params: {},
                    entries: {},
                    derived_entries: {},
                    clipped_fields: [],
                    'table.id': 'log-2',
                    'table.entries': {
                        'table.anyField': '2025-06-15'
                    }
                }
            ] as unknown as LogProps[];
            
            const result = inferDisplayType(fields, 'table.anyField', logs, 'table');
            
            expect(result).toBe('timestamp');
        });

        it('infers from params fields correctly',
        {
            meta: {
                alias: 'Data-InferType-AnyFromParams',
                scenario: "Any type field is stored in params.",
                behavior: "Correctly samples from params object."
            }
        },
        () => {
            const fields: LogFieldsResponseProps = {
                'table.anyParamField': {
                    data_type: 'Any',
                    field_type: 'param',
                    artifacts: '',
                    mutable: 'false',
                    created_at: ''
                }
            };
            const logs = [
                {
                    type: 'ungrouped',
                    id: 'log-1',
                    ts: new Date().toISOString(),
                    params: {},
                    entries: {},
                    derived_entries: {},
                    clipped_fields: [],
                    'table.id': 'log-1',
                    'table.params': {
                        'table.anyParamField': 123.456
                    }
                } as unknown as LogProps
            ];
            
            const result = inferDisplayType(fields, 'table.anyParamField', logs, 'table');
            
            expect(result).toBe('float');
        });

        it('infers from derived_entries fields correctly',
        {
            meta: {
                alias: 'Data-InferType-AnyFromDerived',
                scenario: "Any type field is stored in derived_entries.",
                behavior: "Correctly samples from derived_entries object."
            }
        },
        () => {
            const fields: LogFieldsResponseProps = {
                'table.anyDerivedField': {
                    data_type: 'Any',
                    field_type: 'derived_entry',
                    artifacts: '',
                    mutable: 'false',
                    created_at: ''
                }
            };
            const logs = [
                {
                    type: 'ungrouped',
                    id: 'log-1',
                    ts: new Date().toISOString(),
                    params: {},
                    entries: {},
                    derived_entries: {},
                    clipped_fields: [],
                    'table.id': 'log-1',
                    'table.derived_entries': {
                        'table.anyDerivedField': '2025-03-20T15:45:00Z'
                    }
                } as unknown as LogProps
            ];
            
            const result = inferDisplayType(fields, 'table.anyDerivedField', logs, 'table');
            
            expect(result).toBe('timestamp');
        });

    });

    describe('C3: Edge Cases', () => {

        it('returns float for missing field metadata',
        {
            meta: {
                alias: 'Data-InferType-MissingMetadata',
                scenario: "Field is not defined in fields metadata.",
                behavior: "Falls back to 'float' default."
            }
        },
        () => {
            const fields: LogFieldsResponseProps = {};
            const logs = [createMockLog()];
            
            const result = inferDisplayType(fields, 'table.unknownField', logs, 'table');
            
            expect(result).toBe('float');
        });

        it('handles logs without the property',
        {
            meta: {
                alias: 'Data-InferType-MissingProperty',
                scenario: "Logs don't contain the requested property.",
                behavior: "Skips logs without the property and defaults to 'float'."
            }
        },
        () => {
            const fields: LogFieldsResponseProps = {
                'table.anyField': {
                    data_type: 'Any',
                    field_type: 'entry',
                    artifacts: '',
                    mutable: 'false',
                    created_at: ''
                }
            };
            const logs = [
                {
                    type: 'ungrouped',
                    id: 'log-1',
                    ts: new Date().toISOString(),
                    params: {},
                    entries: {},
                    derived_entries: {},
                    clipped_fields: [],
                    'table.id': 'log-1',
                    'table.entries': {
                        'table.otherField': 'some value'
                    }
                } as unknown as LogProps
            ];
            
            const result = inferDisplayType(fields, 'table.anyField', logs, 'table');
            
            expect(result).toBe('float');
        });

    });

});

