import { combineLatest, defer, Observable, of, timer } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { PaletteProvider, PaletteQuery, PaletteResult } from './command-palette.models';

/**
 * Runs every provider for every query and merges their rows.
 *
 * - A provider whose groups do not include the query's scope is skipped (its rows clear at once).
 * - A new query cancels the provider's running search (`switchMap` unsubscribes).
 * - Providers with `debounceMs` start only after the query stood still that long; until
 *   then their previous rows stay, so remote results do not flicker away while typing
 *   (the ranking drops rows that no longer match).
 * - An error drops only that provider's rows.
 *
 * The output emits on every provider answer, so local rows show immediately
 * and remote rows stream in.
 */
export function searchProviders(
  providers: readonly PaletteProvider[],
  query$: Observable<PaletteQuery>
): Observable<PaletteResult[]> {
  if (providers.length === 0) {
    return query$.pipe(map(() => []));
  }
  const streams = providers.map(provider => query$.pipe(
    switchMap(query => {
      if (query.scope && !provider.groups.includes(query.scope)) {
        return of<PaletteResult[]>([]);
      }
      const search$ = defer(() => provider.search(query)).pipe(
        catchError(error => {
          console.warn(`Command palette provider '${provider.id}' failed:`, error);
          return of<PaletteResult[]>([]);
        })
      );
      return provider.debounceMs ? timer(provider.debounceMs).pipe(switchMap(() => search$)) : search$;
    }),
    startWith<PaletteResult[]>([])
  ));
  return combineLatest(streams).pipe(map(lists => lists.flat()));
}
