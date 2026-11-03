import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { LineChartSeriesEditorComponent } from './line-chart-series-editor.component';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import {
  LineChartFormulaSeries,
  LineChartQuerySeries,
  LineChartSeriesDefinition,
  LineChartSeriesDisplayOptions
} from '../../models/meshboard.models';

/** "Display" options of the series editor (AB#8046, wireframe section 6). */
describe('LineChartSeriesEditorComponent display options (AB#8046)', () => {
  let fixture: ComponentFixture<LineChartSeriesEditorComponent>;
  let cmp: LineChartSeriesEditorComponent;
  let emitted: LineChartSeriesDefinition[][];
  let primaryEmitted: (LineChartSeriesDisplayOptions | undefined)[];

  const CHARGE: LineChartQuerySeries = {
    kind: 'query', key: 'charge', valueField: 'power', categoryField: 'timestamp',
    dataSource: { type: 'persistentQuery', queryRtId: 'q-bat', queryFamily: 'streamData' }
  };
  const LINE: LineChartFormulaSeries = { kind: 'formula', key: 'pvLine', formula: '${charge}' };

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function last(): LineChartSeriesDefinition[] {
    return emitted[emitted.length - 1];
  }

  async function open(series: LineChartSeriesDefinition[], inputs: Record<string, unknown> = {}): Promise<void> {
    fixture = TestBed.createComponent(LineChartSeriesEditorComponent);
    cmp = fixture.componentInstance;
    emitted = [];
    primaryEmitted = [];
    cmp.seriesChange.subscribe(s => emitted.push(s));
    cmp.primaryChange.subscribe(p => primaryEmitted.push(p));
    fixture.componentRef.setInput('series', series);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LineChartSeriesEditorComponent],
      providers: [
        provideNoopAnimations(),
        { provide: QueryExecutorService, useValue: { fetchStreamDataColumns: vi.fn().mockResolvedValue([]) } },
        { provide: MeshBoardStateService, useValue: { resolveStreamDataTimeArgs: vi.fn(() => undefined), getEntitySelectors: vi.fn(() => []) } },
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { runtime: { systemPersistentQuery: { items: [] } } } })) } }
      ]
    });
  });

  it('line chart: query rows show Missing values, Colour and Line style; formula rows no Missing values', async () => {
    await open([CHARGE, LINE]);
    expect(el().querySelector('[data-series-missing="0"]')).not.toBeNull();
    expect(el().querySelector('[data-series-missing="1"]')).toBeNull();
    expect(el().querySelector('[data-series-color="0"]')).not.toBeNull();
    expect(el().querySelector('[data-series-color="1"]')).not.toBeNull();
    expect(el().querySelector('[data-series-dash="1"]')).not.toBeNull();
    expect(el().querySelector('[data-series-as-line="0"]')).toBeNull();
    expect(el().querySelector('[data-series-primary="missingValues"]')).not.toBeNull();
    expect(el().querySelector('[data-series-primary="dashType"]')).not.toBeNull();
    // Every option has a label linked to its control.
    for (const label of Array.from(el().querySelectorAll('.option-field label'))) {
      expect(el().querySelector(`#${CSS.escape(label.getAttribute('for') ?? '')}`)).not.toBeNull();
    }
  });

  it('Line style only where the series is drawn as a line (area chart: non-stacked series of a stacked area)', async () => {
    await open([CHARGE, { ...LINE, stacked: false }], { areaChart: true, stackedChart: true });
    expect(el().querySelector('[data-series-dash="0"]')).toBeNull();
    expect(el().querySelector('[data-series-dash="1"]')).not.toBeNull();
    expect(el().querySelector('[data-series-primary="dashType"]')).toBeNull();
    await open([{ ...LINE, stacked: false }], { areaChart: true, stackedChart: false });
    expect(el().querySelector('[data-series-dash="0"]')).toBeNull();
  });

  it('Missing values: zero / last value are stored, gap removes the key and the look-back', async () => {
    await open([CHARGE]);
    cmp.setMissingValues(cmp.rows[0], 'zero');
    expect(last()[0].missingValues).toBe('zero');

    cmp.setMissingValues(cmp.rows[0], 'carryForward');
    fixture.detectChanges();
    expect(el().querySelector('[data-series-lookback="0"]')).not.toBeNull();
    expect(cmp.lookbackHours(cmp.rows[0])).toBe(24);
    cmp.setLookbackHours(cmp.rows[0], 12);
    expect(last()[0]).toEqual(expect.objectContaining({ missingValues: 'carryForward', carryForwardLookbackMinutes: 720 }));
    // The default look-back is not stored.
    cmp.setLookbackHours(cmp.rows[0], 24);
    expect(last()[0]).not.toHaveProperty('carryForwardLookbackMinutes');
    cmp.setLookbackHours(cmp.rows[0], 12);

    cmp.setMissingValues(cmp.rows[0], 'gap');
    expect(last()[0]).not.toHaveProperty('missingValues');
    expect(last()[0]).not.toHaveProperty('carryForwardLookbackMinutes');
  });

  it('Colour and Line style: set and cleared (defaults are never stored)', async () => {
    await open([LINE]);
    cmp.patchRow(cmp.rows[0], { color: '#8A5300' });
    cmp.patchRow(cmp.rows[0], { dashType: 'dash' });
    expect(last()[0]).toEqual(expect.objectContaining({ color: '#8A5300', dashType: 'dash' }));
    expect(cmp.colorPickerValue(cmp.rows[0])).toBe('#8A5300');

    cmp.patchRow(cmp.rows[0], { color: undefined, dashType: undefined });
    expect(last()[0]).not.toHaveProperty('color');
    expect(last()[0]).not.toHaveProperty('dashType');
  });

  it('a hand-edited colour token is kept but not shown in the picker', async () => {
    await open([{ ...LINE, color: 'var(--brand-pv, #8A5300)' }]);
    expect(cmp.colorPickerValue(cmp.rows[0])).toBeNull();
    expect(cmp.rows[0].series.color).toBe('var(--brand-pv, #8A5300)');
  });

  it('primary row: Missing values and Line style', async () => {
    await open([CHARGE]);
    cmp.patchPrimary({ missingValues: 'zero' });
    cmp.patchPrimary({ dashType: 'dot' });
    expect(primaryEmitted[primaryEmitted.length - 1]).toEqual({ missingValues: 'zero', dashType: 'dot' });
    cmp.patchPrimary({ missingValues: undefined, dashType: undefined });
    expect(primaryEmitted[primaryEmitted.length - 1]).toBeUndefined();
  });

  it('bar chart: Draw as line, then Second axis and Line style; off drops the line options', async () => {
    await open([CHARGE], { alignment: 'category' });
    expect(el().querySelector('[data-series-dash="0"]')).toBeNull();
    expect(el().querySelector('[data-series-primary="dashType"]')).toBeNull();
    const asLine = el().querySelector<HTMLInputElement>('[data-series-as-line="0"]')!;
    expect(asLine.disabled).toBe(false);

    cmp.setAsLine(cmp.rows[0], true);
    fixture.detectChanges();
    expect(el().querySelector('[data-series-secondary-axis="0"]')).not.toBeNull();
    expect(el().querySelector('[data-series-dash="0"]')).not.toBeNull();
    cmp.patchRow(cmp.rows[0], { secondaryAxis: true, dashType: 'dot' });
    expect(last()[0]).toEqual(expect.objectContaining({ asLine: true, secondaryAxis: true, dashType: 'dot' }));

    cmp.setAsLine(cmp.rows[0], false);
    for (const key of ['asLine', 'secondaryAxis', 'dashType']) expect(last()[0]).not.toHaveProperty(key);
    // No look-back field in category mode (no window before the first category).
    cmp.setMissingValues(cmp.rows[0], 'carryForward');
    fixture.detectChanges();
    expect(el().querySelector('[data-series-lookback="0"]')).toBeNull();
  });

  it('bar chart with horizontal bars: Draw as line is disabled with a hint', async () => {
    await open([CHARGE], { alignment: 'category', linesAllowed: false });
    const asLine = el().querySelector<HTMLInputElement>('[data-series-as-line="0"]')!;
    expect(asLine.disabled).toBe(true);
    expect(asLine.closest('label')!.getAttribute('title')).toContain('horizontal bar chart');
  });
});
