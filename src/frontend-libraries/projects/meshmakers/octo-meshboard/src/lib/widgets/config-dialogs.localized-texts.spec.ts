import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { of } from 'rxjs';
import { AttributeSelectorService, CkTypeSelectorService, GetCkTypeAvailableQueryColumnsDtoGQL } from '@meshmakers/octo-services';
import { StatsGridConfigDialogComponent, StatsGridConfigResult } from './stats-grid-widget/stats-grid-config-dialog.component';
import { SummaryCardConfigDialogComponent, SummaryCardConfigResult } from './summary-card-widget/summary-card-config-dialog.component';
import { StatusListConfigDialogComponent, StatusListConfigResult } from './status-list-widget/status-list-config-dialog.component';
import { WidgetGroupConfigDialogComponent, WidgetGroupConfigResult } from './widget-group/widget-group-config-dialog.component';
import { BarChartConfigDialogComponent, BarChartConfigResult } from './bar-chart-widget/bar-chart-config-dialog.component';
import { QueryExecutorService } from '../services/query-executor.service';
import { MeshBoardStateService } from '../services/meshboard-state.service';
import { GetRuntimeQueryColumnsDtoGQL } from '../graphQL/getRuntimeQueryColumns';
import { GetSystemPersistentQueriesDtoGQL } from '../graphQL/getSystemPersistentQueries';
import { KpiWidgetConfig } from '../models/meshboard.models';

/**
 * AC 2 (existing boards keep working): the config dialogs edit only the single texts. Saving a
 * dialog must keep the per-language texts an author put into the board configuration, on the item
 * they belong to, also when other items are removed in the dialog.
 */
describe('Config dialogs keep per-language item texts on save', () => {
  const DE = { 'de-AT': 'Zähler' };
  let windowRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    windowRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: WindowRef, useValue: windowRef },
        { provide: MeshBoardStateService, useValue: { getVariables: () => [], getEntitySelectors: () => [], resolveStreamDataTimeArgs: () => undefined } },
        { provide: QueryExecutorService, useValue: { fetchStreamDataColumns: vi.fn().mockResolvedValue([]), resolveFamily: vi.fn() } },
        { provide: CkTypeSelectorService, useValue: {} },
        { provide: AttributeSelectorService, useValue: {} },
        { provide: GetRuntimeQueryColumnsDtoGQL, useValue: {} },
        { provide: GetCkTypeAvailableQueryColumnsDtoGQL, useValue: {} },
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: { fetch: vi.fn(() => of({ data: { runtime: { systemPersistentQuery: { items: [] } } } })) } }
      ]
    });
  });

  async function open<T extends { ngOnInit(): void | Promise<void>; onSave(): void }>(type: Type<T>, inputs: Record<string, unknown>): Promise<T> {
    TestBed.overrideComponent(type, { set: { template: '', imports: [] } });
    const cmp = TestBed.createComponent(type).componentInstance;
    Object.assign(cmp, inputs);
    await cmp.ngOnInit();
    return cmp;
  }

  function saved<R>(): R {
    return windowRef.close.mock.calls[0][0] as R;
  }

  it('stats grid: label, prefix and suffix maps stay with their stat after another stat is removed', async () => {
    const cmp = await open(StatsGridConfigDialogComponent, {
      initialStats: [
        { label: 'Members', queryId: 'q-a', color: 'default' },
        { label: 'Meters', labels: DE, prefixes: { 'de-AT': 'Nr.' }, suffixes: { 'de-AT': ' Stk.' }, queryId: 'q-b', color: 'default' }
      ],
      initialQueries: []
    });
    cmp.removeStat(0);
    cmp.onSave();

    const [stat] = saved<StatsGridConfigResult>().stats;
    expect(stat).toMatchObject({ label: 'Meters', labels: DE, prefixes: { 'de-AT': 'Nr.' }, suffixes: { 'de-AT': ' Stk.' } });
  });

  it('summary card: tile maps stay with their tile and a renamed single label keeps them', async () => {
    const cmp = await open(SummaryCardConfigDialogComponent, {
      initialTiles: [{ id: 't1', label: 'Meters', labels: DE, suffixes: { 'de-AT': ' Stk.' }, aggregationSource: { ckTypeId: 'System/Adapter', aggregation: 'count' } }]
    });
    cmp.form.tiles[0].label = 'Metering points';
    cmp.onSave();

    expect(saved<SummaryCardConfigResult>().tiles[0]).toMatchObject({ label: 'Metering points', labels: DE, suffixes: { 'de-AT': ' Stk.' } });
  });

  it('status list: the label map stays with its status', async () => {
    const cmp = await open(StatusListConfigDialogComponent, {
      initialCkTypeId: 'System/Adapter', initialLabelField: 'name', initialStatusField: 'state',
      initialStatusColors: { OK: { color: 'green', label: 'Running', labels: { 'de-AT': 'Läuft' } } }
    });
    cmp.onSave();

    expect(saved<StatusListConfigResult>().statusColors).toEqual({ OK: { color: 'green', label: 'Running', labels: { 'de-AT': 'Läuft' } } });
  });

  it('widget group: title templates and the child unit maps are kept', async () => {
    const cmp = await open(WidgetGroupConfigDialogComponent, {
      initialDataSourceMode: 'ckType',
      initialChildTemplate: {
        widgetType: 'kpi', titleTemplate: 'Meter $name', titleTemplates: { 'de-AT': 'Zähler $name' },
        attributeMappings: { valueAttribute: 'value' },
        staticConfig: { suffix: 'kWh', suffixes: { 'de-AT': 'kWh (de)' } } as Partial<KpiWidgetConfig>
      }
    });
    cmp.onSave();

    const template = saved<WidgetGroupConfigResult>().childTemplate;
    expect(template.titleTemplates).toEqual({ 'de-AT': 'Zähler $name' });
    expect((template.staticConfig as Partial<KpiWidgetConfig>).suffixes).toEqual({ 'de-AT': 'kWh (de)' });
  });

  it('bar chart: the legend name map of a static series is kept', async () => {
    const cmp = await open(BarChartConfigDialogComponent, {
      initialChartType: 'column', initialCategoryField: 'day',
      initialSeries: [{ field: 'importEnergy', name: 'Import', names: { 'de-AT': 'Bezug' } }]
    });
    cmp.selectedPersistentQuery = { rtId: 'q-grid', name: 'Grid', ckTypeId: 'System/SimpleSdQuery' };
    cmp.onSave();

    expect(saved<BarChartConfigResult>().series).toEqual([{ field: 'importEnergy', name: 'Import', names: { 'de-AT': 'Bezug' }, color: undefined }]);
  });
});
