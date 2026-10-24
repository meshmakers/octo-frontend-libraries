import { ResolvedEntityForm, ResolvedField } from '../models/entity-form.models';
import {
  EntityFormCrossFieldValidator,
  crossFieldValidatorApplies,
  flattenCrossFieldValidators,
  runCrossFieldValidators,
} from './cross-field-validation';

const FIELDS: ResolvedField[] = ['low', 'high'].map((key) => ({
  key, kind: 'attribute', attributeName: key, valueType: 'STRING', label: key, editor: 'text', required: false,
  readOnly: 'never', width: 'half', order: 0, secret: false, generated: false,
}));

function form(rtCkTypeId: string, ancestors?: string[]): ResolvedEntityForm {
  return {
    source: 'seeded', rtCkTypeId, ...(ancestors ? { ckTypeAncestors: ancestors } : {}), formTargetCkTypeId: rtCkTypeId,
    isAbstract: false, includeDerivedTypes: true, title: 't',
    capabilities: { canCreate: true, canEdit: true, canDelete: false, canDuplicate: false, canExport: false, createRequiresSubtype: false },
    sections: [], listColumns: [], readAttributeNames: [], secretFields: [], warnings: [],
  };
}

const lowAboveHigh = (ckTypeIds: string[]): EntityFormCrossFieldValidator => ({
  ckTypeIds,
  validate: ({ values }) => (Number(values['low']) > Number(values['high']) ? { low: 'low above high', HIGH: 'high below low' } : null),
});

describe('cross-field validation', () => {
  it('applies to the concrete type and to a listed ancestor, case-insensitively, but not to unrelated types', () => {
    const v = lowAboveHigh(['System/Entity']);
    expect(crossFieldValidatorApplies(v, form('system/entity'))).toBe(true);
    expect(crossFieldValidatorApplies(v, form('System.UI/EntityForm', ['System.UI/Mid', 'System/Entity']))).toBe(true);
    expect(crossFieldValidatorApplies(v, form('System.UI/EntityForm', ['System.UI/Mid']))).toBe(false);
    expect(crossFieldValidatorApplies(v, form('System.UI/EntityForm'))).toBe(false);
  });

  it('maps names (field key or attribute name, any casing) to field keys and drops unknown names', () => {
    const v: EntityFormCrossFieldValidator = { ckTypeIds: ['System/Entity'], validate: () => ({ LOW: 'a', high: 'b', nothing: 'c' }) };
    expect(runCrossFieldValidators([v], form('System/Entity'), FIELDS, {}, 'edit')).toEqual({ low: 'a', high: 'b' });
  });

  it('keeps the first message per field and skips validators of other types', () => {
    const first: EntityFormCrossFieldValidator = { ckTypeIds: ['System/Entity'], validate: () => ({ low: 'first' }) };
    const second: EntityFormCrossFieldValidator = { ckTypeIds: ['System/Entity'], validate: () => ({ low: 'second', high: 'other' }) };
    const foreign: EntityFormCrossFieldValidator = { ckTypeIds: ['System.UI/Other'], validate: () => ({ high: 'foreign' }) };
    expect(runCrossFieldValidators([first, second, foreign], form('System/Entity'), FIELDS, {}, 'edit'))
      .toEqual({ low: 'first', high: 'other' });
  });

  it('ignores a throwing validator and empty messages', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bad: EntityFormCrossFieldValidator = { ckTypeIds: ['System/Entity'], validate: () => { throw new Error('boom'); } };
    const empty: EntityFormCrossFieldValidator = { ckTypeIds: ['System/Entity'], validate: () => ({ low: '' }) };
    expect(runCrossFieldValidators([bad, empty], form('System/Entity'), FIELDS, {}, 'edit')).toEqual({});
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('flattens single, list and nested multi-provider entries', () => {
    const a = lowAboveHigh(['System/A']);
    const b = lowAboveHigh(['System/B']);
    expect(flattenCrossFieldValidators(null)).toEqual([]);
    expect(flattenCrossFieldValidators([[a], b] as never)).toEqual([a, b]);
  });
});
