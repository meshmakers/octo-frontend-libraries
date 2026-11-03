import { MAX_SCOPE_HOPS, type EntitySelectorScopeHop } from '../models/meshboard.models';
import {
  childScopeFromHops,
  distinctRtIds,
  resolveScopePath,
  scopeHopsOf,
  scopeHopsValidationError,
  scopePathLabel,
  scopePlan,
  type NormalizedScopeHop,
  type ScopeHopFetcher
} from './entity-selector-scope-path';

/** Multi-hop child scope helpers (AB#7723). Neutral fixtures only. */
describe('entity-selector-scope-path (AB#7723)', () => {
  const toSystem: EntitySelectorScopeHop = { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/System' };
  const toDevice: EntitySelectorScopeHop = { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Device' };
  const toSensor: EntitySelectorScopeHop = { roleId: 'Test/Measures', direction: 'out', targetCkTypeId: 'Test/Sensor' };

  describe('scopePlan', () => {
    it('has no plan without a child scope', () => {
      expect(scopePlan(undefined)).toEqual({ kind: 'none' });
    });

    it('keeps the one-hop form as a single hop (direction defaults to in)', () => {
      expect(scopePlan({ targetCkTypeId: 'Test/Device', roleId: 'System/ParentChild' }))
        .toEqual({ kind: 'single', hop: { roleId: 'System/ParentChild', direction: 'in', targetCkTypeId: 'Test/Device' } });
    });

    it('treats an incomplete one-hop form as no child scope, as before', () => {
      expect(scopePlan({ roleId: 'System/ParentChild' })).toEqual({ kind: 'none' });
      expect(scopePlan({ targetCkTypeId: 'Test/Device' })).toEqual({ kind: 'none' });
    });

    it('lets a non-empty path win over the top-level fields', () => {
      const plan = scopePlan({ targetCkTypeId: 'Test/Other', roleId: 'Test/Other', path: [toSystem, toDevice] });
      expect(plan).toEqual({ kind: 'path', hops: [toSystem, toDevice] });
    });

    it('falls back to the top-level fields for an empty path', () => {
      expect(scopePlan({ targetCkTypeId: 'Test/Device', roleId: 'System/ParentChild', direction: 'out', path: [] }).kind).toBe('single');
    });

    it('rejects more than the maximum number of hops', () => {
      const plan = scopePlan({ path: Array.from({ length: MAX_SCOPE_HOPS + 1 }, () => toDevice) });
      expect(plan.kind).toBe('invalid');
    });

    it('accepts exactly the maximum number of hops', () => {
      expect(scopePlan({ path: Array.from({ length: MAX_SCOPE_HOPS }, () => toDevice) }).kind).toBe('path');
    });

    it('rejects a hop without role or target type', () => {
      expect(scopePlan({ path: [toSystem, { roleId: ' ', targetCkTypeId: 'Test/Device' }] }))
        .toEqual({ kind: 'invalid', reason: 'hop 2 needs an association role and a target type' });
    });
  });

  describe('editor mapping', () => {
    it('saves no hops as no child scope', () => {
      expect(childScopeFromHops([])).toBeUndefined();
    });

    it('saves one hop in the original top-level form, key order unchanged', () => {
      expect(JSON.stringify(childScopeFromHops([{ ...toDevice, roleId: ' System/ParentChild ' }])))
        .toBe('{"targetCkTypeId":"Test/Device","roleId":"System/ParentChild","direction":"in"}');
    });

    it('saves two or more hops as path only', () => {
      expect(childScopeFromHops([toSystem, toDevice])).toEqual({ path: [toSystem, toDevice] });
    });

    it('shows the one-hop form as one hop and a path as its hops', () => {
      expect(scopeHopsOf({ targetCkTypeId: 'Test/Device', roleId: 'System/ParentChild' })).toEqual([toDevice]);
      expect(scopeHopsOf({ path: [toSystem, { roleId: 'System/ParentChild', targetCkTypeId: 'Test/Device' }] }))
        .toEqual([toSystem, toDevice]);
      expect(scopeHopsOf({ roleId: 'System/ParentChild' })).toEqual([]);
      expect(scopeHopsOf(undefined)).toEqual([]);
    });

    it('round-trips a path through editor hops', () => {
      const scope = { path: [toSystem, toDevice, toSensor] };
      expect(childScopeFromHops(scopeHopsOf(scope))).toEqual(scope);
    });

    it('validates hop lists', () => {
      expect(scopeHopsValidationError([])).toBeNull();
      expect(scopeHopsValidationError([toSystem, toDevice])).toBeNull();
      expect(scopeHopsValidationError([toSystem, { roleId: 'System/ParentChild', targetCkTypeId: '' }]))
        .toBe('Hop 2 needs an association and a target type.');
      expect(scopeHopsValidationError(Array.from({ length: MAX_SCOPE_HOPS + 1 }, () => toDevice)))
        .toBe(`At most ${MAX_SCOPE_HOPS} hops.`);
    });

    it('labels the path', () => {
      expect(scopePathLabel('Test/Site', [toSystem, { roleId: 'x', targetCkTypeId: '' }])).toBe('Test/Site → Test/System → ?');
    });
  });

  describe('resolveScopePath', () => {
    /** sourceRtId → targets, per target type. */
    const graph: Record<string, Record<string, string[]>> = {
      'Test/System': { 'site-1': ['sys-1', 'sys-2'], 'site-2': [] },
      'Test/Device': { 'sys-1': ['dev-1', 'dev-2'], 'sys-2': ['dev-2', 'dev-3'] },
      'Test/Sensor': { 'dev-1': ['sen-1'], 'dev-2': ['sen-1'], 'dev-3': ['sen-3'] }
    };
    const fetchHop = vi.fn<ScopeHopFetcher>((sources, _source, hop) =>
      Promise.resolve(sources.flatMap(s => graph[hop.targetCkTypeId]?.[s] ?? [])));
    const hops = (...h: EntitySelectorScopeHop[]): NormalizedScopeHop[] =>
      h.map(x => ({ roleId: x.roleId, direction: x.direction ?? 'in', targetCkTypeId: x.targetCkTypeId }));

    beforeEach(() => {
      fetchHop.mockClear();
    });

    it('returns the distinct rtIds of the last hop, one batched call per hop', async () => {
      expect(await resolveScopePath('site-1', 'Test/Site', hops(toSystem, toDevice), fetchHop)).toEqual(['dev-1', 'dev-2', 'dev-3']);
      expect(fetchHop.mock.calls.map(c => [c[0], c[1]])).toEqual([
        [['site-1'], 'Test/Site'],
        [['sys-1', 'sys-2'], 'Test/System']
      ]);
    });

    it('feeds the de-duplicated targets of a hop into the next one', async () => {
      expect(await resolveScopePath('site-1', 'Test/Site', hops(toSystem, toDevice, toSensor), fetchHop)).toEqual(['sen-1', 'sen-3']);
      expect(fetchHop.mock.calls[2][0]).toEqual(['dev-1', 'dev-2', 'dev-3']);
      expect(fetchHop.mock.calls[2][1]).toBe('Test/Device');
    });

    it('stops at an empty hop with an empty scope', async () => {
      expect(await resolveScopePath('site-2', 'Test/Site', hops(toSystem, toDevice), fetchHop)).toEqual([]);
      expect(fetchHop).toHaveBeenCalledTimes(1);
    });

    it('rejects when a hop fails', async () => {
      fetchHop.mockRejectedValueOnce(new Error('hop failed'));
      await expect(resolveScopePath('site-1', 'Test/Site', hops(toSystem, toDevice), fetchHop)).rejects.toThrow(/^hop failed$/);
    });

    it('returns null and requests no further hop once the resolution is stale', async () => {
      let current = true;
      fetchHop.mockImplementationOnce(() => {
        current = false;
        return Promise.resolve(['sys-1']);
      });
      expect(await resolveScopePath('site-1', 'Test/Site', hops(toSystem, toDevice), fetchHop, () => current)).toBeNull();
      expect(fetchHop).toHaveBeenCalledTimes(1);
    });
  });

  it('de-duplicates rtIds and drops empty ones', () => {
    expect(distinctRtIds(['a', 'b', 'a', '', null, undefined, 'c'])).toEqual(['a', 'b', 'c']);
  });
});
