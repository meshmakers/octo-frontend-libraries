import { Directive, forwardRef, inject } from "@angular/core";
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { DataSourceBase, FetchDataOptions, FetchResult, FetchResultBase, ListViewComponent } from '@meshmakers/shared-ui';
import { ProcessDiagramDataService } from '../../services/process-diagram-data.service';

/**
 * Data source for Process Diagrams list view.
 * Can be used in any application that needs to display process diagrams.
 */
@Directive({
  selector: "[mmProcessDiagramDataSource]",
  exportAs: 'mmProcessDiagramDataSource',
  standalone: true,
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => ProcessDiagramDataSourceDirective) }]
})
export class ProcessDiagramDataSourceDirective extends DataSourceBase {
  private readonly dataService = inject(ProcessDiagramDataService);

  constructor() {
    const listViewComponent = inject(ListViewComponent);
    super(listViewComponent);
  }

  fetchData(options: FetchDataOptions): Observable<FetchResult | null> {
    const searchTerm = options.textSearch?.trim() || undefined;

    return from(this.dataService.loadDiagramList(searchTerm)).pipe(
      map(diagrams => {
        // Apply client-side sorting if specified
        const sortedDiagrams = [...diagrams];
        if (options.state.sort && options.state.sort.length > 0) {
          const sort = options.state.sort[0];
          sortedDiagrams.sort((a, b) => {
            const aVal = (a as unknown as Record<string, unknown>)[sort.field];
            const bVal = (b as unknown as Record<string, unknown>)[sort.field];
            const result = String(aVal ?? '').localeCompare(String(bVal ?? ''));
            return sort.dir === 'desc' ? -result : result;
          });
        }

        // Apply client-side pagination
        const skip = options.state.skip ?? 0;
        const take = options.state.take ?? 50;
        const paginatedDiagrams = sortedDiagrams.slice(skip, skip + take);

        return new FetchResultBase(paginatedDiagrams, sortedDiagrams.length);
      }),
      catchError(error => {
        console.error('Error loading process diagrams:', error);
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
