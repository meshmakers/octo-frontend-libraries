import { octoDataIdFromObject } from './octo-graph-ql-service-base';

describe('octoDataIdFromObject (Apollo cache key)', () => {
  it('normalizes ordinary entity-shaped objects by rtId', () => {
    expect(octoDataIdFromObject({ __typename: 'RtSimpleQueryRow', rtId: 'abc123' })).toBe('abc123');
  });

  it('returns undefined when there is no rtId', () => {
    expect(octoDataIdFromObject({ __typename: 'RtAggregationQueryRow' })).toBeUndefined();
  });

  it('does NOT normalize stream-data rows (rtId is the shared source-entity id, not row-unique)', () => {
    // Two samples of the same EnergyMeasurement entity at different timestamps
    // share the same rtId. Normalizing by rtId would collapse the series.
    const sampleA = { __typename: 'StreamDataQueryRow', rtId: 'entity-1', timestamp: '2026-01-01T00:00:00Z' };
    const sampleB = { __typename: 'StreamDataQueryRow', rtId: 'entity-1', timestamp: '2026-01-01T00:15:00Z' };

    expect(octoDataIdFromObject(sampleA)).toBeUndefined();
    expect(octoDataIdFromObject(sampleB)).toBeUndefined();
  });
});
