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
    TestBed.configureTestingModule({
      imports: [LineChartConfigDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: WindowRef, useValue: windowRef },
        { provide: QueryExecutorService, useValue: { fetchStreamDataColumns: vi.fn().mockResolvedValue([]), resolveFamily: vi.fn() } },
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

  it('hides the Series section for a runtime query and saves no series', async () => {
    await open({ initialAdditionalSeries: [PV] }, 'System/SimpleRtQuery');

    expect(el().querySelector('mm-line-chart-series-editor')).toBeNull();
    cmp.onSave();
    expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({ additionalSeries: undefined }));
  });

  it('offers Stacked only for an area chart and never saves it for a line chart', async () => {
    await open({ initialChartType: 'line', initialStacked: true });

    expect(Array.from(el().querySelectorAll('label')).some(l => l.textContent?.trim() === 'Stacked')).toBe(false);
    cmp.onSave();
    expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({ stacked: undefined, additionalSeries: undefined }));
  });
});
