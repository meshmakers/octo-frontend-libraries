import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { of } from 'rxjs';
import { BarChartConfigDialogComponent } from './bar-chart-config-dialog.component';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { GetRuntimeQueryColumnsDtoGQL } from '../../graphQL/getRuntimeQueryColumns';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import { LineChartQuerySeries } from '../../models/meshboard.models';

/** Bar chart dialog with the Series section in category mode (AB#7953). */
describe('BarChartConfigDialogComponent — series (AB#7953)', () => {
  let fixture: ComponentFixture<BarChartConfigDialogComponent>;
  let cmp: BarChartConfigDialogComponent;
  let windowRef: { close: ReturnType<typeof vi.fn> };

  const PV: LineChartQuerySeries = {
    kind: 'query', key: 'pv', label: 'PV', valueField: 'energy', categoryField: 'timestamp',
    dataSource: { type: 'persistentQuery', queryRtId: 'q-pv', queryFamily: 'streamData', entitySelectorId: 'pv' }
  };

  async function open(initial: Partial<BarChartConfigDialogComponent>, ckTypeId = 'System/SimpleSdQuery'): Promise<void> {
    fixture = TestBed.createComponent(BarChartConfigDialogComponent);
    cmp = fixture.componentInstance;
    Object.assign(cmp, { initialChartType: 'column', initialCategoryField: 'day', initialSeries: [{ field: 'importEnergy' }], ...initial });
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
    TestBed.configureTestingModule({
      imports: [BarChartConfigDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: WindowRef, useValue: windowRef },
        { provide: QueryExecutorService, useValue: { fetchStreamDataColumns: vi.fn().mockResolvedValue([]), resolveFamily: vi.fn() } },
        { provide: MeshBoardStateService, useValue: { getVariables: vi.fn(() => []), getEntitySelectors: vi.fn(() => []), resolveStreamDataTimeArgs: vi.fn(() => undefined) } },
        { provide: GetRuntimeQueryColumnsDtoGQL, useValue: {} },
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { runtime: { systemPersistentQuery: { items: [] } } } })) } }
      ]
    });
  });

  it('shows the Series section in category mode for a stream-data query and saves series and the hidden primary', async () => {
    const consumption = { kind: 'formula' as const, key: 'consumption', formula: '${pv} * 2' };
    await open({ initialAdditionalSeries: [PV, consumption], initialPrimarySeries: { visible: false } });

    const editor = el().querySelector('mm-line-chart-series-editor');
    expect(editor).not.toBeNull();
    expect(el().querySelector('.field.category')).not.toBeNull();
    expect(cmp.isValid).toBe(true);
    cmp.onSave();
    expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({
      additionalSeries: [PV, consumption], primarySeries: { visible: false }
    }));
  });

  it('a query row without category field disables Save', async () => {
    await open({ initialAdditionalSeries: [{ ...PV, categoryField: '' }] });
    expect(cmp.isValid).toBe(false);
  });

  it('a formula with an unknown key or a cycle disables Save', async () => {
    await open({ initialAdditionalSeries: [PV, { kind: 'formula', key: 'a', formula: '${nope}' }] });
    expect(cmp.isValid).toBe(false);
    cmp.additionalSeries = [PV, { kind: 'formula', key: 'a', formula: '${b}' }, { kind: 'formula', key: 'b', formula: '${a}' }];
    expect(cmp.isValid).toBe(false);
    cmp.additionalSeries = [PV, { kind: 'formula', key: 'a', formula: '${pv}' }];
    expect(cmp.isValid).toBe(true);
  });

  it('a runtime primary query: no Series section, nothing saved', async () => {
    await open({ initialAdditionalSeries: [PV], initialQueryFamily: 'runtime' }, 'System/SimpleRtQuery');
    expect(el().querySelector('mm-line-chart-series-editor')).toBeNull();
    cmp.onSave();
    const result = windowRef.close.mock.calls[0][0];
    expect(result.additionalSeries).toBeUndefined();
    expect(result.primarySeries).toBeUndefined();
  });

  it('an existing bar chart without series saves without the new keys set', async () => {
    await open({});
    cmp.onSave();
    const result = windowRef.close.mock.calls[0][0];
    expect(result.additionalSeries).toBeUndefined();
    expect(result.primarySeries).toBeUndefined();
  });
});
