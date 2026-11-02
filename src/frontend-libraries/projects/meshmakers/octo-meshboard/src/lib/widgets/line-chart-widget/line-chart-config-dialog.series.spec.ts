import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { of } from 'rxjs';
import { LineChartConfigDialogComponent } from './line-chart-config-dialog.component';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { GetRuntimeQueryColumnsDtoGQL } from '../../graphQL/getRuntimeQueryColumns';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import { LineChartQuerySeries } from '../../models/meshboard.models';

/** Line chart dialog with the Series section and the Stacked option (AB#7951). */
describe('LineChartConfigDialogComponent — series (AB#7951)', () => {
  let fixture: ComponentFixture<LineChartConfigDialogComponent>;
  let cmp: LineChartConfigDialogComponent;
  let windowRef: { close: ReturnType<typeof vi.fn> };
  let fetchStreamDataColumns: ReturnType<typeof vi.fn>;

  const PV: LineChartQuerySeries = {
    kind: 'query', key: 'pv', label: 'PV', valueField: 'power',
    dataSource: { type: 'persistentQuery', queryRtId: 'q-pv', queryFamily: 'streamData', entitySelectorId: 'pv' }
  };

  async function open(initial: Partial<LineChartConfigDialogComponent>, ckTypeId = 'System/SimpleSdQuery'): Promise<void> {
    fixture = TestBed.createComponent(LineChartConfigDialogComponent);
    cmp = fixture.componentInstance;
    Object.assign(cmp, {
      initialChartType: 'area', initialCategoryField: 'timestamp', initialSeriesGroupField: 'rtId', initialValueField: 'importPower',
      ...initial
    });
    await cmp.ngOnInit();
    cmp.selectedPersistentQuery = { rtId: 'q-grid', name: 'Grid', ckTypeId };
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    windowRef = { close: vi.fn() };
    fetchStreamDataColumns = vi.fn().mockResolvedValue([]);
    TestBed.configureTestingModule({
      imports: [LineChartConfigDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: WindowRef, useValue: windowRef },
        { provide: QueryExecutorService, useValue: { fetchStreamDataColumns, resolveFamily: vi.fn() } },
        {
          provide: MeshBoardStateService, useValue: {
            getVariables: vi.fn(() => []), getEntitySelectors: vi.fn(() => []), resolveStreamDataTimeArgs: vi.fn(() => undefined)
          }
        },
        { provide: GetRuntimeQueryColumnsDtoGQL, useValue: {} },
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { runtime: { systemPersistentQuery: { items: [] } } } })) } }
      ]
    });
  });

  it('shows the Series section for a stream-data query and saves the series and Stacked', async () => {
    await open({ initialAdditionalSeries: [PV], initialStacked: true });

    expect(el().querySelector('mm-line-chart-series-editor')).not.toBeNull();
    expect(cmp.isValid).toBe(true);
    cmp.onSave();

    expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({ additionalSeries: [PV], stacked: true }));
  });

  it('an invalid series row disables Save', async () => {
    await open({ initialAdditionalSeries: [{ ...PV, valueField: '' }] });
    expect(cmp.isValid).toBe(false);
  });

  it('saves formula series and the primary display options (AB#7952)', async () => {
    const direct = { kind: 'formula' as const, key: 'pvDirect', formula: 'min(${pv}, 3)' };
    await open({ initialAdditionalSeries: [PV, direct], initialStacked: true, initialPrimarySeries: { stacked: false } });

    expect(cmp.isValid).toBe(true);
    cmp.onSave();
    expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({
      additionalSeries: [PV, direct], stacked: true, primarySeries: { stacked: false }
    }));
  });

  it('a circular, unknown or empty formula disables Save (AB#7952)', async () => {
    await open({ initialAdditionalSeries: [PV, { kind: 'formula', key: 'a', formula: '${a} + ${pv}' }] });
    expect(cmp.isValid).toBe(false);
    cmp.additionalSeries = [PV, { kind: 'formula', key: 'a', formula: '${nope}' }];
    expect(cmp.isValid).toBe(false);
    cmp.additionalSeries = [PV, { kind: 'formula', key: 'a', formula: '' }];
    expect(cmp.isValid).toBe(false);
    cmp.additionalSeries = [PV, { kind: 'formula', key: 'a', formula: '${pv} * 2' }];
    expect(cmp.isValid).toBe(true);
  });

  /*
   * AB#7951 reopen, gap B: the field pickers offer what the backend types. A correctly typed DOUBLE column
   * is a value field and a STRING column a group field. On test-2 the EnergyIQ simple stream-data
   * queries store PascalCase column paths (`ActivePower`), the backend matched them case-sensitively against
   * the camelCase CK paths and typed every column STRING, so no value field was offered. Fixed in the
   * backend (AB#8030); the dialog deliberately does not guess a type.
   */
  it('offers a correctly typed DOUBLE column as value field and a STRING column as group field (gap B)', async () => {
    fetchStreamDataColumns.mockResolvedValue([
      { attributePath: 'activePower', attributeValueType: 'DOUBLE', aggregationType: 'NONE' },
      { attributePath: 'name', attributeValueType: 'STRING', aggregationType: 'NONE' }
    ]);
    await open({});

    await cmp.onQuerySelected({ rtId: 'q-wallbox', name: 'Wallboxen (Archiv)', ckTypeId: 'System/SimpleSdQuery' });

    expect(fetchStreamDataColumns).toHaveBeenCalledWith('q-wallbox', expect.anything());
    expect(cmp.numericColumns.map(c => c.attributePath)).toEqual(['activePower']);
    // timestamp / rtId are the stream-data row fields the dialog adds (AB#8069).
    expect(cmp.nonNumericColumns.map(c => c.attributePath)).toEqual(['timestamp', 'rtId', 'name']);
  });

  it('a column the backend types STRING is not offered as value field (gap B, fixed by AB#8030 in the backend)', async () => {
    fetchStreamDataColumns.mockResolvedValue([
      { attributePath: 'ActivePower', attributeValueType: 'STRING', aggregationType: 'NONE' }
    ]);
    await open({});

    await cmp.onQuerySelected({ rtId: 'q-wallbox', name: 'Wallboxen (Archiv)', ckTypeId: 'System/SimpleSdQuery' });

    expect(cmp.numericColumns).toEqual([]);
  });

  it('hides the Series section for a runtime query and saves no series', async () => {
    await open({ initialAdditionalSeries: [PV] }, 'System/SimpleRtQuery');

    expect(el().querySelector('mm-line-chart-series-editor')).toBeNull();
    cmp.onSave();
    expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({ additionalSeries: undefined }));
  });

  it('offers Stacked only for an area chart and never saves it for a line chart', async () => {
    await open({ initialChartType: 'line', initialStacked: true });

    // The chart-level option (the per-series Stacked checkboxes of AB#7952 live in the series editor).
    expect(Array.from(el().querySelectorAll('label'))
      .filter(l => !l.closest('mm-line-chart-series-editor'))
      .some(l => l.textContent?.trim() === 'Stacked')).toBe(false);
    cmp.onSave();
    expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({ stacked: undefined, additionalSeries: undefined }));
  });

  it('Bucket size (AB#8046): loads, saves a fixed size and saves nothing for Automatic', async () => {
    await open({ initialBucketMinutes: 15 });
    expect(el().querySelector('[data-chart-option="bucketMinutes"]')).not.toBeNull();
    expect(cmp.form.bucketMinutes).toBe(15);
    expect(cmp.bucketSizeOptions.map(o => o.value)).toEqual([null, 1, 5, 10, 15, 30, 60]);
    cmp.onSave();
    expect(windowRef.close).toHaveBeenLastCalledWith(expect.objectContaining({ bucketMinutes: 15 }));

    cmp.form.bucketMinutes = null;
    cmp.onSave();
    expect(windowRef.close).toHaveBeenLastCalledWith(expect.objectContaining({ bucketMinutes: undefined }));
  });

  it('Bucket size (AB#8046): an unsupported stored size shows Automatic; hidden for a runtime query', async () => {
    await open({ initialBucketMinutes: 7 });
    expect(cmp.form.bucketMinutes).toBeNull();
    await open({ initialBucketMinutes: 15 }, 'System/SimpleRtQuery');
    expect(el().querySelector('[data-chart-option="bucketMinutes"]')).toBeNull();
    cmp.onSave();
    expect(windowRef.close).toHaveBeenLastCalledWith(expect.objectContaining({ bucketMinutes: undefined }));
  });
});
