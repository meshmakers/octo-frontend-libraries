/**
 * Persistent-query family classification.
 *
 * The query builder persists both runtime-data and stream-data queries as
 * `systemPersistentQuery` entities. They are distinguished by the
 * `queryCkTypeId` field, which carries a substring matching one of the
 * known kinds below.
 *
 * Ordering matters: `GroupingAggregationSdQuery` contains `AggregationSdQuery`
 * as a substring, so the grouping variant must be tested first.
 */

export type QueryFamily = 'runtime' | 'streamData';

export type QueryKind =
  | 'simple'
  | 'aggregation'
  | 'groupingAggregation'
  | 'downsampling';

export interface QueryClassification {
  family: QueryFamily;
  kind: QueryKind;
}

const STREAM_DATA_RULES: readonly { marker: string; kind: QueryKind }[] = [
  { marker: 'DownsamplingSdQuery', kind: 'downsampling' },
  { marker: 'GroupingAggregationSdQuery', kind: 'groupingAggregation' },
  { marker: 'AggregationSdQuery', kind: 'aggregation' },
  { marker: 'SimpleSdQuery', kind: 'simple' }
];

const RUNTIME_RULES: readonly { marker: string; kind: QueryKind }[] = [
  { marker: 'GroupingAggregationRtQuery', kind: 'groupingAggregation' },
  { marker: 'AggregationRtQuery', kind: 'aggregation' },
  { marker: 'SimpleRtQuery', kind: 'simple' }
];

/**
 * Classify a persistent query by its `queryCkTypeId`.
 * Returns `null` for unknown / legacy values; callers decide how to handle them.
 */
export function classifyQuery(queryCkTypeId: string | null | undefined): QueryClassification | null {
  if (!queryCkTypeId) {
    return null;
  }

  for (const rule of STREAM_DATA_RULES) {
    if (queryCkTypeId.includes(rule.marker)) {
      return { family: 'streamData', kind: rule.kind };
    }
  }
  for (const rule of RUNTIME_RULES) {
    if (queryCkTypeId.includes(rule.marker)) {
      return { family: 'runtime', kind: rule.kind };
    }
  }
  return null;
}

/**
 * Convenience accessor — returns just the family ('runtime' | 'streamData')
 * or null when the query type is unrecognised.
 */
export function queryFamily(queryCkTypeId: string | null | undefined): QueryFamily | null {
  return classifyQuery(queryCkTypeId)?.family ?? null;
}
