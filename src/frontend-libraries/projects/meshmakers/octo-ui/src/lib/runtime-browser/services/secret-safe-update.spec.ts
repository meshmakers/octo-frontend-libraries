import { Attribute } from '../models/attribute';
import { planSecretSafeUpdate } from './secret-safe-update';

function def(attributeName: string, attributeValueType = 'STRING', secret = false): Attribute {
  return { id: { ckId: '', rtId: null }, attributeName, attributeValueType, isOptional: true, ...(secret ? { secret } : {}) };
}

describe('planSecretSafeUpdate (AB#5542)', () => {
  const definitions = [
    def('name'),
    def('password', 'STRING', true),
    def('values', 'RECORD_ARRAY'),
    def('credentials', 'RECORD'),
  ];
  const analysis = {
    attributeNames: ['name', 'values', 'path', 'value', 'isSecret', 'credentials', 'userName'],
    secretNames: ['password', 'clientSecret'],
    blockedAttributes: ['credentials'],
  };
  const initial = JSON.stringify({ name: 'a', password: null, values: [{ path: 'x', value: '1', isSecret: true }], credentials: { userName: 'u' } });

  it('writes back a record that was loaded completely (Helm values keep isSecret)', () => {
    const formValue = { name: 'a', password: null, values: [{ path: 'x', value: '2', isSecret: true }], credentials: { userName: 'u' } };
    const mapped = [
      { attributeName: 'name', value: 'a' },
      { attributeName: 'values', value: [{ path: 'x', value: '2', isSecret: true }] },
      { attributeName: 'credentials', value: { userName: 'u' } },
    ];

    const plan = planSecretSafeUpdate(mapped, definitions, analysis, formValue, initial);

    expect(plan.attributes.map((a) => a.attributeName)).toEqual(['name', 'values']);
    expect(plan.attributes[1].value).toEqual([{ path: 'x', value: '2', isSecret: true }]);
    expect(plan.otherChanged).toBe(true);
    expect(plan.blockedChanged).toBe(false);
  });

  it('never writes a blocked record back and reports a change to it', () => {
    const formValue = { name: 'a', password: null, values: [{ path: 'x', value: '1', isSecret: true }], credentials: { userName: 'changed' } };
    const mapped = [{ attributeName: 'name', value: 'a' }, { attributeName: 'credentials', value: { userName: 'changed' } }];

    const plan = planSecretSafeUpdate(mapped, definitions, analysis, formValue, initial);

    expect(plan.attributes.map((a) => a.attributeName)).toEqual(['name']);
    expect(plan.blockedChanged).toBe(true);
    expect(plan.otherChanged).toBe(false); // → the editor skips the call, one message only
  });

  it('blocks every non-secret attribute that was not loaded (e.g. the CK lookup failed) but keeps write-only secrets', () => {
    const empty = { attributeNames: [], secretNames: [], blockedAttributes: [] };
    const formValue = { name: 'b', password: 'new' };
    const mapped = [{ attributeName: 'name', value: 'b' }, { attributeName: 'password', value: 'new' }];

    const plan = planSecretSafeUpdate(mapped, definitions, empty, formValue, JSON.stringify({ name: 'a', password: null }));

    expect(plan.attributes).toEqual([{ attributeName: 'password', value: 'new' }]);
    expect(plan.blocked.has('name')).toBe(true);
  });
});
