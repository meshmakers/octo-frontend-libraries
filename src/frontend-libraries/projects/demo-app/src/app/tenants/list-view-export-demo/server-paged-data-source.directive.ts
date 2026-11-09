import { Directive, forwardRef, inject } from '@angular/core';
import { Observable, throwError, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { orderBy } from '@progress/kendo-data-query';
import { DataSourceBase, FetchDataOptions, FetchResult, FetchResultBase, ListViewComponent } from '@meshmakers/shared-ui';

export interface MeasurementRow {
  timestamp: Date;
  register: string;
  value: number;
  unit: string;
}

/**
 * Simulated server-side paging for the export demo (AB#8122): one year of quarter-hour values of one
 * register (35,040 rows). Every request honours skip/take/sort/search and answers after a delay like
 * a remote API, so the list holds only one page and the export has to fetch the rest.
 */
@Directive({
  selector: '[appServerPagedDataSource]',
  exportAs: 'appServerPagedDataSource',
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => ServerPagedDataSourceDirective) }]
})
export class ServerPagedDataSourceDirective extends DataSourceBase {
  public rowCount = 35040;
  public latencyMs = 150;
  public failNextRequest = false;
  public requestCount = 0;
  private cache: MeasurementRow[] | null = null;

  constructor() {
    super(inject(ListViewComponent));
  }

  public resize(rowCount: number): void {
    this.rowCount = rowCount;
    this.cache = null;
  }

  public fetchData(options: FetchDataOptions): Observable<FetchResult | null> {
    this.requestCount++;
    if (this.failNextRequest) {
      this.failNextRequest = false;
      return timer(this.latencyMs).pipe(switchMap(() => throwError(() => new Error('Simulated server error'))));
    }
    return timer(this.latencyMs).pipe(map(() => {
      let rows = this.rows();
      const search = options.textSearch?.trim();
      if (search) {
        rows = rows.filter(r => r.register.includes(search) || String(r.value).includes(search));
      }
      if (options.state.sort?.length) {
        rows = orderBy(rows, options.state.sort);
      }
      const skip = options.state.skip ?? 0;
      const take = options.state.take ?? rows.length;
      return new FetchResultBase(rows.slice(skip, skip + take), rows.length);
    }));
  }

  private rows(): MeasurementRow[] {
    if (!this.cache) {
      const start = Date.UTC(2025, 0, 1);
      this.cache = Array.from({ length: this.rowCount }, (_, i) => ({
        timestamp: new Date(start + i * 15 * 60 * 1000),
        // Umlauts and ß so the PDF font can be checked (AB#8630).
        register: '1-1:1.29.0 Wärme Süd ß',
        value: Math.round((40 + 25 * Math.sin(i / 48) + (i % 7)) * 1000) / 1000,
        unit: 'kWh'
      }));
    }
    return this.cache;
  }
}
