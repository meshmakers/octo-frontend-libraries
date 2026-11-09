import {defer, Observable, of} from 'rxjs';
import {switchMap, take} from 'rxjs/operators';
import {FetchResult} from '../models/fetchResult';

/** Default number of rows one export request asks for (AB#8122). */
export const DEFAULT_EXPORT_PAGE_SIZE = 2000;
/** Default maximum number of rows an Excel export contains (AB#8122). */
export const DEFAULT_EXPORT_ROW_LIMIT = 50000;
/** Default maximum number of rows a PDF export contains; rendering is far heavier than Excel (AB#8122). */
export const DEFAULT_PDF_EXPORT_ROW_LIMIT = 5000;

/** Rows fetched so far by a running export, and the total the data source reported. */
export interface ExportFetchProgress {
  fetched: number;
  /** Rows that will be fetched (`min(totalCount, limit)`); `null` until the first response. */
  target: number | null;
  /** Total rows of the current filter as reported by the data source; `null` until the first response. */
  totalCount: number | null;
}

/** Result of {@link fetchAllRowsForExport}. */
export interface ExportFetchResult<T = unknown> {
  rows: T[];
  /** Total rows of the current filter as reported by the data source. */
  totalCount: number;
  /** `true` when the result has more rows than the limit allowed, i.e. the export holds only the first `limit` rows. */
  limited: boolean;
}

/** Fetches one page of the list's current query (filter, search and sort are fixed by the caller). */
export type ExportPageFetcher = (skip: number, take: number) => Observable<FetchResult | null>;

/**
 * Fetches all rows of a list query for an export: page by page, strictly one request after the
 * other (never in parallel), until the data source's `totalCount` or `limit` is reached (AB#8122).
 *
 * - The first response's `totalCount` fixes the number of rows to fetch (`min(totalCount, limit)`).
 * - A data source that ignores `skip`/`take` and returns everything at once (client-side data)
 *   finishes after the first request; surplus rows are cut to the target.
 * - An empty page ends the fetch, so a source whose `totalCount` overstates the data cannot loop.
 * - A failing request fails the whole observable — the caller must not write a partial file.
 *
 * Nothing here touches the grid: the caller passes a fetcher that queries the data source with a
 * copy of the grid state.
 */
export function fetchAllRowsForExport(
  fetchPage: ExportPageFetcher,
  pageSize: number,
  limit: number,
  onProgress?: (progress: ExportFetchProgress) => void
): Observable<ExportFetchResult> {
  return defer(() => {
    const size = Math.max(1, Math.floor(pageSize) || DEFAULT_EXPORT_PAGE_SIZE);
    const max = Math.max(0, Math.floor(limit));
    const rows: unknown[] = [];
    let totalCount: number | null = null;

    const result = (): ExportFetchResult => {
      const total = totalCount ?? rows.length;
      return {rows, totalCount: total, limited: total > rows.length && rows.length >= max};
    };

    const next = (): Observable<ExportFetchResult> => {
      const target = totalCount === null ? max : Math.min(totalCount, max);
      const remaining = target - rows.length;
      if (remaining <= 0) {
        return of(result());
      }
      return fetchPage(rows.length, Math.min(size, remaining)).pipe(
        take(1),
        switchMap((page) => {
          const data = Array.isArray(page?.data) ? (page.data as unknown[]) : [];
          const pageRows = data.filter((row) => row !== null && row !== undefined);
          if (totalCount === null) {
            totalCount = Math.max(0, page?.totalCount ?? pageRows.length);
          }
          const allowed = Math.min(totalCount, max) - rows.length;
          rows.push(...pageRows.slice(0, Math.max(0, allowed)));
          onProgress?.({fetched: rows.length, target: Math.min(totalCount, max), totalCount});
          if (pageRows.length === 0) {
            return of(result());
          }
          return next();
        })
      );
    };

    return next();
  });
}

/** Replaces `{name}` placeholders of a message template with the given values. */
export function formatExportMessage(template: string, values: Record<string, number | string>): string {
  return Object.keys(values).reduce(
    (text, key) => text.split(`{${key}}`).join(String(values[key])),
    template
  );
}
