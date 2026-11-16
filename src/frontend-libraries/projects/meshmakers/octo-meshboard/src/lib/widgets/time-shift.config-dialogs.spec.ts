import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { WindowRef, WindowService } from '@progress/kendo-angular-dialog';
import { NotificationService } from '@progress/kendo-angular-notification';
import { of } from 'rxjs';
import { AttributeSelectorDialogService, AttributeSortSelectorDialogService } from '@meshmakers/octo-ui';
import { AttributeSelectorService, CkModelService, CkTypeSelectorService, GetCkTypeAvailableQueryColumnsDtoGQL } from '@meshmakers/octo-services';
import { MeshBoardStateService } from '../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../services/meshboard-grid.service';
import { QueryExecutorService } from '../services/query-executor.service';
import { WidgetRegistryService } from '../services/widget-registry.service';
import { registerDefaultWidgets } from '../registrations/default-widget-registrations';
import { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';
import { GetRuntimeQueryColumnsDtoGQL } from '../graphQL/getRuntimeQueryColumns';
import { GetSystemPersistentQueriesDtoGQL } from '../graphQL/getSystemPersistentQueries';
import { AnyWidgetConfig, MeshBoardTimeShift, PersistentQueryDataSource } from '../models/meshboard.models';
import { resolveTimeShiftCaption } from '../components/time-shift-caption/time-shift-caption.component';
import { KpiConfigDialogComponent } from './kpi-widget/kpi-config-dialog.component';
import { LineChartConfigDialogComponent } from './line-chart-widget/line-chart-config-dialog.component';
import { BarChartConfigDialogComponent } from './bar-chart-widget/bar-chart-config-dialog.component';
import { PieChartConfigDialogComponent } from './pie-chart-widget/pie-chart-config-dialog.component';
import { TableConfigDialogComponent } from './table-widget/table-config-dialog.component';

/**
 * AB#9095 criteria 2, 3 and 4 through the real dialogs of the five widget types and the real widget
 * registrations: the dialog's `timeShift` is what the editor control emits (the control itself is
 * covered in `sd-time-shift-editor.component.spec.ts`). Board: October 2026, Europe/Vienna.
 */

interface ShiftDialog {
  timeShift?: MeshBoardTimeShift;
  ignoreTimeFilter: boolean;
  selectedPersistentQuery: unknown;
  ngOnInit(): unknown;
  onSave(): unknown;
}

const STREAM_QUERY = { rtId: 'q-energy', name: 'Energy', ckTypeId: 'System/SimpleSdQuery' };
const RUNTIME_QUERY = { rtId: 'q-meters', name: 'Meters', ckTypeId: 'System/SimpleRtQuery' };
const BASE = { title: 'Consumption', col: 1, row: 1, colSpan: 2, rowSpan: 2, configurable: true };
const SOURCE: PersistentQueryDataSource = { type: 'persistentQuery', queryRtId: 'q-energy', queryName: 'Energy', queryFamily: 'streamData' };

interface WidgetCase {
  name: string;
  dialog: Type<unknown>;
  widget: AnyWidgetConfig;
  /** Dialog inputs that make its Save produce a persistent-query result. */
  inputs: Record<string, unknown>;
}

const CASES: WidgetCase[] = [
  {
    name: 'KPI',
    dialog: KpiConfigDialogComponent,
    widget: { ...BASE, id: 'kpi', type: 'kpi', dataSource: SOURCE, valueAttribute: '', queryMode: 'simpleCount' } as AnyWidgetConfig,
    inputs: { initialDataSourceType: 'persistentQuery' }
  },
  {
    name: 'line chart',
    dialog: LineChartConfigDialogComponent,
    widget: { ...BASE, id: 'line', type: 'lineChart', dataSource: SOURCE, chartType: 'line', categoryField: 'timestamp', valueField: 'value' } as AnyWidgetConfig,
    inputs: { initialCategoryField: 'timestamp', initialValueField: 'value' }
  },
  {
    name: 'bar chart',
    dialog: BarChartConfigDialogComponent,
    widget: { ...BASE, id: 'bar', type: 'barChart', dataSource: SOURCE, chartType: 'column', categoryField: 'day', series: [{ field: 'value', name: 'Value' }] } as AnyWidgetConfig,
    inputs: { initialCategoryField: 'day', initialSeries: [{ field: 'value', name: 'Value' }] }
  },
  {
    name: 'pie chart',
    dialog: PieChartConfigDialogComponent,
    widget: { ...BASE, id: 'pie', type: 'pieChart', dataSource: SOURCE, chartType: 'pie', categoryField: 'name', valueField: 'value' } as AnyWidgetConfig,
    inputs: { initialDataSourceType: 'persistentQuery', initialCategoryField: 'name', initialValueField: 'value' }
  },
  {
    name: 'table',
    dialog: TableConfigDialogComponent,
    widget: { ...BASE, id: 'table', type: 'table', dataSource: SOURCE, columns: [] } as AnyWidgetConfig,
    inputs: { initialDataSourceType: 'persistentQuery' }
  }
];

describe('AB#9095 time shift in the widget config dialogs', () => {
  let close: ReturnType<typeof vi.fn>;
  let state: MeshBoardStateService;
  let registry: WidgetRegistryService;

  beforeEach(() => {
    close = vi.fn();
    const persistentQueries = { fetch: vi.fn(() => of({ data: { runtime: { systemPersistentQuery: { items: [], totalCount: 0 } } } })) };
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        MeshBoardStateService,
        { provide: WindowRef, useValue: { close } },
        { provide: WindowService, useValue: { open: vi.fn() } },
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } },
        { provide: CkTypeSelectorService, useValue: {} },
        { provide: AttributeSelectorService, useValue: {} },
        { provide: AttributeSelectorDialogService, useValue: {} },
        { provide: AttributeSortSelectorDialogService, useValue: {} },
        { provide: NotificationService, useValue: { show: vi.fn() } },
        { provide: GetCkTypeAvailableQueryColumnsDtoGQL, useValue: {} },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
        { provide: GetRuntimeQueryColumnsDtoGQL, useValue: { fetch: vi.fn() } },
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: persistentQueries },
        { provide: QueryExecutorService, useValue: { resolveFamily: vi.fn(async () => 'streamData'), fetchStreamDataColumns: vi.fn(async () => []) } }
      ]
    });
    for (const c of CASES) {
      TestBed.overrideComponent(c.dialog, { set: { template: '', imports: [] } });
    }
    state = TestBed.inject(MeshBoardStateService);
    state.updateSettings({ name: 'B', description: '', columns: 4, rowHeight: 150, gap: 8, timeZoneMode: 'Europe/Vienna' });
    state.updateTimeFilterConfig({ enabled: true, selection: { type: 'month', year: 2026, month: 9 } });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
  });

  async function openDialog(c: WidgetCase, widget: AnyWidgetConfig, query = STREAM_QUERY): Promise<ShiftDialog> {
    const dialog = TestBed.createComponent(c.dialog).componentInstance as ShiftDialog;
    const initial = registry.getInitialConfig(widget);
    delete initial['initialQueryRtId'];
    Object.assign(dialog, initial, c.inputs);
    await dialog.ngOnInit();
    dialog.selectedPersistentQuery = query;
    return dialog;
  }

  async function save(dialog: ShiftDialog, widget: AnyWidgetConfig): Promise<AnyWidgetConfig> {
    close.mockClear();
    await dialog.onSave();
    expect(close).toHaveBeenCalledTimes(1);
    return registry.applyConfigResult(widget, close.mock.calls[0][0]);
  }

  function queriedWindow(widget: AnyWidgetConfig): { from: Date; to: Date } | undefined {
    const ds = widget.dataSource as PersistentQueryDataSource;
    return state.resolveStreamDataTimeArgs(ds.ignoreTimeFilter, ds.timeShift);
  }

  for (const c of CASES) {
    describe(c.name, () => {
      it('criterion 2 Set: "Previous period" with 2 periods back saves { by: period, count: -2 }, queries August 2026 and reopens with the choice', async () => {
        const dialog = await openDialog(c, c.widget);
        dialog.timeShift = { by: 'period', count: -2 };

        const saved = await save(dialog, c.widget);

        expect((saved.dataSource as PersistentQueryDataSource).timeShift).toEqual({ by: 'period', count: -2 });
        expect(queriedWindow(saved)).toEqual({ from: new Date('2026-08-01T00:00:00+02:00'), to: new Date('2026-09-01T00:00:00+02:00') });
        const reopened = await openDialog(c, saved);
        expect(reopened.timeShift).toEqual({ by: 'period', count: -2 });
      });

      it('criterion 2 Set: "Same period last year" saves { by: year, count: -1 }, queries October 2025 and survives the stored config', async () => {
        const dialog = await openDialog(c, c.widget);
        dialog.timeShift = { by: 'year', count: -1 };

        const saved = await save(dialog, c.widget);
        const persisted = registry.serializeWidget(saved).config as Record<string, unknown>;

        expect((saved.dataSource as PersistentQueryDataSource).timeShift).toEqual({ by: 'year', count: -1 });
        expect(persisted['timeShift']).toEqual({ by: 'year', count: -1 });
        expect(queriedWindow(saved)).toEqual({ from: new Date('2025-10-01T00:00:00+02:00'), to: new Date('2025-11-01T00:00:00+01:00') });
      });

      it('criterion 3 Clear: "None" removes timeShift from the source and the stored config, and queries October 2026 again', async () => {
        const shifted = { ...c.widget, dataSource: { ...SOURCE, timeShift: { by: 'year', count: -1 } } } as AnyWidgetConfig;
        const dialog = await openDialog(c, shifted);
        expect(dialog.timeShift).toEqual({ by: 'year', count: -1 });
        dialog.timeShift = undefined;

        const saved = await save(dialog, shifted);
        const persisted = registry.serializeWidget(saved).config as Record<string, unknown>;

        expect('timeShift' in saved.dataSource).toBe(false);
        expect('timeShift' in persisted).toBe(false);
        expect(queriedWindow(saved)).toEqual({ from: new Date('2026-10-01T00:00:00+02:00'), to: new Date('2026-11-01T00:00:00+01:00') });
      });

      it('criterion 4 Only where it applies: with "Ignore MeshBoard time filter" the saved shift is kept but not applied', async () => {
        const dialog = await openDialog(c, c.widget);
        dialog.timeShift = { by: 'year', count: -1 };
        dialog.ignoreTimeFilter = true;

        const saved = await save(dialog, c.widget);

        expect((saved.dataSource as PersistentQueryDataSource).timeShift).toEqual({ by: 'year', count: -1 });
        expect(queriedWindow(saved)).toBeUndefined();
        expect(resolveTimeShiftCaption(saved.dataSource, state)).toBeNull();
      });

      it('criterion 4 Only where it applies: a runtime query saves no shift', async () => {
        const runtimeWidget = { ...c.widget, dataSource: { ...SOURCE, queryFamily: 'runtime' } } as AnyWidgetConfig;
        const dialog = await openDialog(c, runtimeWidget, RUNTIME_QUERY);
        dialog.timeShift = { by: 'year', count: -1 };

        const saved = await save(dialog, runtimeWidget);

        expect('timeShift' in saved.dataSource).toBe(false);
      });
    });
  }
});
