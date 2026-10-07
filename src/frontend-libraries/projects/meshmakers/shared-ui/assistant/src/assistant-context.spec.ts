import { ActivatedRouteSnapshot } from '@angular/router';
import { deriveAssistantContext } from './assistant-context';

/** A primary-child chain of route snapshots with the given params per level. */
function chain(...levels: Record<string, string>[]): ActivatedRouteSnapshot {
  let child: ActivatedRouteSnapshot | null = null;
  for (const params of [...levels].reverse()) {
    child = { params, firstChild: child } as unknown as ActivatedRouteSnapshot;
  }
  return child as ActivatedRouteSnapshot;
}

describe('deriveAssistantContext', () => {
  it('derives tenant and "Area › Tab" page chips', () => {
    const chips = deriveAssistantContext({
      root: chain({}, { tenantId: 'meshmakers' }, {}),
      url: '/meshmakers/communication/adapters?x=1',
      breadcrumbs: ['Adapters'],
      areaText: 'Integration',
      tabText: 'Adapters'
    });
    expect(chips).toEqual([
      { id: 'tenant:meshmakers', kind: 'tenant', label: 'Tenant: meshmakers', value: 'meshmakers' },
      { id: 'page:/meshmakers/communication/adapters', kind: 'page', label: 'Page: Integration › Adapters', value: '/meshmakers/communication/adapters' }
    ]);
  });

  it('falls back to the area, then the first breadcrumb, for the page label', () => {
    const base = { root: chain({ tenantId: 't' }), url: '/t/x', breadcrumbs: ['Crumb'] };
    expect(deriveAssistantContext({ ...base, areaText: 'Data' })[1].label).toBe('Page: Data');
    expect(deriveAssistantContext({ ...base, areaText: 'Data', tabText: 'Data' })[1].label).toBe('Page: Data');
    expect(deriveAssistantContext(base)[1].label).toBe('Page: Crumb');
  });

  it('takes the deepest id-like route param as entity, labelled with the last breadcrumb', () => {
    const chips = deriveAssistantContext({
      root: chain({ tenantId: 'meshmakers' }, { adapterId: '670000000000000000000002' }),
      url: '/meshmakers/communication/adapters/details/670000000000000000000002',
      breadcrumbs: ['Adapters', 'mesh-adapter'],
      areaText: 'Integration',
      tabText: 'Adapters'
    });
    expect(chips[2]).toEqual({ id: 'entity:670000000000000000000002', kind: 'entity', label: 'mesh-adapter', value: '670000000000000000000002' });
  });

  it('labels the entity with its id when there is no breadcrumb for it', () => {
    const chips = deriveAssistantContext({ root: chain({ tenantId: 't', rtId: 'abc' }), url: '/t/boards/abc', breadcrumbs: ['Boards'] });
    expect(chips.find(chip => chip.kind === 'entity')?.label).toBe('abc');
  });

  it('prefers an explicit Explain target over the route', () => {
    const chips = deriveAssistantContext({
      root: chain({ tenantId: 't', rtId: 'abc' }),
      url: '/t/x/abc',
      breadcrumbs: ['X', 'abc'],
      explicitEntity: { label: 'System.Communication/Adapter', ckTypeId: 'System.Communication/Adapter' }
    });
    expect(chips.filter(chip => chip.kind === 'entity')).toEqual([{
      id: 'entity:System.Communication/Adapter', kind: 'entity', label: 'System.Communication/Adapter',
      value: 'System.Communication/Adapter', ckTypeId: 'System.Communication/Adapter'
    }]);
  });

  it('yields nothing outside a tenant and without a route', () => {
    expect(deriveAssistantContext({ root: null, url: '', breadcrumbs: [] })).toEqual([]);
  });
});
