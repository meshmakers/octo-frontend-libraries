import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { LineChartSeriesEditorComponent } from './line-chart-series-editor.component';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import { LineChartQuerySeries, LineChartSeriesDefinition } from '../../models/meshboard.models';
import { PersistentQueryItem } from '../../utils/runtime-entity-data-sources';
import { querySeriesErrors } from './line-chart-multi-source';

/** The series editor in category mode (bar chart, AB#7953): category field per query row, no Resolution-aware, no Stacked. */
describe('LineChartSeriesEditorComponent — category mode (AB#7953)', () => {
  let fixture: ComponentFixture<LineChartSeriesEditorComponent>;
  let cmp: LineChartSeriesEditorComponent;
  let emitted: LineChartSeriesDefinition[][];
  let fetchStreamDataColumns: ReturnType<typeof vi.fn>;

  const PV: LineChartQuerySeries = {
    kind: 'query', key: 'pv', label: 'PV', valueField: 'energy', categoryField: 'timestamp',
    dataSource: { type: 'persistentQuery', queryRtId: 'q-pv', queryName: 'PV daily', queryFamily: 'streamData', entitySelectorId: 'pv' }
  };

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function open(series: LineChartSeriesDefinition[], alignment: 'timeGrid' | 'category' = 'category', defaultCategoryField?: string): Promise<void> {
    fixture = TestBed.createComponent(LineChartSeriesEditorComponent);
    cmp = fixture.componentInstance;
    emitted = [];
    cmp.seriesChange.subscribe(s => emitted.push(s));
    fixture.componentRef.setInput('alignment', alignment);
    if (defaultCategoryField) fixture.componentRef.setInput('defaultCategoryField', defaultCategoryField);
    fixture.componentRef.setInput('series', series);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    fetchStreamDataColumns = vi.fn().mockResolvedValue([
      { attributePath: 'day', attributeValueType: 'DATE_TIME' },
      { attributePath: 'energy', attributeValueType: 'DOUBLE' }
    ]);
    TestBed.configureTestingModule({
      imports: [LineChartSeriesEditorComponent],
      providers: [
        provideNoopAnimations(),
        { provide: QueryExecutorService, useValue: { fetchStreamDataColumns } },
        { provide: MeshBoardStateService, useValue: { resolveStreamDataTimeArgs: vi.fn(() => undefined), getEntitySelectors: vi.fn(() => []) } },
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { runtime: { systemPersistentQuery: { items: [] } } } })) } }
      ]
    });
  });

  it('a query row has a category field before the value field; no Resolution-aware and no Stacked checkboxes', async () => {
    await open([PV, { kind: 'formula', key: 'x', formula: '${pv}' }]);

    const row = el().querySelectorAll('.series-row:not(.primary)')[0];
    const fields = Array.from(row.querySelectorAll('.field')).map(f => f.className.replace('field', '').trim());
    expect(fields.indexOf('category')).toBeGreaterThan(-1);
    expect(fields.indexOf('category')).toBeLessThan(fields.indexOf('value'));
    expect(row.querySelector('label[for^="series-category-"]')?.textContent).toContain('Category field');
    expect(el().textContent).not.toContain('Resolution-aware');
    expect(el().querySelectorAll('[data-series-stacked]').length).toBe(0);
    expect(el().querySelector('[data-series-primary="stacked"]')).toBeNull();
    // Visible stays, for every row and the primary row.
    expect(el().querySelectorAll('[data-series-visible]').length).toBe(2);
    expect(el().querySelector('[data-series-primary="visible"]')).not.toBeNull();
    // Category picker offers every column, value picker only numeric ones.
    expect(cmp.rows[0].allColumns.map(c => c.attributePath)).toEqual(['day', 'energy']);
    expect(cmp.rows[0].numericColumns.map(c => c.attributePath)).toEqual(['energy']);
  });

  it('time-grid mode (line chart) is unchanged: no category field, Resolution-aware and Stacked shown', async () => {
    await open([PV], 'timeGrid');
    expect(el().querySelector('.field.category')).toBeNull();
    expect(el().textContent).toContain('Resolution-aware');
    expect(el().querySelectorAll('[data-series-stacked]').length).toBe(1);
    expect(cmp.errors).toEqual([null]);
  });

  it('a query row without a category field is invalid in category mode only', async () => {
    const noCategory = { ...PV, categoryField: undefined };
    await open([noCategory]);
    expect(cmp.errors).toEqual(['Select a category field.']);
    expect(el().querySelector('.row-error')?.textContent).toContain('Select a category field.');
    expect(querySeriesErrors([noCategory])).toEqual([null]);
    expect(querySeriesErrors([noCategory], undefined, { requireCategoryField: true })).toEqual(['Select a category field.']);
  });

  it('selecting a query presets the category field from the primary query when the query has that column', async () => {
    await open([], 'category', 'day');
    cmp.add();
    const query: PersistentQueryItem = { rtId: 'q-pv', name: 'PV daily' };
    await cmp.onQuerySelected(cmp.rows[0], query);

    const last = emitted.at(-1)?.[0] as LineChartQuerySeries;
    expect(last.categoryField).toBe('day');
    expect(last.dataSource.resolutionAware).toBeUndefined();
  });

  it('falls back to timestamp, else leaves the category field empty', async () => {
    fetchStreamDataColumns.mockResolvedValue([
      { attributePath: 'timestamp', attributeValueType: 'DATE_TIME' },
      { attributePath: 'energy', attributeValueType: 'DOUBLE' }
    ]);
    await open([], 'category', 'day');
    cmp.add();
    cmp.rows[0].series.key = 'pv';
    await cmp.onQuerySelected(cmp.rows[0], { rtId: 'q-pv', name: 'PV' });
    expect((emitted.at(-1)?.[0] as LineChartQuerySeries).categoryField).toBe('timestamp');

    fetchStreamDataColumns.mockResolvedValue([{ attributePath: 'energy', attributeValueType: 'DOUBLE' }]);
    await cmp.onQuerySelected(cmp.rows[0], { rtId: 'q-other', name: 'Other' });
    expect((emitted.at(-1)?.[0] as LineChartQuerySeries).categoryField).toBe('');
    (emitted.at(-1)?.[0] as LineChartQuerySeries).valueField = 'energy';
    expect(cmp.errors).toEqual(['Select a category field.']);
  });

  it('keyboard: "Add query series" focuses the new row\'s key field', async () => {
    await open([PV]);
    el().querySelector<HTMLButtonElement>('[data-series-action="add"]')?.click();
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    expect(document.activeElement?.closest('[data-series-key="1"]')).not.toBeNull();
  });
});
