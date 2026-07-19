import { describe, expect, it } from 'vitest';
import { coerceFieldDraft, editorDescriptorForDataField, isDataFieldEditable } from './dataTypes';

describe('Data inline editor descriptors', () => {
  it('maps types and restricted values to appropriate controls', () => {
    expect(
      editorDescriptorForDataField(
        { dataType: 'str', restrict: true, enumValues: ['draft', 'published'] },
        'draft'
      )
    ).toEqual({ kind: 'select', options: ['draft', 'published'], commitOnChange: true });
    expect(editorDescriptorForDataField({ dataType: 'bool' }, false)).toEqual({
      kind: 'switch',
      commitOnChange: true,
    });
    expect(editorDescriptorForDataField({ dataType: 'int' }, 1)).toEqual({
      kind: 'text',
      inputType: 'number',
    });
    expect(editorDescriptorForDataField({ dataType: 'datetime' }, '2026-01-01T12:00')).toEqual({
      kind: 'text',
      inputType: 'datetime-local',
    });
    expect(editorDescriptorForDataField({ dataType: 'dict' }, {})).toEqual({ kind: 'textarea' });
  });

  it('rejects values outside a restricted enum before saving', () => {
    const field = { dataType: 'str', restrict: true, enumValues: ['draft', 'published'] };
    expect(coerceFieldDraft(field, 'published', 'draft')).toBe('published');
    expect(() => coerceFieldDraft(field, 'archived', 'draft')).toThrow(
      'Choose one of the allowed values.'
    );
  });

  it('keeps immutable, derived, and state-managed locked fields non-editable', () => {
    expect(isDataFieldEditable({ mutable: false }, 'data')).toBe(false);
    expect(isDataFieldEditable({ fieldType: 'derived_entry' }, 'data')).toBe(false);
    expect(isDataFieldEditable({ uiEditable: false }, 'Contacts')).toBe(false);
  });
});
