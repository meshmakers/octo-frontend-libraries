import { classifyQuery, queryFamily } from './query-family';

describe('query-family classification', () => {
  describe('runtime queries', () => {
    it('classifies SimpleRtQuery', () => {
      expect(classifyQuery('System.Query/SimpleRtQuery')).toEqual({ family: 'runtime', kind: 'simple' });
    });

    it('classifies AggregationRtQuery', () => {
      expect(classifyQuery('System.Query/AggregationRtQuery')).toEqual({ family: 'runtime', kind: 'aggregation' });
    });

    it('classifies GroupingAggregationRtQuery before AggregationRtQuery (ordering trap)', () => {
      expect(classifyQuery('System.Query/GroupingAggregationRtQuery'))
        .toEqual({ family: 'runtime', kind: 'groupingAggregation' });
    });
  });

  describe('stream-data queries', () => {
    it('classifies SimpleSdQuery', () => {
      expect(classifyQuery('System.Query/SimpleSdQuery')).toEqual({ family: 'streamData', kind: 'simple' });
    });

    it('classifies AggregationSdQuery', () => {
      expect(classifyQuery('System.Query/AggregationSdQuery')).toEqual({ family: 'streamData', kind: 'aggregation' });
    });

    it('classifies GroupingAggregationSdQuery before AggregationSdQuery (ordering trap)', () => {
      expect(classifyQuery('System.Query/GroupingAggregationSdQuery'))
        .toEqual({ family: 'streamData', kind: 'groupingAggregation' });
    });

    it('classifies DownsamplingSdQuery', () => {
      expect(classifyQuery('System.Query/DownsamplingSdQuery'))
        .toEqual({ family: 'streamData', kind: 'downsampling' });
    });
  });

  describe('edge cases', () => {
    it('returns null for null input', () => {
      expect(classifyQuery(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(classifyQuery(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(classifyQuery('')).toBeNull();
    });

    it('returns null for unknown legacy query types', () => {
      expect(classifyQuery('System.Query/SomeLegacyQuery')).toBeNull();
    });
  });

  describe('queryFamily convenience accessor', () => {
    it('returns runtime for RT query types', () => {
      expect(queryFamily('System.Query/SimpleRtQuery')).toBe('runtime');
    });

    it('returns streamData for SD query types', () => {
      expect(queryFamily('System.Query/SimpleSdQuery')).toBe('streamData');
    });

    it('returns null for unknown', () => {
      expect(queryFamily('foo')).toBeNull();
    });
  });
});
