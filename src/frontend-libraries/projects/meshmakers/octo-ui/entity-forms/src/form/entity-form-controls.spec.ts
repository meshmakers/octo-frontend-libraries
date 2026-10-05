import { ResolvedEntityForm, ResolvedField } from '../models/entity-form.models';
import {
  buildFormGroup,
  buildValidators,
  initialValue,
  isFieldReadOnly,
  isFormReadOnly,
  jsonValidator,
  urlValidator,
} from './entity-form-controls';
import { FormControl } from '@angular/forms';

function field(partial: Partial<ResolvedField> & { key: string }): ResolvedField {
  return {
    kind: 'attribute',
    attributeName: partial.key,
    valueType: 'STRING',
    label: partial.key,
    editor: 'text',
    required: false,
    readOnly: 'never',
    width: 'full',
    order: 0,
    secret: false,
    generated: false,
    ...partial,
  };
}

function model(fields: ResolvedField[], canEdit = true): ResolvedEntityForm {
  return {
    source: 'tenant',
    rtCkTypeId: 'Test/Thing',
    formTargetCkTypeId: 'Test/Thing',
    isAbstract: false,
    includeDerivedTypes: false,
    title: 'Thing',
    capabilities: { canCreate: true, canEdit, canDelete: true, canDuplicate: false, canExport: false, createRequiresSubtype: false },
    sections: [{ key: 's', title: 'S', columns: 1, collapsed: false, generated: false, fields }],
    listColumns: [],
    readAttributeNames: [],
    secretFields: [],
    warnings: [],
  };
}

function errorsOf(f: ResolvedField, value: unknown, mode: 'create' | 'edit' = 'create', presence: Record<string, boolean> = {}): Record<string, unknown> | null {
  const c = new FormControl<unknown>(value, { validators: buildValidators(f, mode, presence) });
  return c.errors;
}

describe('entity-form-controls', () => {
  describe('validators', () => {
    it('required', () => {
      const f = field({ key: 'host', required: true });
      expect(errorsOf(f, null)).toEqual({ required: true });
      expect(errorsOf(f, '')).toEqual({ required: true });
      expect(errorsOf(f, 'x')).toBeNull();
    });

    it('required on an array editor rejects an empty array', () => {
      const f = field({ key: 'tags', valueType: 'STRING_ARRAY', editor: 'chips', required: true });
      expect(errorsOf(f, [])).toEqual({ required: true });
      expect(errorsOf(f, ['a'])).toBeNull();
    });

    it('a required toggle never fails (false is a value)', () => {
      const f = field({ key: 'on', valueType: 'BOOLEAN', editor: 'toggle', required: true });
      expect(errorsOf(f, false)).toBeNull();
    });

    it('min and max on numbers only', () => {
      const n = field({ key: 'port', valueType: 'INT', editor: 'number', min: 1, max: 65535 });
      expect(errorsOf(n, 0)).toEqual(expect.objectContaining({ min: expect.anything() }));
      expect(errorsOf(n, 70000)).toEqual(expect.objectContaining({ max: expect.anything() }));
      expect(errorsOf(n, 22)).toBeNull();
      const s = field({ key: 'name', min: 1, max: 2 });
      expect(errorsOf(s, 'long text')).toBeNull();
    });

    it('pattern on text-like editors, anchored', () => {
      const f = field({ key: 'code', pattern: '[A-Z]{3}' });
      expect(errorsOf(f, 'ABC')).toBeNull();
      expect(errorsOf(f, 'ABCD')).toEqual(expect.objectContaining({ pattern: expect.anything() }));
      expect(errorsOf(f, '')).toBeNull();
    });

    it('an invalid pattern is ignored', () => {
      const f = field({ key: 'code', pattern: '([' });
      expect(errorsOf(f, 'anything')).toBeNull();
    });

    it('pattern is not applied to numbers', () => {
      const f = field({ key: 'n', valueType: 'INT', editor: 'number', pattern: '^1$' });
      expect(errorsOf(f, 5)).toBeNull();
    });

    it('email', () => {
      const f = field({ key: 'mail', editor: 'email' });
      expect(errorsOf(f, 'not-an-email')).toEqual({ email: true });
      expect(errorsOf(f, 'a@b.io')).toBeNull();
    });

    it('url needs a scheme', () => {
      const f = field({ key: 'u', editor: 'url' });
      expect(errorsOf(f, 'example.com')).toEqual({ url: true });
      expect(errorsOf(f, 'https://example.com/charts')).toBeNull();
      expect(errorsOf(f, 'oci://registry.io/repo')).toBeNull();
      expect(urlValidator()(new FormControl(''))).toBeNull();
    });

    it('json via JSON.parse', () => {
      const f = field({ key: 'j', editor: 'json' });
      expect(errorsOf(f, '{"a":1}')).toBeNull();
      expect(errorsOf(f, '{a:1}')).toEqual({ json: true });
      expect(jsonValidator()(new FormControl('  '))).toBeNull();
    });

    it('a required secret is required on create and when not set, but not when set', () => {
      const f = field({ key: 'password', editor: 'password', secret: true, required: true });
      expect(errorsOf(f, null, 'create')).toEqual({ required: true });
      expect(errorsOf(f, null, 'edit', { password: false })).toEqual({ required: true });
      expect(errorsOf(f, null, 'edit', { password: true })).toBeNull();
    });
  });

  describe('read-only rules', () => {
    it('afterCreate is editable on create only', () => {
      const f = field({ key: 'host', readOnly: 'afterCreate' });
      expect(isFieldReadOnly(f, 'create', false)).toBe(false);
      expect(isFieldReadOnly(f, 'edit', false)).toBe(true);
    });

    it('always and unsupported are read-only; form read-only wins', () => {
      expect(isFieldReadOnly(field({ key: 'a', readOnly: 'always' }), 'create', false)).toBe(true);
      expect(isFieldReadOnly(field({ key: 'b', editor: 'unsupported' }), 'create', false)).toBe(true);
      expect(isFieldReadOnly(field({ key: 'c' }), 'edit', true)).toBe(true);
    });

    it('canEdit false makes edit mode read-only, not create mode', () => {
      const m = model([field({ key: 'a' })], false);
      expect(isFormReadOnly(m, 'edit', false)).toBe(true);
      expect(isFormReadOnly(m, 'create', false)).toBe(false);
      expect(isFormReadOnly(model([]), 'view', false)).toBe(true);
    });
  });

  describe('initial values', () => {
    it('never prefills a secret', () => {
      const f = field({ key: 'password', secret: true });
      expect(initialValue(f, 'edit', { values: { password: 'leak' }, secretPresence: { password: true }, associations: {} })).toBeNull();
    });

    it('applies the default only in create mode', () => {
      const f = field({ key: 'port', valueType: 'INT', editor: 'number', defaultValue: 22 });
      expect(initialValue(f, 'create', null)).toBe(22);
      expect(initialValue(f, 'edit', { values: {}, secretPresence: {}, associations: {} })).toBeNull();
    });

    it('uses empty shapes per editor', () => {
      expect(initialValue(field({ key: 't', editor: 'toggle', valueType: 'BOOLEAN' }), 'edit', null)).toBe(false);
      expect(initialValue(field({ key: 'c', editor: 'chips', valueType: 'STRING_ARRAY' }), 'edit', null)).toEqual([]);
    });

    it('reads associations and the well-known name', () => {
      const assoc = field({ key: 'assoc:System/Related', kind: 'association', editor: 'reference', attributeName: undefined });
      const wkn = field({ key: 'rtWellKnownName', kind: 'system', attributeName: undefined });
      const state = {
        values: {},
        secretPresence: {},
        associations: { 'assoc:System/Related': [{ rtId: '1', ckTypeId: 'X/Y', displayName: 'one' }] },
        rtWellKnownName: 'main',
      };
      expect(initialValue(assoc, 'edit', state)).toEqual([{ rtId: '1', ckTypeId: 'X/Y', displayName: 'one' }]);
      expect(initialValue(wkn, 'edit', state)).toBe('main');
    });
  });

  it('buildFormGroup creates one control per field and disables read-only ones', () => {
    const m = model([field({ key: 'host', readOnly: 'afterCreate' }), field({ key: 'port', valueType: 'INT', editor: 'number' })]);
    const g = buildFormGroup(m, 'edit', { state: { values: { host: 'h', port: 22 }, secretPresence: {}, associations: {} } });
    expect(Object.keys(g.controls)).toEqual(['host', 'port']);
    expect(g.controls['host'].disabled).toBe(true);
    expect(g.controls['port'].value).toBe(22);
  });
});
