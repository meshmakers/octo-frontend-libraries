import { of, EMPTY, Subject } from 'rxjs';
import { EntityFormChangeSet, ResolvedEntityForm } from '../models/entity-form.models';
import {
  EntityFormBeforeSaveContext,
  EntityFormSaveVeto,
  isEntityFormSaveVeto,
  runEntityFormBeforeSave,
} from './before-save';

const FORM = { rtCkTypeId: 'Meshmakers.Accounting/Contact' } as ResolvedEntityForm;
const CONTEXT: EntityFormBeforeSaveContext = { mode: 'edit', ckTypeId: 'Meshmakers.Accounting/Contact', rtId: 'r1', form: FORM };

function changeSet(): EntityFormChangeSet {
  return {
    attributes: [{ attributeName: 'email', value: '  Max.Muster@Example.COM ' }, { attributeName: 'iban', value: 'at61 1904 3002 3457 3201' }],
    associations: [{ roleName: 'related', targets: [{ modOption: 'CREATE', target: { ckTypeId: 'X/Y', rtId: 't1' } }] }],
    isEmpty: false,
  };
}

/** Normalises like the contacts page: trims, derives normalizedEmail, compacts the IBAN. */
function normalise(cs: EntityFormChangeSet): EntityFormChangeSet {
  const attributes = cs.attributes.map((a) => ({ ...a, value: typeof a.value === 'string' ? a.value.trim() : a.value }));
  const email = attributes.find((a) => a.attributeName === 'email');
  const iban = attributes.find((a) => a.attributeName === 'iban');
  if (iban && typeof iban.value === 'string') {
    iban.value = iban.value.replace(/\s+/g, '').toUpperCase();
  }
  if (email) {
    attributes.push({ attributeName: 'normalizedEmail', value: String(email.value).toLowerCase() });
  }
  return { ...cs, attributes };
}

describe('runEntityFormBeforeSave (AB#5623)', () => {
  it('saves the original change set when no hook is set', async () => {
    const cs = changeSet();
    expect(await runEntityFormBeforeSave(null, cs, CONTEXT)).toEqual({ kind: 'save', changeSet: cs });
  });

  it('passes the change set and the context and saves a returned change set (sync)', async () => {
    const hook = vi.fn(normalise);
    const outcome = await runEntityFormBeforeSave(hook, changeSet(), CONTEXT);
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({ isEmpty: false }), CONTEXT);
    expect(outcome.kind).toBe('save');
    const saved = (outcome as { changeSet: EntityFormChangeSet }).changeSet;
    expect(saved.attributes).toEqual([
      { attributeName: 'email', value: 'Max.Muster@Example.COM' },
      { attributeName: 'iban', value: 'AT611904300234573201' },
      { attributeName: 'normalizedEmail', value: 'max.muster@example.com' },
    ]);
  });

  it('awaits an async hook that modifies the change set', async () => {
    const outcome = await runEntityFormBeforeSave(async (cs) => {
      await Promise.resolve();
      return normalise(cs);
    }, changeSet(), CONTEXT);
    expect(outcome.kind).toBe('save');
    expect((outcome as { changeSet: EntityFormChangeSet }).changeSet.attributes.map((a) => a.attributeName))
      .toEqual(['email', 'iban', 'normalizedEmail']);
  });

  it('takes the first value of an Observable hook', async () => {
    const outcome = await runEntityFormBeforeSave((cs) => of(normalise(cs), null), changeSet(), CONTEXT);
    expect(outcome.kind).toBe('save');
  });

  it('treats an Observable that completes without a value like "unchanged"', async () => {
    const cs = changeSet();
    const outcome = await runEntityFormBeforeSave(() => EMPTY, cs, CONTEXT);
    expect(outcome).toEqual({ kind: 'save', changeSet: cs });
  });

  it('saves in-place changes when the hook returns nothing, without touching the caller\'s object', async () => {
    const cs = changeSet();
    const outcome = await runEntityFormBeforeSave((draft) => {
      draft.attributes[0].value = 'x@y.at';
    }, cs, CONTEXT);
    expect((outcome as { changeSet: EntityFormChangeSet }).changeSet.attributes[0].value).toBe('x@y.at');
    expect(cs.attributes[0].value).toBe('  Max.Muster@Example.COM ');
  });

  it('recomputes isEmpty of a returned change set', async () => {
    const outcome = await runEntityFormBeforeSave(
      (cs) => ({ ...cs, attributes: [], associations: [], isEmpty: false }), changeSet(), CONTEXT);
    expect((outcome as { changeSet: EntityFormChangeSet }).changeSet.isEmpty).toBe(true);
  });

  it('vetoes silently on null / false', async () => {
    expect(await runEntityFormBeforeSave(() => null, changeSet(), CONTEXT)).toEqual({ kind: 'veto' });
    expect(await runEntityFormBeforeSave(async () => false, changeSet(), CONTEXT)).toEqual({ kind: 'veto' });
  });

  it('vetoes with the user message of a thrown EntityFormSaveVeto (sync and async)', async () => {
    expect(await runEntityFormBeforeSave(() => { throw new EntityFormSaveVeto('E-Mail ungültig'); }, changeSet(), CONTEXT))
      .toEqual({ kind: 'veto', message: 'E-Mail ungültig' });
    expect(await runEntityFormBeforeSave(async () => { throw new EntityFormSaveVeto(); }, changeSet(), CONTEXT))
      .toEqual({ kind: 'veto', message: undefined });
  });

  it('recognises a veto by name (another bundle copy of the class)', () => {
    const foreign = new Error('x');
    foreign.name = 'EntityFormSaveVeto';
    expect(isEntityFormSaveVeto(foreign)).toBe(true);
    expect(isEntityFormSaveVeto(new Error('x'))).toBe(false);
  });

  it('reports any other error (thrown, rejected or from an Observable)', async () => {
    const boom = new Error('lookup failed');
    expect(await runEntityFormBeforeSave(() => { throw boom; }, changeSet(), CONTEXT)).toEqual({ kind: 'error', error: boom });
    expect(await runEntityFormBeforeSave(() => Promise.reject(boom), changeSet(), CONTEXT)).toEqual({ kind: 'error', error: boom });
    const subject = new Subject<EntityFormChangeSet>();
    const pending = runEntityFormBeforeSave(() => subject, changeSet(), CONTEXT);
    subject.error(boom);
    expect(await pending).toEqual({ kind: 'error', error: boom });
  });

  it('reports a result that is neither a change set nor a boolean as an error', async () => {
    const outcome = await runEntityFormBeforeSave(() => ({ foo: 1 }) as unknown as EntityFormChangeSet, changeSet(), CONTEXT);
    expect(outcome.kind).toBe('error');
  });
});
