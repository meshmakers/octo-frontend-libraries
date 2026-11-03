import type { QueryResultRow } from '../services/query-executor.service';
import type { QueryColumnItem } from './runtime-entity-data-sources';

/**
 * Row fields of stream-data rows (AB#8069). A stream-data row carries its time stamp and its source
 * entity as row properties (`timestamp`, `rtId`), not as cells, so the column list of a stream-data
 * query does not contain them — the line chart's Field Mapping then offered neither a time field
 * nor a grouping field and a new chart could not be completed in the dialog.
 */

/** Time stamp of a stream-data row (bucket start in downsampling). */
export const STREAM_DATA_TIMESTAMP_FIELD = 'timestamp';

/** Source entity of a stream-data row: one series per source entity. */
export const STREAM_DATA_RTID_FIELD = 'rtId';

/**
 * The columns of a stream-data query plus the row fields `timestamp` (DATE_TIME) and `rtId` (STRING)
 * in front, unless the query already has a column of that name (case-insensitive).
 */
export function withStreamDataRowFields(columns: readonly QueryColumnItem[]): QueryColumnItem[] {
  const has = (name: string): boolean => columns.some(c => c.attributePath.toLowerCase() === name.toLowerCase());
  return [
    ...(has(STREAM_DATA_TIMESTAMP_FIELD) ? [] : [{ attributePath: STREAM_DATA_TIMESTAMP_FIELD, attributeValueType: 'DATE_TIME', aggregationType: null }]),
    ...(has(STREAM_DATA_RTID_FIELD) ? [] : [{ attributePath: STREAM_DATA_RTID_FIELD, attributeValueType: 'STRING', aggregationType: null }]),
    ...columns
  ];
}

/**
 * Value of a row field when `field` names one (`timestamp` / `rtId`, case-insensitive) and the row has
 * it, else `undefined`. Used as a fallback when no cell of that name exists.
 */
export function streamDataRowFieldValue(row: QueryResultRow, field: string | undefined): unknown {
  const name = field?.toLowerCase();
  if (name === STREAM_DATA_TIMESTAMP_FIELD) return row.timestamp ?? undefined;
  if (name === STREAM_DATA_RTID_FIELD.toLowerCase()) return row.rtId ?? undefined;
  return undefined;
}
