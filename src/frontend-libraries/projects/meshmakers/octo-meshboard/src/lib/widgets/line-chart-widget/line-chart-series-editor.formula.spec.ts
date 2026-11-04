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

/** Formula rows and per-series display options of the series editor (AB#7952). */
describe('LineChartSeriesEditorComponent formula series (AB#7952)', () => {
  let fixture: ComponentFixture<LineChartSeriesEditorComponent>;
  let cmp: LineChartSeriesEditorComponent;
  let emitted: LineChartSeriesDefinition[][];
  let primaryEmitted: (LineChartSeriesDisplayOptions | undefined)[];

  const PV: LineChartQuerySeries = {
    kind: 'query', key: 'pv', valueField: 'power',
    dataSource: { type: 'persistentQuery', queryRtId: 'q-pv', queryFamily: 'streamData' }
  };
  const EXPORT: LineChartQuerySeries = { ...PV, key: 'gridExport', dataSource: { ...PV.dataSource, queryRtId: 'q-ex' } };
  const DIRECT: LineChartFormulaSeries = { kind: 'formula', key: 'pvDirect', label: 'PV direct', formula: '${pv} - ${gridExport}' };

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function alerts(): string[] {
    return Array.from(el().querySelectorAll('.row-error')).map(a => a.textContent?.trim() ?? '');
  }

  async function open(series: LineChartSeriesDefinition[], stackedChart = false): Promise<void> {
    fixture = TestBed.createComponent(LineChartSeriesEditorComponent);
    cmp = fixture.componentInstance;
    emitted = [];
    primaryEmitted = [];
    cmp.seriesChange.subscribe(s => emitted.push(s));
    cmp.primaryChange.subscribe(p => primaryEmitted.push(p));
    fixture.componentRef.setInput('series', series);
    fixture.componentRef.setInput('stackedChart', stackedChart);
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

  it('a formula row shows the shared formula field with the other series keys as insertable names and no preview', async () => {
    await open([PV, EXPORT, DIRECT]);

    const formulaRow = el().querySelectorAll('.series-row:not(.primary)')[2];
    expect(formulaRow.querySelector('.tag')?.textContent?.trim()).toBe('formula');
    expect(formulaRow.querySelector('mm-meshboard-formula-field')).not.toBeNull();
    expect(formulaRow.textContent).toContain('Available series');
    const names = Array.from(formulaRow.querySelectorAll('.variable-list button')).map(b => b.textContent?.trim());
    expect(names).toEqual(['pv', 'gridExport']);
    expect(formulaRow.textContent).not.toContain('Preview:');
    // A formula row has no query picker.
    expect(formulaRow.querySelector('mm-query-selector')).toBeNull();
  });

  it('"Add formula series" appends an empty formula row and focuses its key', async () => {
    await open([PV]);
    document.body.appendChild(fixture.nativeElement);

    el().querySelector<HTMLButtonElement>('[data-series-action="add-formula"]')!.click();
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();

    expect(emitted.at(-1)?.at(-1)).toEqual({ kind: 'formula', key: '', formula: '', label: undefined });
    expect(document.activeElement?.closest('[data-series-key="1"]')).not.toBeNull();
  });

  it('rejects a circular reference with the names involved', async () => {
    await open([
      PV,
      { kind: 'formula', key: 'a', formula: '${b} + ${pv}' },
      { kind: 'formula', key: 'b', formula: '${a}' }
    ]);
    cmp.emit();
    fixture.detectChanges();

    expect(alerts()).toEqual([
      'Circular reference between series: a, b',
      'Circular reference between series: a, b'
    ]);
  });

  it('an unknown key is shown once, by the formula field, with the KPI wording', async () => {
    await open([PV, { kind: 'formula', key: 'x', formula: '${nope} + ${pv}' }]);
    cmp.emit();
    fixture.detectChanges();

    expect(cmp.errors[1]).toBe('Unknown variable: nope');
    expect(alerts()).toEqual([]);
    expect(el().querySelector('.field-error')?.textContent?.trim()).toBe('Unknown variable: nope');
  });

  it('an empty formula blocks saving', async () => {
    await open([PV, { kind: 'formula', key: 'x', formula: '' }]);
    cmp.emit();
    fixture.detectChanges();
    expect(alerts()).toEqual(['Enter a formula.']);
  });

  it('Visible / Stacked per row: unchecking stores false, checking again removes the key', async () => {
    await open([PV, DIRECT], true);

    cmp.setOption(cmp.rows[1], 'visible', false);
    cmp.setOption(cmp.rows[0], 'stacked', false);
    expect(emitted.at(-1)).toEqual([
      expect.objectContaining({ key: 'pv', stacked: false }),
      expect.objectContaining({ key: 'pvDirect', visible: false })
    ]);

    cmp.setOption(cmp.rows[1], 'visible', true);
    expect(emitted.at(-1)?.[1]).not.toHaveProperty('visible');
  });

  it('Stacked is disabled unless the chart is a stacked area chart', async () => {
    await open([PV, DIRECT], false);
    const stacked = el().querySelector<HTMLInputElement>('[data-series-stacked="0"]')!;
    expect(stacked.disabled).toBe(true);
    expect(el().querySelector<HTMLInputElement>('[data-series-primary="stacked"]')!.disabled).toBe(true);

    fixture.componentRef.setInput('stackedChart', true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el().querySelector<HTMLInputElement>('[data-series-stacked="0"]')!.disabled).toBe(false);
  });

  it('primary row options emit only non-default values', async () => {
    await open([PV], true);

    cmp.setPrimaryOption('stacked', false);
    expect(primaryEmitted.at(-1)).toEqual({ stacked: false });
    cmp.setPrimaryOption('visible', false);
    expect(primaryEmitted.at(-1)).toEqual({ stacked: false, visible: false });
    cmp.setPrimaryOption('stacked', true);
    cmp.setPrimaryOption('visible', true);
    expect(primaryEmitted.at(-1)).toBeUndefined();
  });
});
