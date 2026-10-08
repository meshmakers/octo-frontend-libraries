import type { ResolvedEntityForm, ResolvedField } from '../models/entity-form.models';
import {
  entityFormUnsetPlaceholderFields,
  entityFormUnsetPlaceholderLookup,
  isEntityFormUnsetPlaceholder,
} from './unset-placeholders';

function field(partial: Partial<ResolvedField> & { key: string }): ResolvedField {
  return {
    kind: 'attribute', attributeName: partial.key, valueType: 'STRING', label: partial.key, editor: 'text', required: false,
    readOnly: 'never', width: 'full', order: 0, secret: false, generated: false, ...partial,
  };
}

function resolvedForm(fields: ResolvedField[], secretFields: string[]): ResolvedEntityForm {
  return {
    source: 'builtIn', rtCkTypeId: 'A/B', formTargetCkTypeId: 'A/B', isAbstract: false, includeDerivedTypes: false, title: 'B',
    capabilities: { canCreate: true, canEdit: true, canDelete: true, canDuplicate: false, canExport: false, createRequiresSubtype: false },
    sections: [{ key: 's', title: null, columns: 1, collapsed: false, generated: false, fields }],
    listColumns: [], readAttributeNames: [], secretFields, warnings: [],
  };
}

describe('unset placeholders (AB#5623)', () => {
  it('builds a lookup from a plain list (global) or an object (global + per attribute, any casing)', () => {
    const list = entityFormUnsetPlaceholderLookup(['A', 'B']);
    expect([...list.global]).toEqual(['A', 'B']);
    expect(list.attributes.size).toBe(0);

    const object = entityFormUnsetPlaceholderLookup({ global: ['G'], attributes: { AzureTenantId: ['T'], azureTenantID: ['T2'] } });
    expect([...object.global]).toEqual(['G']);
    expect([...(object.attributes.get('azuretenantid') ?? [])]).toEqual(['T', 'T2']);

    expect(entityFormUnsetPlaceholderLookup(null).global.size).toBe(0);
    expect(entityFormUnsetPlaceholderLookup(undefined).attributes.size).toBe(0);
  });

  it('matches exact string values of the attribute (case-sensitive), never non-strings', () => {
    const lookup = entityFormUnsetPlaceholderLookup({ global: ['TODO'], attributes: { clientId: ['TODO_SET_CLIENT_ID'] } });
    expect(isEntityFormUnsetPlaceholder(lookup, { attributeName: 'any' }, 'TODO')).toBe(true);
    expect(isEntityFormUnsetPlaceholder(lookup, { attributeName: 'ClientId' }, 'TODO_SET_CLIENT_ID')).toBe(true);
    expect(isEntityFormUnsetPlaceholder(lookup, { attributeName: 'other' }, 'TODO_SET_CLIENT_ID')).toBe(false);
    expect(isEntityFormUnsetPlaceholder(lookup, { attributeName: 'any' }, 'todo')).toBe(false);
    expect(isEntityFormUnsetPlaceholder(lookup, { attributeName: 'any' }, 1)).toBe(false);
    expect(isEntityFormUnsetPlaceholder(lookup, { attributeName: 'any' }, null)).toBe(false);
  });

  it('never matches secrets (secret flag or value type SECRET)', () => {
    const lookup = entityFormUnsetPlaceholderLookup(['TODO']);
    expect(isEntityFormUnsetPlaceholder(lookup, { attributeName: 'password', secret: true }, 'TODO')).toBe(false);
    expect(isEntityFormUnsetPlaceholder(lookup, { attributeName: 'token', valueType: 'SECRET' }, 'TODO')).toBe(false);
    expect(isEntityFormUnsetPlaceholder(lookup, { attributeName: 'token', valueType: 'secret' }, 'TODO')).toBe(false);
  });

  it('lists the non-secret attribute fields holding a placeholder', () => {
    const model = resolvedForm([
      field({ key: 'clientId' }),
      field({ key: 'password', secret: true }),
      field({ key: 'apiKey' }),
      field({ key: 'rtWellKnownName', kind: 'system', attributeName: undefined }),
    ], ['password', 'ApiKey']);
    const lookup = entityFormUnsetPlaceholderLookup(['TODO']);
    const values = { clientId: 'TODO', password: 'TODO', apiKey: 'TODO', rtWellKnownName: 'TODO' };
    expect(entityFormUnsetPlaceholderFields(model, values, lookup)).toEqual(['clientId']);
    expect(entityFormUnsetPlaceholderFields(model, values, entityFormUnsetPlaceholderLookup(null))).toEqual([]);
    expect(entityFormUnsetPlaceholderFields(model, null, lookup)).toEqual([]);
  });
});
