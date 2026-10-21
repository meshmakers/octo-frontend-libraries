import {
  knownTopology,
  topologyDirectChildren,
  topologyLeaves,
  topologyTenantIds,
  unknownTopology
} from './tenant-topology';

describe('tenant-topology helpers', () => {
  const nodes = [
    { tenantId: 'a', depth: 1, hasChildren: false },
    { tenantId: 'g', depth: 1, hasChildren: true },
    { tenantId: 'b', depth: 2, hasChildren: false }
  ];

  it('knownTopology defaults scopeHasChildren from the nodes and copies them', () => {
    const known = knownTopology('R', nodes);

    expect(known).toEqual({ topologyKnown: true, scope: 'R', scopeHasChildren: true, tenants: nodes });
    expect(known.tenants[0]).not.toBe(nodes[0]);
    expect(knownTopology('R', []).scopeHasChildren).toBe(false);
    expect(knownTopology('R', [], true).scopeHasChildren).toBe(true);
  });

  it('unknownTopology carries the reason, no tenants and scopeHasChildren null', () => {
    expect(unknownTopology('network')).toEqual({
      topologyKnown: false,
      reason: 'network',
      tenants: [],
      scopeHasChildren: null
    });
  });

  it('helpers work on known and unknown results', () => {
    const known = knownTopology('R', nodes);

    expect(topologyLeaves(known).map((n) => n.tenantId)).toEqual(['a', 'b']);
    expect(topologyDirectChildren(known).map((n) => n.tenantId)).toEqual(['a', 'g']);
    expect(topologyTenantIds(known)).toEqual(['a', 'g', 'b']);
    expect(topologyLeaves(unknownTopology('unauthorized'))).toEqual([]);
  });
});
