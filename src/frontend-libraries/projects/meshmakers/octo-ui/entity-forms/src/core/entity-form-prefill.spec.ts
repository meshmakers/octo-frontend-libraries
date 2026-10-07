import { ResolvedEntityForm, ResolvedField } from '../models/entity-form.models';
import {
  canonicaliseEntityFormPrefill,
  entityFormPrefillState,
  mergeEntityFormPrefill,
} from './entity-form-prefill';

function f(key: string, extra: Partial<ResolvedField> = {}): ResolvedField {
  return {
    key, kind: 'attribute', attributeName: key, valueType: 'STRING', label: key, editor: 'text',
    required: false, readOnly: 'never', width: 'full', order: 0, secret: false, generated: false, ...extra,
  };
}

const MODEL = {
  rtCkTypeId: 'Basic/Contact',
  sections: [{
    key: 's', title: null, columns: 1, collapsed: false, generated: false,
    fields: [
      f('displayName'),
      f('email'),
      f('apiKey', { secret: true }),
      f('owner', { editor: 'reference', reference: { targetCkTypeId: 'System.Identity/User', multiple: false } }),
    ],
  }],
} as unknown as ResolvedEntityForm;

describe('entity form prefill (AB#5623)', () => {
  it('builds a create state; rtWellKnownName and association keys go to their own slots', () => {
    const owner = [{ rtId: 'u1', ckTypeId: 'System.Identity/User', displayName: 'Ann' }];
    expect(entityFormPrefillState({ email: 'a@b.c', rtWellKnownName: 'Me', 'assoc:System_Owner': owner, skipped: undefined })).toEqual({
      values: { email: 'a@b.c' },
      secretPresence: {},
      associations: { 'assoc:System_Owner': owner },
      rtWellKnownName: 'Me',
    });
    expect(entityFormPrefillState(null, { rtWellKnownName: 'X' }).rtWellKnownName).toBe('X');
  });

  it('re-keys to field keys (any casing), drops secrets and wraps bare reference rtIds', () => {
    expect(canonicaliseEntityFormPrefill(MODEL, { DisplayName: 'Ann', EMAIL: 'a@b.c', apikey: 'nope', owner: 'u1', other: 1 })).toEqual({
      displayName: 'Ann',
      email: 'a@b.c',
      owner: [{ rtId: 'u1', ckTypeId: 'System.Identity/User', displayName: 'u1' }],
      other: 1,
    });
  });

  it('merges host values over a state (host wins) and keeps the state without values', () => {
    const state = { values: { email: 'old', displayName: 'Keep' }, secretPresence: {}, associations: {}, rtWellKnownName: 'W' };
    expect(mergeEntityFormPrefill(state, {})).toBe(state);
    expect(mergeEntityFormPrefill(null, null)).toBeNull();
    expect(mergeEntityFormPrefill(state, { email: 'new' })).toEqual({
      values: { email: 'new', displayName: 'Keep' }, secretPresence: {}, associations: {}, rtWellKnownName: 'W',
    });
  });
});
