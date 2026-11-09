import { Observable, of, Subject, throwError } from 'rxjs';

import { ExportFetchProgress, ExportFetchResult, fetchAllRowsForExport, formatExportMessage } from './list-view-export';
import { FetchResult, FetchResultBase } from '../models/fetchResult';

/** A server-paged source of `total` rows named `row-<index>`. */
function pagedSource(total: number) {
  const calls: { skip: number; take: number }[] = [];
  const fetchPage = (skip: number, take: number): Observable<FetchResult | null> => {
    calls.push({ skip, take });
    const count = Math.max(0, Math.min(take, total - skip));
    const rows = Array.from({ length: count }, (_, i) => ({ name: `row-${skip + i}` }));
    return of(new FetchResultBase(rows, total));
  };
  return { calls, fetchPage };
}

function run(observable: Observable<ExportFetchResult>): { result?: ExportFetchResult; error?: unknown } {
  const outcome: { result?: ExportFetchResult; error?: unknown } = {};
  observable.subscribe({ next: (r) => (outcome.result = r), error: (e) => (outcome.error = e) });
  return outcome;
}

describe('fetchAllRowsForExport (AB#8122)', () => {
  it('fetches all rows of a multi-page result in pages of the configured size', () => {
    const source = pagedSource(4500);
    const { result } = run(fetchAllRowsForExport(source.fetchPage, 2000, 50000));

    expect(source.calls).toEqual([
      { skip: 0, take: 2000 },
      { skip: 2000, take: 2000 },
      { skip: 4000, take: 500 }
    ]);
    expect(result?.rows.length).toBe(4500);
    expect((result?.rows[4499] as { name: string }).name).toBe('row-4499');
    expect(result?.totalCount).toBe(4500);
    expect(result?.limited).toBe(false);
  });

  it('fetches one year of one register (35,040 quarter-hours) in 18 requests with the defaults', () => {
    const source = pagedSource(35040);
    const { result } = run(fetchAllRowsForExport(source.fetchPage, 2000, 50000));

    expect(source.calls.length).toBe(18);
    expect(result?.rows.length).toBe(35040);
    expect(result?.limited).toBe(false);
  });

  it('requests the next page only after the previous one answered (sequential, never parallel)', () => {
    const pending: Subject<FetchResult>[] = [];
    const fetchPage = (): Observable<FetchResult> => {
      const subject = new Subject<FetchResult>();
      pending.push(subject);
      return subject;
    };
    const outcome = run(fetchAllRowsForExport(fetchPage, 10, 100));

    expect(pending.length).toBe(1);
    pending[0].next(new FetchResultBase(Array.from({ length: 10 }, (_, i) => ({ i })), 25));
    expect(pending.length).toBe(2);
    pending[1].next(new FetchResultBase(Array.from({ length: 10 }, (_, i) => ({ i })), 25));
    expect(pending.length).toBe(3);
    pending[2].next(new FetchResultBase(Array.from({ length: 5 }, (_, i) => ({ i })), 25));
    expect(outcome.result?.rows.length).toBe(25);
  });

  it('stops at the row limit and reports the cut', () => {
    const source = pagedSource(120000);
    const { result } = run(fetchAllRowsForExport(source.fetchPage, 2000, 50000));

    expect(result?.rows.length).toBe(50000);
    expect(result?.totalCount).toBe(120000);
    expect(result?.limited).toBe(true);
    expect(source.calls.length).toBe(25);
    expect(source.calls[source.calls.length - 1]).toEqual({ skip: 48000, take: 2000 });
  });

  it('asks only for the remaining rows when the limit is not a multiple of the page size', () => {
    const source = pagedSource(10000);
    const { result } = run(fetchAllRowsForExport(source.fetchPage, 2000, 4500));

    expect(source.calls.map((c) => c.take)).toEqual([2000, 2000, 500]);
    expect(result?.rows.length).toBe(4500);
    expect(result?.limited).toBe(true);
  });

  it('fails without a result when a page fails, so no partial file is written', () => {
    let call = 0;
    const fetchPage = (skip: number, take: number): Observable<FetchResult> => {
      call++;
      return call === 2
        ? throwError(() => new Error('network down'))
        : of(new FetchResultBase(Array.from({ length: take }, (_, i) => ({ i: skip + i })), 5000));
    };
    const outcome = run(fetchAllRowsForExport(fetchPage, 2000, 50000));

    expect(outcome.result).toBeUndefined();
    expect((outcome.error as Error).message).toBe('network down');
    expect(call).toBe(2);
  });

  it('finishes after one request when the source returns all rows at once (client-side data)', () => {
    const all = Array.from({ length: 120 }, (_, i) => ({ i }));
    const fetchPage = vi.fn(() => of(new FetchResultBase(all, 120)));
    const { result } = run(fetchAllRowsForExport(fetchPage, 50, 50000));

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result?.rows.length).toBe(120);
    expect(result?.limited).toBe(false);
  });

  it('ends on an empty page instead of looping when totalCount overstates the data', () => {
    const fetchPage = vi.fn((skip: number) =>
      of(new FetchResultBase(skip === 0 ? [{ i: 0 }, { i: 1 }] : [], 1000)));
    const { result } = run(fetchAllRowsForExport(fetchPage, 2, 50000));

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result?.rows.length).toBe(2);
  });

  it('skips null rows but counts them for the next offset, and reports progress after every page', () => {
    const progress: ExportFetchProgress[] = [];
    const server = [{ i: 0 }, null, { i: 1 }, { i: 2 }, null, { i: 3 }];
    const skips: number[] = [];
    const fetchPage = (skip: number, take: number): Observable<FetchResult> => {
      skips.push(skip);
      return of(new FetchResultBase(server.slice(skip, skip + take), server.length));
    };
    const { result } = run(fetchAllRowsForExport(fetchPage, 3, 100, (p) => progress.push(p)));

    expect(skips).toEqual([0, 3]);
    expect(result?.rows).toEqual([{ i: 0 }, { i: 1 }, { i: 2 }, { i: 3 }]);
    expect(progress).toEqual([
      { fetched: 3, target: 6, totalCount: 6 },
      { fetched: 6, target: 6, totalCount: 6 }
    ]);
  });

  it('goes on after a page that holds only null rows', () => {
    const server = [null, null, { i: 2 }, { i: 3 }];
    const fetchPage = (skip: number, take: number): Observable<FetchResult> =>
      of(new FetchResultBase(server.slice(skip, skip + take), server.length));
    const { result } = run(fetchAllRowsForExport(fetchPage, 2, 100));

    expect(result?.rows).toEqual([{ i: 2 }, { i: 3 }]);
  });

  it('returns an empty result without a second request for an empty list', () => {
    const source = pagedSource(0);
    const { result } = run(fetchAllRowsForExport(source.fetchPage, 2000, 50000));

    expect(source.calls.length).toBe(1);
    expect(result).toEqual({ rows: [], totalCount: 0, limited: false });
  });
});

describe('formatExportMessage', () => {
  it('replaces every placeholder', () => {
    expect(formatExportMessage('Export limited to {limit} of {total} rows.', { limit: 50000, total: 120000 }))
      .toBe('Export limited to 50000 of 120000 rows.');
  });
});
