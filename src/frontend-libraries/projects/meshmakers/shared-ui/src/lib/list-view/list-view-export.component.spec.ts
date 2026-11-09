import { Component, Directive, forwardRef, inject, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { CommandSettingsService, MessageService } from '@meshmakers/shared-services';
import { GridComponent, PDFComponent } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query/dist/npm/state';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';

import { ListViewComponent } from './list-view.component';
import { DataSourceBase, FetchDataOptions } from '../data-sources/data-source-base';
import { FetchResult, FetchResultBase } from '../models/fetchResult';
import { MmListViewDataBindingDirective } from '../directives/mm-list-view-data-binding.directive';
import { DEFAULT_PDF_EXPORT_ROW_LIMIT } from './list-view-export';

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
  /** The error the failing request throws. */
  public failWith: unknown = new Error('server error');

  constructor() {
    super(inject(ListViewComponent));
  }

  public fetchData(options: FetchDataOptions): Observable<FetchResult | null> {
    this.calls.push({ state: JSON.parse(JSON.stringify(options.state)), textSearch: options.textSearch });
    if (this.failAt !== null && --this.failAt === 0) {
      this.failAt = null;
      const error = this.failWith;
      return throwError(() => error);
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
                    [csvExportFileName]="'Rohdaten.csv'" [csvLocale]="csvLocale"
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
  csvLocale: string | null = null;
}

interface ListViewExportApi {
  runExport(format: 'excel' | 'pdf' | 'csv'): void;
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

  it('shows no second toast when the HTTP error interceptor already reported the failure', fakeAsync(() => {
    create();
    tick();
    host.dataSource.failAt = 2;
    host.dataSource.failWith = { networkError: new HttpErrorResponse({ status: 403, url: 'https://localhost/tenant/graphql' }) };

    api().runExport('excel');
    tick();

    expect(grid.saveAsExcel).not.toHaveBeenCalled();
    expect(messages.showError).not.toHaveBeenCalled();
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

  it('applies the lower PDF limit and names it in the message', async () => {
    create((h) => (h.pdfExportRowLimit = 60));
    await fixture.whenStable();
    const saveAsPdf = vi.spyOn(grid, 'saveAsPDF').mockImplementation(() => undefined);

    api().runExport('pdf');
    // The PDF waits for the embedded font (dynamic import, AB#8630) before Kendo starts.
    await vi.waitFor(() => expect(saveAsPdf).toHaveBeenCalledTimes(1));

    expect(messages.showWarning).toHaveBeenCalledWith(
      'PDF export limited to 60 of 120 rows. Use the Excel export for all rows.');
    expect(api().isExporting).toBe(false);
  });

  it('has a PDF row limit of 1000 by default (measured, AB#8630)', () => {
    const fresh = TestBed.createComponent(ListViewComponent).componentInstance;
    expect(fresh.pdfExportRowLimit).toBe(1000);
    expect(fresh.pdfExportRowLimit).toBe(DEFAULT_PDF_EXPORT_ROW_LIMIT);
  });

  it('keeps the export commands disabled until the PDF font is loaded and Kendo started (AB#8630)', async () => {
    create();
    await fixture.whenStable();
    const saveAsPdf = vi.spyOn(grid, 'saveAsPDF').mockImplementation(() => undefined);

    api().runExport('pdf');
    expect(api().isExporting).toBe(true);
    await vi.waitFor(() => expect(saveAsPdf).toHaveBeenCalledTimes(1));
    expect(api().isExporting).toBe(false);
  });

  it('runs the real Kendo all-pages PDF flow on the fetched rows and restores the page without a request', async () => {
    // Stub only the drawing (no layout in jsdom): note what the grid shows when Kendo would draw,
    // then let Kendo clean up as after a finished PDF. Must be installed before the grid exists,
    // because PDFComponent binds draw() in its constructor.
    let rowsWhenDrawn: string[] = [];
    vi.spyOn(PDFComponent.prototype as unknown as { draw(): void }, 'draw').mockImplementation(function (this: unknown) {
      rowsWhenDrawn = shownRows();
      (this as { cleanup(): void }).cleanup();
    });
    create((h) => (h.pdfExportRowLimit = 90));
    await fixture.whenStable();
    grid.pageChange.emit({ skip: 50, take: 50 });
    fixture.detectChanges();
    await fixture.whenStable();
    const pageBefore = shownRows();
    const directive = fixture.debugElement.query(By.directive(MmListViewDataBindingDirective))
      .injector.get(MmListViewDataBindingDirective);
    const requestsBefore = host.dataSource.calls.length;

    api().runExport('pdf');
    await new Promise((resolve) => setTimeout(resolve, 100));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(rowsWhenDrawn.length).toBe(90);
    expect(rowsWhenDrawn[0]).toBe('row-0');
    expect(rowsWhenDrawn[89]).toBe('row-89');
    expect(messages.showWarning).toHaveBeenCalledWith(
      'PDF export limited to 90 of 120 rows. Use the Excel export for all rows.');
    // Only the export requests (pages of 20 up to the limit): Kendo's two page changes caused none.
    expect(host.dataSource.calls.length - requestsBefore).toBe(5);
    expect(shownRows()).toEqual(pageBefore);
    expect(directive.currentState.skip).toBe(50);
    expect(directive.currentState.take).toBe(50);
    expect(grid.skip).toBe(50);
  });

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

  describe('CSV (AB#8123)', () => {
    let csvFiles: { name: string; text: Promise<string> }[];

    beforeEach(() => {
      csvFiles = [];
      vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
        const reader = new FileReader();
        const text = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
        });
        reader.readAsText(blob as Blob);
        csvFiles.push({ name: '', text });
        return 'blob:csv';
      });
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        csvFiles[csvFiles.length - 1].name = this.download;
      });
    });

    it('offers "Export to CSV" next to Excel and PDF', fakeAsync(() => {
      create();
      tick();
      const commands = (host.listView as unknown as { toolbarCommands: { id: string; text: string }[] }).toolbarCommands;
      expect(commands.map((c) => c.id)).toEqual(['excel', 'pdf', 'csv', 'refresh']);
      expect(commands.find((c) => c.id === 'csv')?.text).toBe('Export to CSV');
      flush();
    }));

    it('writes a header row and all rows of the current query, with the configured file name', async () => {
      create();
      await fixture.whenStable();
      api().runExport('csv');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(csvFiles.length).toBe(1);
      expect(csvFiles[0].name).toBe('Rohdaten.csv');
      const text = await csvFiles[0].text;
      const lines = text.replace(/^\uFEFF/, '').split('\r\n');
      expect(lines[0]).toBe('Name');
      expect(lines.length).toBe(1 + 120 + 1);
      expect(lines[120]).toBe('row-119');
    });

    it('applies the row limit with the same message as Excel', async () => {
      create((h) => (h.exportRowLimit = 70));
      await fixture.whenStable();
      api().runExport('csv');
      await new Promise((resolve) => setTimeout(resolve, 50));

      const text = await csvFiles[0].text;
      expect(text.replace(/^\uFEFF/, '').split('\r\n').length).toBe(1 + 70 + 1);
      expect(messages.showWarning).toHaveBeenCalledWith('Export limited to 70 of 120 rows.');
    });

    it('writes no file when a fetch fails', async () => {
      create();
      await fixture.whenStable();
      host.dataSource.failAt = 2;
      api().runExport('csv');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(csvFiles.length).toBe(0);
      expect(messages.showError).toHaveBeenCalled();
    });
  });
});
