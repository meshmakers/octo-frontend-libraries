import { fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject, NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { PaletteGroup, PaletteProvider, PaletteQuery, PaletteResult } from './command-palette.models';
import { parsePaletteQuery } from './palette-query';
import { searchProviders } from './palette-search';

function row(id: string, group: PaletteGroup = 'page'): PaletteResult {
  return { id, group, label: id, run: () => Promise.resolve() };
}

function provider(id: string, groups: PaletteGroup[], search: (q: PaletteQuery) => Observable<PaletteResult[]>, debounceMs?: number): PaletteProvider {
  return { id, groups, debounceMs, search: vi.fn(search) };
}

describe('searchProviders', () => {
  it('merges the rows of all providers and emits local rows at once', () => {
    const query$ = new BehaviorSubject(parsePaletteQuery('a'));
    const emitted: string[][] = [];
    searchProviders([
      provider('one', ['page'], () => of([row('p1')])),
      provider('two', ['action'], () => of([row('a1', 'action')]))
    ], query$).subscribe(rows => emitted.push(rows.map(r => r.id)));
    expect(emitted[emitted.length - 1]).toEqual(['p1', 'a1']);
  });

  it('skips providers outside the scope of a prefixed query', () => {
    const pages = provider('pages', ['page'], () => of([row('p1')]));
    const tenants = provider('tenants', ['tenant'], () => of([row('t1', 'tenant')]));
    let last: string[] = [];
    searchProviders([pages, tenants], new BehaviorSubject(parsePaletteQuery('/mesh'))).subscribe(rows => last = rows.map(r => r.id));
    expect(last).toEqual(['t1']);
    expect(pages.search).not.toHaveBeenCalled();
  });

  it('debounces remote providers and cancels a running search on a new query', fakeAsync(() => {
    const query$ = new BehaviorSubject(parsePaletteQuery('ed'));
    const responses = new Map<string, Subject<PaletteResult[]>>();
    const remote = provider('remote', ['entity'], q => {
      const subject = new Subject<PaletteResult[]>();
      responses.set(q.text, subject);
      return subject;
    }, 150);
    let last: string[] = [];
    searchProviders([remote], query$).subscribe(rows => last = rows.map(r => r.id));

    tick(100);
    expect(remote.search).not.toHaveBeenCalled();
    tick(50);
    expect(remote.search).toHaveBeenCalledTimes(1);

    query$.next(parsePaletteQuery('edge'));
    // The old request is unsubscribed: its late answer is ignored.
    responses.get('ed')?.next([row('stale', 'entity')]);
    expect(last).toEqual([]);
    tick(150);
    responses.get('edge')?.next([row('fresh', 'entity')]);
    expect(last).toEqual(['fresh']);
  }));

  it('keeps previous remote rows while the next search is debounced', fakeAsync(() => {
    const query$ = new BehaviorSubject(parsePaletteQuery('ed'));
    const remote = provider('remote', ['entity'], q => of([row(q.text, 'entity')]), 150);
    let last: string[] = [];
    searchProviders([remote], query$).subscribe(rows => last = rows.map(r => r.id));
    tick(150);
    expect(last).toEqual(['ed']);
    query$.next(parsePaletteQuery('edg'));
    tick(50);
    expect(last).toEqual(['ed']);
    tick(100);
    expect(last).toEqual(['edg']);
  }));

  it('drops only the failing provider', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let last: string[] = [];
    searchProviders([
      provider('broken', ['entity'], () => throwError(() => new Error('boom'))),
      provider('fine', ['page'], () => of([row('p1')])),
      provider('slow', ['board'], () => NEVER)
    ], new BehaviorSubject(parsePaletteQuery('x'))).subscribe(rows => last = rows.map(r => r.id));
    expect(last).toEqual(['p1']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('emits empty lists without providers', () => {
    let last: PaletteResult[] | null = null;
    searchProviders([], of(parsePaletteQuery('x'))).subscribe(rows => last = rows);
    expect(last).toEqual([]);
  });
});
