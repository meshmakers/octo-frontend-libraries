import { Component, Directive, forwardRef, inject, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { CommandSettingsService, MessageService } from '@meshmakers/shared-services';
import { GridComponent } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query/dist/npm/state';
import { Observable, of, throwError } from 'rxjs';

import { ListViewComponent } from './list-view.component';
import { DataSourceBase, FetchDataOptions } from '../data-sources/data-source-base';
import { FetchResult, FetchResultBase } from '../models/fetchResult';
import { MmListViewDataBindingDirective } from '../directives/mm-list-view-data-binding.directive';

interface Call {
  state: State;
  textSearch: string | null;
}

/**
 * A data source of `total` rows. Server mode honours skip/take like the OctoMesh API;
 * client mode returns every row with each request (no server paging).
 */
@Directive({
  selector: '[mmTestExportDs]',
  standalone: true,
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => ExportDataSourceDirective) }]
})
class ExportDataSourceDirective extends DataSourceBase {
  public calls: Call[] = [];
  public total = 120;
  public clientSide = false;
  /** Fail the n-th request (1-based), counted from the next request on. */
  public failAt: number | null = null;

  constructor() {
    super(inject(ListViewComponent));
  }

  public fetchData(options: FetchDataOptions): Observable<FetchResult | null> {
    this.calls.push({ state: JSON.parse(JSON.stringify(options.state)), textSearch: options.textSearch });
    if (this.failAt !== null && --this.failAt === 0) {
      this.failAt = null;
      return throwError(() => new Error('server error'));
    }
    const all = Array.from({ length: this.total }, (_, i) => ({ name: `row-${i}` }));
    if (this.clientSide) {
      return of(new FetchResultBase(all, this.total));
    }
    const skip = options.state.skip ?? 0;
    return of(new FetchResultBase(all.slice(skip, skip + (options.state.take ?? 10)), this.total));
  }
}

@Component({
  standalone: true,
  imports: [ListViewComponent, ExportDataSourceDirective],
  template: `
    <div style="height: 600px; display: flex;">
      <mm-list-view mmTestExportDs [columns]="columns" [pageSize]="50" [exportPageSize]="exportPageSize"
                    [exportRowLimit]="exportRowLimit" [pdfExportRowLimit]="pdfExportRowLimit"
                    [persistListState]="false" style="flex: 1"></mm-list-view>
    </div>
  `
})
class HostComponent {
  @ViewChild(ExportDataSourceDirective) dataSource!: ExportDataSourceDirective;
  @ViewChild(ListViewComponent) listView!: ListViewComponent;
  columns = [{ field: 'name', displayName: 'Name', dataType: 'text' as const }];
  exportPageSize = 20;
  exportRowLimit = 50000;
  pdfExportRowLimit = 5000;
}

interface ListViewExportApi {
  runExport(format: 'excel' | 'pdf'): void;
  excelExportData: () => { data: { name: string }[] };
  isExporting: boolean;
}

describe('ListViewComponent export of all rows (AB#8122)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let grid: GridComponent;
  let messages: { showWarning: ReturnType<typeof vi.fn>; showError: ReturnType<typeof vi.fn> };
  let exportedRows: { name: string }[] | null;

  const api = () => host.listView as unknown as ListViewExportApi;
  const shownRows = () => (grid.data as { data: { name: string }[] }).data.map((r) => r.name);

  beforeEach(async () => {
    messages = { showWarning: vi.fn(), showError: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideNoopAnimations(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: CommandSettingsService, useValue: { navigateRelativeToRoute: {}, commandItems: [] } },
        { provide: MessageService, useValue: messages }
      ]
    }).compileComponents();
  });

  function create(configure?: (h: HostComponent) => void): void {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    configure?.(host);
    fixture.detectChanges();
    grid = fixture.debugElement.query(By.directive(GridComponent)).componentInstance as GridComponent;
    exportedRows = null;
    // Stand-in for Kendo's Excel writer: read the rows exactly as <kendo-grid-excel> would.
    vi.spyOn(grid, 'saveAsExcel').mockImplementation(() => {
      exportedRows = api().excelExportData().data;
    });
  }

  it('exports all rows of the current filter, search and sort, not only the shown page', fakeAsync(() => {
    create();
    tick();
    grid.sortChange.emit([{ field: 'name', dir: 'desc' }]);
    host.dataSource.listViewComponent.onExecuteFilter.emit('row');
    fixture.detectChanges();
    tick();
    const before = host.dataSource.calls.length;

    api().runExport('excel');
    tick();

    expect(exportedRows?.length).toBe(120);
    const exportCalls = host.dataSource.calls.slice(before);
    expect(exportCalls.map((c) => [c.state.skip, c.state.take])).toEqual([[0, 20], [20, 20], [40, 20], [60, 20], [80, 20], [100, 20]]);
    expect(exportCalls.every((c) => c.textSearch === 'row')).toBe(true);
    expect(exportCalls.every((c) => JSON.stringify(c.state.sort) === JSON.stringify([{ field: 'name', dir: 'desc' }]))).toBe(true);
    expect(messages.showWarning).not.toHaveBeenCalled();
    flush();
  }));

  it('leaves the grid page, data and loading state untouched', fakeAsync(() => {
    create();
    tick();
    grid.pageChange.emit({ skip: 50, take: 50 });
    fixture.detectChanges();
    tick();
    const pageBefore = shownRows();
    const directive = fixture.debugElement.query(By.directive(MmListViewDataBindingDirective))
      .injector.get(MmListViewDataBindingDirective);

    api().runExport('excel');
    tick();

    expect(exportedRows?.length).toBe(120);
    expect(shownRows()).toEqual(pageBefore);
    expect(grid.skip).toBe(50);
    expect(directive.currentState.skip).toBe(50);
    expect(directive.currentState.take).toBe(50);
    expect(host.dataSource.isLoading).toBe(false);
    flush();
  }));

  it('cuts the export at the row limit and tells the user', fakeAsync(() => {
    create((h) => (h.exportRowLimit = 70));
    tick();

    api().runExport('excel');
    tick();

    expect(exportedRows?.length).toBe(70);
    expect(messages.showWarning).toHaveBeenCalledWith('Export limited to 70 of 120 rows.');
    flush();
  }));

  it('shows an error and writes no file when a fetch fails', fakeAsync(() => {
    create();
    tick();
    host.dataSource.failAt = 3;

    api().runExport('excel');
    tick();

    expect(grid.saveAsExcel).not.toHaveBeenCalled();
    expect(messages.showError).toHaveBeenCalledWith('Export failed: the rows could not be loaded. No file was created.');
    expect(api().isExporting).toBe(false);
    flush();
  }));

  it('exports the rows it holds without another request for client-side data', fakeAsync(() => {
    create();
    host.dataSource.clientSide = true;
    host.dataSource.fetchAgain();
    fixture.detectChanges();
    tick();
    const before = host.dataSource.calls.length;

    api().runExport('excel');
    tick();

    expect(host.dataSource.calls.length).toBe(before);
    expect(exportedRows?.length).toBe(120);
    flush();
  }));

  it('applies the lower PDF limit and names it in the message', fakeAsync(() => {
    create((h) => (h.pdfExportRowLimit = 60));
    tick();
    const saveAsPdf = vi.spyOn(grid, 'saveAsPDF').mockImplementation(() => undefined);

    api().runExport('pdf');
    tick();

    expect(saveAsPdf).toHaveBeenCalledTimes(1);
    expect(messages.showWarning).toHaveBeenCalledWith(
      'PDF export limited to 60 of 120 rows. Use the Excel export for all rows.');
    flush();
  }));

  it('renders the fetched rows for the PDF and restores the page afterwards without a request', fakeAsync(() => {
    create();
    tick();
    grid.pageChange.emit({ skip: 50, take: 50 });
    fixture.detectChanges();
    tick();
    const pageBefore = shownRows();
    const directive = fixture.debugElement.query(By.directive(MmListViewDataBindingDirective))
      .injector.get(MmListViewDataBindingDirective);

    directive.preparePdfExport(Array.from({ length: 120 }, (_, i) => ({ name: `row-${i}` })));
    const requests = host.dataSource.calls.length;
    // Kendo's PDF export of all pages: one page change to render everything, one to go back.
    grid.pageChange.emit({ skip: 0, take: 120 });
    expect(shownRows().length).toBe(120);
    grid.pageChange.emit({ skip: 50, take: 50 });
    tick();

    expect(shownRows()).toEqual(pageBefore);
    expect(host.dataSource.calls.length).toBe(requests);
    expect(directive.currentState.skip).toBe(50);
    expect(directive.currentState.take).toBe(50);
    flush();
  }));
});
