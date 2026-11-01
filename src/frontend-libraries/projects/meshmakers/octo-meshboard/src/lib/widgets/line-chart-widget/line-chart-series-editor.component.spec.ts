import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { LineChartSeriesEditorComponent } from './line-chart-series-editor.component';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import { LineChartQuerySeries } from '../../models/meshboard.models';

/** Series section of the line chart dialog (AB#7951): add, remove, reorder by keyboard, validation. */
describe('LineChartSeriesEditorComponent (AB#7951)', () => {
  let fixture: ComponentFixture<LineChartSeriesEditorComponent>;
  let cmp: LineChartSeriesEditorComponent;
  let emitted: LineChartQuerySeries[][];
  let fetchStreamDataColumns: ReturnType<typeof vi.fn>;

  const PV: LineChartQuerySeries = {
    kind: 'query', key: 'pv', label: 'PV', valueField: 'power',
    dataSource: { type: 'persistentQuery', queryRtId: 'q-pv', queryName: 'PV 5m', queryFamily: 'streamData', entitySelectorId: 'pv' }
  };
  const BAT: LineChartQuerySeries = {
    kind: 'query', key: 'battery', valueField: 'dischargePower',
    dataSource: { type: 'persistentQuery', queryRtId: 'q-bat', queryFamily: 'streamData' }
  };

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function actionButtons(action: string): HTMLButtonElement[] {
    return Array.from(el().querySelectorAll<HTMLButtonElement>(`[data-series-action="${action}"]`));
  }

  async function open(series: LineChartQuerySeries[]): Promise<void> {
    fixture = TestBed.createComponent(LineChartSeriesEditorComponent);
    cmp = fixture.componentInstance;
    emitted = [];
    cmp.seriesChange.subscribe(s => emitted.push(s));
    fixture.componentRef.setInput('series', series);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Lets the editor's setTimeout focus handling run. */
  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  }

  beforeEach(() => {
    fetchStreamDataColumns = vi.fn().mockResolvedValue([
      { attributePath: 'power', attributeValueType: 'DOUBLE' },
      { attributePath: 'name', attributeValueType: 'STRING' }
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

  it('shows the primary series first and one row per query series; loads numeric columns of each query', async () => {
    await open([PV, BAT]);

    expect(el().querySelector('.series-row.primary')?.textContent).toContain('Series of the primary query');
    expect(el().querySelectorAll('.series-row:not(.primary)').length).toBe(2);
    expect(fetchStreamDataColumns.mock.calls.map(c => c[0])).toEqual(['q-pv', 'q-bat']);
    expect(cmp.rows[0].numericColumns.map(c => c.attributePath)).toEqual(['power']);
  });

  it('"Add query series" appends an empty row, emits it as invalid and focuses its key field', async () => {
    await open([PV]);

    actionButtons('add')[0].click();
    fixture.detectChanges();
    await settle();

    expect(emitted.at(-1)?.map(s => s.key)).toEqual(['pv', '']);
    expect(el().querySelector('[role="alert"]')?.textContent?.trim()).toBe('Enter a key.');
    expect(document.activeElement?.closest('[data-series-key="1"]')).not.toBeNull();
  });

  it('moves a row down and up by its buttons and keeps the focus on the moved row', async () => {
    await open([PV, BAT]);
    document.body.appendChild(fixture.nativeElement);

    actionButtons('down')[0].click();
    fixture.detectChanges();
    await settle();
    expect(emitted.at(-1)?.map(s => s.key)).toEqual(['battery', 'pv']);
    // pv is now last: "down" is disabled, so the focus is on its "up" button.
    expect(document.activeElement).toBe(actionButtons('up')[1]);

    actionButtons('up')[1].click();
    fixture.detectChanges();
    await settle();
    expect(emitted.at(-1)?.map(s => s.key)).toEqual(['pv', 'battery']);
    expect(document.activeElement).toBe(actionButtons('down')[0]);
  });

  it('first row cannot move up, last row cannot move down; buttons carry aria-labels', async () => {
    await open([PV, BAT]);

    expect(actionButtons('up')[0].disabled).toBe(true);
    expect(actionButtons('down')[1].disabled).toBe(true);
    expect(actionButtons('up')[1].getAttribute('aria-label')).toBe('Move series battery up');
    expect(actionButtons('remove')[0].getAttribute('aria-label')).toBe('Remove series pv');
  });

  it('removes a row; removing the last one moves the focus to "Add"', async () => {
    await open([PV]);
    document.body.appendChild(fixture.nativeElement);

    actionButtons('remove')[0].click();
    fixture.detectChanges();
    await settle();

    expect(emitted.at(-1)).toEqual([]);
    expect(document.activeElement).toBe(actionButtons('add')[0]);
  });

  it('flags a duplicate key under the row', async () => {
    await open([PV, { ...BAT, key: 'pv' }]);
    cmp.emit();
    fixture.detectChanges();

    const alerts = Array.from(el().querySelectorAll('[role="alert"]')).map(a => a.textContent?.trim());
    expect(alerts).toEqual(['The key "pv" is used by another series.', 'The key "pv" is used by another series.']);
  });

  it('selecting another query clears the value field and reloads the columns', async () => {
    await open([PV]);
    fetchStreamDataColumns.mockClear();

    await cmp.onQuerySelected(cmp.rows[0], { rtId: 'q-new', name: 'New' });

    expect(emitted.at(-1)?.[0]).toEqual(expect.objectContaining({
      valueField: '', dataSource: expect.objectContaining({ queryRtId: 'q-new', queryName: 'New', queryFamily: 'streamData' })
    }));
    expect(fetchStreamDataColumns).toHaveBeenCalledWith('q-new', expect.anything());
  });

  it('resolution-aware defaults the aggregation to Average and clears it when switched off', async () => {
    await open([PV]);

    cmp.onResolutionAwareChange(cmp.rows[0], true);
    expect(emitted.at(-1)?.[0].dataSource).toEqual(expect.objectContaining({ resolutionAware: true, requiredAggregation: 'AVG' }));
    cmp.onResolutionAwareChange(cmp.rows[0], false);
    expect(emitted.at(-1)?.[0].dataSource.resolutionAware).toBeUndefined();
    expect(emitted.at(-1)?.[0].dataSource.requiredAggregation).toBeUndefined();
  });

  it('the row wraps instead of scrolling horizontally (flex-wrap)', async () => {
    await open([PV]);
    const row = el().querySelector<HTMLElement>('.series-row:not(.primary)')!;
    expect(getComputedStyle(row).flexWrap).toBe('wrap');
  });

  it('does not mutate the input series', async () => {
    const input = [structuredClone(PV)];
    await open(input);
    cmp.rows[0].series.key = 'changed';
    cmp.emit();
    expect(input[0].key).toBe('pv');
  });
});
