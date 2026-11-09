import { Component, Directive, forwardRef, inject, LOCALE_ID, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { CommandSettingsService } from '@meshmakers/shared-services';
import { Observable, of } from 'rxjs';

import { ListViewComponent } from './list-view.component';
import { TableColumn } from './list-view.model';
import { DataSourceBase, FetchDataOptions } from '../data-sources/data-source-base';
import { FetchResult, FetchResultBase } from '../models/fetchResult';

const ROWS = [
  { timestamp: new Date(2025, 0, 1, 1, 0, 0), day: '2025-03-01', at: '2025-01-01T00:00:00Z', value: 1.5, unit: 'kWh', label: 'Wärme' },
  { timestamp: null, day: null, at: null, value: null, unit: null, label: null },
];

@Directive({
  selector: '[mmTestDateDs]',
  standalone: true,
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => DateDataSourceDirective) }],
})
class DateDataSourceDirective extends DataSourceBase {
  constructor() {
    super(inject(ListViewComponent));
  }

  public fetchData(_options: FetchDataOptions): Observable<FetchResult | null> {
    return of(new FetchResultBase(ROWS, ROWS.length));
  }
}

@Component({
  standalone: true,
  imports: [ListViewComponent, DateDataSourceDirective],
  template: `
    <div style="height: 600px; display: flex;">
      <mm-list-view mmTestDateDs [columns]="columns" [persistListState]="false" style="flex: 1"></mm-list-view>
    </div>
  `,
})
class HostComponent {
  @ViewChild(ListViewComponent) listView!: ListViewComponent;
  columns: TableColumn[] = [
    { field: 'timestamp', displayName: 'Timestamp', dataType: 'date' },
    { field: 'day', displayName: 'Day', dataType: 'date' },
    { field: 'at', displayName: 'At', dataType: 'iso8601' },
    { field: 'value', displayName: 'Value', dataType: 'numeric' },
    { field: 'unit', displayName: 'Unit', dataType: 'text', formatter: (v) => (v ? `[${String(v)}]` : '') },
    { field: 'label', displayName: 'Label', dataType: 'text' },
  ];
}

interface DateCellsApi {
  getPdfCellText(element: Record<string, unknown>, column: TableColumn): string;
  getCellTitle(element: Record<string, unknown>, column: TableColumn): string | null;
}

/** Date cells of the grid and the PDF export print one locale-aware line (AB#8630). */
describe('ListViewComponent date cells (AB#8630)', () => {
  let fixture: ComponentFixture<HostComponent>;

  async function render(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideNoopAnimations(),
        // en-US: the only locale Angular's DatePipe (iso8601 column) has data for without registering one.
        { provide: LOCALE_ID, useValue: 'en-US' },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: CommandSettingsService, useValue: { navigateRelativeToRoute: {}, commandItems: [] } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const api = () => fixture.componentInstance.listView as unknown as DateCellsApi;
  const column = (field: string) => fixture.componentInstance.columns.find((c) => c.field === field) as TableColumn;

  it('shows a date column in the grid formatted, not as Date.toString()', async () => {
    await render();
    const text = (fixture.nativeElement as HTMLElement).querySelector('tbody')?.textContent ?? '';
    expect(spaces(text)).toContain('01/01/2025 01:00:00 AM');
    expect(text).toContain('03/01/2025');
    expect(text).not.toContain('GMT');
  });

  it('uses the formatted date as the cell title', async () => {
    await render();
    expect(spaces(api().getCellTitle(ROWS[0], column('timestamp')))).toBe('01/01/2025 01:00:00 AM');
    expect(api().getCellTitle(ROWS[1], column('timestamp'))).toBeNull();
  });

  it('prints PDF cells in one line: dates formatted, formatter first, other values as text', async () => {
    await render();
    const row = ROWS[0];
    expect(spaces(api().getPdfCellText(row, column('timestamp')))).toBe('01/01/2025 01:00:00 AM');
    expect(api().getPdfCellText(row, column('day'))).toBe('03/01/2025');
    expect(api().getPdfCellText(row, column('at'))).toBe(
      new ListViewDateText().of(new Date('2025-01-01T00:00:00Z')));
    expect(api().getPdfCellText(row, column('value'))).toBe('1.5');
    expect(api().getPdfCellText(row, column('unit'))).toBe('[kWh]');
    expect(api().getPdfCellText(row, column('label'))).toBe('Wärme');
    for (const c of fixture.componentInstance.columns) {
      expect(api().getPdfCellText(ROWS[1], c)).toBe('');
      expect(api().getPdfCellText(row, c)).not.toContain('\n');
    }
  });

  it('gives the PDF columns a cell template that prints the PDF cell text', async () => {
    await render();
    const pdfColumns = (fixture.componentInstance.listView as unknown as {
      pdfComponent: { columns: { toArray(): { templateRef?: unknown }[] } };
    }).pdfComponent.columns.toArray();
    expect(pdfColumns.length).toBe(6);
    expect(pdfColumns.every((c) => !!c.templateRef)).toBe(true);
  });
});

/** ICU versions differ in the space before AM/PM (U+0020 or U+202F): compare with spaces normalised. */
function spaces(text: string | null): string | null {
  return text === null ? null : text.replace(/\s/g, ' ');
}

/** Expected en-US text of an instant in the test machine's time zone. */
class ListViewDateText {
  public of(date: Date): string {
    const day = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    const time = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
    return `${day} ${time}`;
  }
}
