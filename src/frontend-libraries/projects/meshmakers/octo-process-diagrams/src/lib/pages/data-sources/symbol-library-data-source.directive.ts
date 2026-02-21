import { Directive, forwardRef, inject } from "@angular/core";
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { DataSourceBase, FetchDataOptions, FetchResult, FetchResultBase, ListViewComponent } from '@meshmakers/shared-ui';
import { SymbolLibraryService } from '../../services/symbol-library.service';

/**
 * Data source for Symbol Libraries list view.
 * Can be used in any application that needs to display symbol libraries.
 */
@Directive({
  selector: "[mmSymbolLibraryDataSource]",
  exportAs: 'mmSymbolLibraryDataSource',
  standalone: true,
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => SymbolLibraryDataSourceDirective) }]
})
export class SymbolLibraryDataSourceDirective extends DataSourceBase {
  private readonly symbolLibraryService = inject(SymbolLibraryService);

  constructor() {
    const listViewComponent = inject(ListViewComponent);
    super(listViewComponent);
  }

  fetchData(options: FetchDataOptions): Observable<FetchResult | null> {
    const searchTerm = options.textSearch?.trim() || undefined;

    return from(this.symbolLibraryService.loadLibraryList(searchTerm)).pipe(
      map(libraries => {
        // Apply client-side sorting if specified
        const sortedLibraries = [...libraries];
        if (options.state.sort && options.state.sort.length > 0) {
          const sort = options.state.sort[0];
          sortedLibraries.sort((a, b) => {
            const aVal = (a as unknown as Record<string, unknown>)[sort.field];
            const bVal = (b as unknown as Record<string, unknown>)[sort.field];
            const result = String(aVal ?? '').localeCompare(String(bVal ?? ''));
            return sort.dir === 'desc' ? -result : result;
          });
        }

        // Apply client-side pagination
        const skip = options.state.skip ?? 0;
        const take = options.state.take ?? 50;
        const paginatedLibraries = sortedLibraries.slice(skip, skip + take);

        return new FetchResultBase(paginatedLibraries, sortedLibraries.length);
      }),
      catchError(error => {
        console.error('Error loading symbol libraries:', error);
        return of(new FetchResultBase([], 0));
      })
    );
  }

  /**
   * Refresh the data
   */
  refresh(): void {
    this.fetchAgain();
  }
}
