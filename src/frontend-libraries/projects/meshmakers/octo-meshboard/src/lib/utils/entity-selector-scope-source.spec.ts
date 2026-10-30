import { Subject, firstValueFrom, of } from 'rxjs';
import type { EntitySelectorConfig, EntitySelectorScopeHop } from '../models/meshboard.models';
import type { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';
import {
  deferredPickerQuery,
  dependentsOf,
  leaderDisplayName,
  pickerScopeEmptyMessage,
  pickerScopeFailedMessage,
  pickerScopeView,
  resolveScopeSource,
  withoutListing
} from './entity-selector-scope-source';
import { BUILDING, ROOM, SITE, TO_BUILDING, TO_ROOM, TO_STOREY } from '../testing/entity-selector-scope-source.fixtures';

/**
 * Pure helpers of dependent selectors (AB#7915). Neutral fixtures only
 * (Test/Site → Test/Building → Test/Storey → Test/Room).
 */
describe('entity-selector-scope-source (AB#7915)', () => {
  function dependent(scopeSource: EntitySelectorConfig['scopeSource'], extra: Partial<EntitySelectorConfig> = {}): EntitySelectorConfig {
    return { ...ROOM, scopeSource, ...extra };
  }

  describe('resolveScopeSource', () => {
    it('is none for a selector without scope source', () => {
      expect(resolveScopeSource([SITE], SITE)).toEqual({ kind: 'none' });
    });

    it('resolves the leader and the normalized hops of a three-hop path', () => {
      const result = resolveScopeSource([SITE, ROOM], ROOM);
      expect(result).toEqual({ kind: 'source', leader: SITE, hops: [TO_BUILDING, TO_STOREY, TO_ROOM] });
    });

    it('resolves a one-hop path the same way and defaults the direction to in', () => {
      const oneHop = dependent({ selectorId: 'site', path: [{ roleId: 'System/ParentChild', targetCkTypeId: 'Test/Room' }] });
      expect(resolveScopeSource([SITE, oneHop], oneHop)).toEqual({
        kind: 'source',
        leader: SITE,
        hops: [{ roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Room' }]
      });
    });

    it.each([
      ['unknown leader', [SITE], dependent({ selectorId: 'nope', path: [TO_ROOM] }), 'unknown'],
      ['missing leader id', [SITE], dependent({ selectorId: '', path: [TO_ROOM] }), 'unknown'],
      ['the selector itself', [SITE], dependent({ selectorId: 'room', path: [TO_ROOM] }), 'self'],
      ['a follower as leader', [{ ...SITE, followsSelectorId: 'other' }, { ...SITE, id: 'other' }], dependent({ selectorId: 'site', path: [TO_ROOM] }), 'leaderFollower'],
      ['a dependent as leader (chain)', [{ ...SITE, scopeSource: { selectorId: 'other', path: [TO_BUILDING] } }, { ...SITE, id: 'other' }], dependent({ selectorId: 'site', path: [TO_ROOM] }), 'leaderDependent'],
      ['a follower with scope source', [SITE], dependent({ selectorId: 'site', path: [TO_ROOM] }, { followsSelectorId: 'site' }), 'follower'],
      ['an empty path', [SITE], dependent({ selectorId: 'site', path: [] }), 'path'],
      ['more than 5 hops', [SITE], dependent({ selectorId: 'site', path: [TO_BUILDING, TO_STOREY, TO_ROOM, TO_ROOM, TO_ROOM, TO_ROOM] }), 'path'],
      ['a hop without role', [SITE], dependent({ selectorId: 'site', path: [{ roleId: '', targetCkTypeId: 'Test/Room' } as EntitySelectorScopeHop] }), 'path'],
      ['a hop without target type', [SITE], dependent({ selectorId: 'site', path: [{ roleId: 'System/ParentChild', targetCkTypeId: ' ' }] }), 'path']
    ])('is invalid for %s', (_name, others, selector, problem) => {
      const result = resolveScopeSource([...others as EntitySelectorConfig[], selector], selector);
      expect(result.kind).toBe('invalid');
      expect(result.kind === 'invalid' && result.problem).toBe(problem);
    });
  });

  describe('dependentsOf', () => {
    it('lists the valid dependents of a leader only', () => {
      const broken = dependent({ selectorId: 'site', path: [] }, { id: 'broken' });
      const other = dependent({ selectorId: 'elsewhere', path: [TO_ROOM] }, { id: 'other' });
      expect(dependentsOf([SITE, ROOM, BUILDING, broken, other], 'site').map(s => s.id)).toEqual(['room', 'building']);
    });
  });

  describe('pickerScopeView', () => {
    const selectors = [SITE, ROOM];

    it('is unscoped without scope source or without leader pick', () => {
      expect(pickerScopeView(selectors, SITE, undefined)).toEqual({ kind: 'unscoped' });
      expect(pickerScopeView(selectors, ROOM, undefined)).toEqual({ kind: 'unscoped' });
    });

    it('maps the stored picker scope', () => {
      expect(pickerScopeView(selectors, ROOM, { status: 'pending' })).toEqual({ kind: 'pending' });
      expect(pickerScopeView(selectors, ROOM, { status: 'resolved', rtIds: ['room-1'] })).toEqual({ kind: 'scoped', rtIds: ['room-1'] });
      expect(pickerScopeView(selectors, ROOM, { status: 'resolved', rtIds: [] })).toEqual({ kind: 'empty' });
      expect(pickerScopeView(selectors, ROOM, { status: 'failed' })).toEqual({ kind: 'failed' });
    });

    it('is failed for an invalid scope source even without leader pick — never unscoped', () => {
      const invalid = dependent({ selectorId: 'nope', path: [TO_ROOM] });
      expect(pickerScopeView([SITE, invalid], invalid, undefined)).toEqual({ kind: 'failed' });
    });

    it('is unscoped for a follower (it has no picker and ignores the scope source)', () => {
      const follower = dependent({ selectorId: 'site', path: [TO_ROOM] }, { followsSelectorId: 'site' });
      expect(pickerScopeView([SITE, follower], follower, { status: 'failed' })).toEqual({ kind: 'unscoped' });
    });
  });

  describe('texts', () => {
    it('names the leader by its pick, else its label, else its id', () => {
      expect(leaderDisplayName([{ ...SITE, selectedDisplayName: 'North Campus' }, ROOM], ROOM)).toBe('North Campus');
      expect(leaderDisplayName([SITE, ROOM], ROOM)).toBe('Site');
      expect(leaderDisplayName([ROOM], ROOM)).toBe('site');
    });

    it('uses the agreed wording', () => {
      expect(pickerScopeEmptyMessage('Room', 'North Campus')).toBe('No Room in North Campus.');
      expect(pickerScopeFailedMessage('Room', 'North Campus')).toBe('Could not load the Room of North Campus.');
    });
  });

  describe('query wrappers', () => {
    const result = { data: { runtime: { runtimeEntities: { totalCount: 1, items: [{ rtId: 'room-1' }] } } } };

    function gqlMock(): { gql: GetEntitiesByCkTypeDtoGQL; fetch: ReturnType<typeof vi.fn> } {
      const fetch = vi.fn().mockReturnValue(of(result));
      return { gql: { fetch } as unknown as GetEntitiesByCkTypeDtoGQL, fetch };
    }

    it('withoutListing lists nothing and sends no request', async () => {
      const { gql, fetch } = gqlMock();
      const value = await firstValueFrom(withoutListing(gql).fetch({ variables: { ckTypeId: 'Test/Room', attributeNames: [] } }));
      expect(value.data?.runtime?.runtimeEntities?.items).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('deferredPickerQuery waits until the scope settled, then sends the settled query', () => {
      const { gql, fetch } = gqlMock();
      const settled$ = new Subject<GetEntitiesByCkTypeDtoGQL | null>();
      const values: unknown[] = [];

      deferredPickerQuery(gql, settled$).fetch({ variables: { ckTypeId: 'Test/Room', attributeNames: [] } })
        .subscribe(v => values.push(v));
      expect(fetch).not.toHaveBeenCalled();
      expect(values).toEqual([]);

      settled$.next(gql);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(values).toEqual([result]);
    });

    it('deferredPickerQuery lists nothing when the scope settles empty or failed', () => {
      const { gql, fetch } = gqlMock();
      const settled$ = new Subject<GetEntitiesByCkTypeDtoGQL | null>();
      const values: { data?: { runtime?: { runtimeEntities?: { items?: unknown[] } } } }[] = [];

      deferredPickerQuery(gql, settled$).fetch({ variables: { ckTypeId: 'Test/Room', attributeNames: [] } })
        .subscribe(v => values.push(v as never));
      settled$.next(null);

      expect(fetch).not.toHaveBeenCalled();
      expect(values[0].data?.runtime?.runtimeEntities?.items).toEqual([]);
    });
  });
});
