import { Component, Type, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { GridModule } from '@progress/kendo-angular-grid';
import { ExpressionEvaluatorService, SymbolLibraryService } from '@meshmakers/octo-process-diagrams';
import { CkModelService, HealthService } from '@meshmakers/octo-services';
import { SecretSafeAttributeNamesService } from '@meshmakers/octo-ui';
import { MeshBoardStateService } from '../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../services/meshboard-grid.service';
import { DashboardDataService } from '../services/meshboard-data.service';
import { QueryExecutionResult, QueryExecutorService } from '../services/query-executor.service';
import { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';
import { GetDashboardEntityDtoGQL } from '../graphQL/getDashboardEntity';
import { WidgetLoadingComponent } from '../components/widget-loading/widget-loading.component';
import { AiInsightsService } from './ai-insights-widget/ai-insights.service';
import { AiInsightsWidgetComponent } from './ai-insights-widget/ai-insights-widget.component';
import { AlertBannerWidgetComponent } from './alert-banner-widget/alert-banner-widget.component';
import { AlertListWidgetComponent } from './alert-list-widget/alert-list-widget.component';
import { BarChartWidgetComponent } from './bar-chart-widget/bar-chart-widget.component';
import { EntityAssociationsWidgetComponent } from './entity-associations-widget/entity-associations-widget.component';
import { EntityCardWidgetComponent } from './entity-card-widget/entity-card-widget.component';
import { GaugeWidgetComponent } from './gauge-widget/gauge-widget.component';
import { HeatmapWidgetComponent } from './heatmap-widget/heatmap-widget.component';
import { KpiWidgetComponent } from './kpi-widget/kpi-widget.component';
import { LineChartWidgetComponent } from './line-chart-widget/line-chart-widget.component';
import { PieChartWidgetComponent } from './pie-chart-widget/pie-chart-widget.component';
import { ProcessWidgetComponent } from './process-widget/process-widget.component';
import { ProcessDataService } from './process-widget/services/process-data.service';
import { ServiceHealthWidgetComponent } from './service-health-widget/service-health-widget.component';
import { StatsGridWidgetComponent } from './stats-grid-widget/stats-grid-widget.component';
import { StatusIndicatorWidgetComponent } from './status-indicator-widget/status-indicator-widget.component';
import { StatusListWidgetComponent } from './status-list-widget/status-list-widget.component';
import { SummaryCardWidgetComponent } from './summary-card-widget/summary-card-widget.component';
import { WidgetGroupComponent } from './widget-group/widget-group.component';
import { AttentionListWidgetComponent } from '../cockpit/widgets/attention-list-widget.component';
import { CockpitKpiWidgetComponent } from '../cockpit/widgets/cockpit-kpi-widget.component';
import { RecentItemsWidgetComponent } from '../cockpit/widgets/recent-items-widget.component';
import { CockpitAttentionService } from '../cockpit/attention/attention.service';
import { CockpitContextService } from '../cockpit/cockpit-context.service';
import { CockpitKpiService } from '../cockpit/kpi/cockpit-kpi.service';
import { COCKPIT_RECENT_ITEMS, CockpitRecentItem } from '../cockpit/cockpit-host';
import { AttentionState } from '../cockpit/attention/attention.service';
import { KpiWidgetConfig } from '../models/meshboard.models';

/**
 * AB#9735: every MeshBoard widget shows the table widget's loading spinner while its data loads
 * (AC1), hides it once data, an empty result or an error is shown (AC2) and shows it again when
 * the data reloads (AC3).
 */

@Component({
  standalone: true,
  imports: [GridModule, WidgetLoadingComponent],
  template: `
    <div class="table-reference"><kendo-grid [data]="[]" [loading]="true"></kendo-grid></div>
    <div class="widget-reference"><mm-widget-loading /></div>
  `
})
class SpinnerComparisonHostComponent {}

const BASE = { col: 1, row: 1, colSpan: 2, rowSpan: 2 };
const QUERY = { type: 'persistentQuery', queryRtId: 'q-1', queryFamily: 'runtime' } as const;

function spinnerOf(fixture: ComponentFixture<unknown>): Element | null {
  return (fixture.nativeElement as HTMLElement).querySelector('mm-widget-loading.k-loading-mask .k-loading-image');
}

const REPLACED_INDICATORS = '.loading-indicator, .loading-state, .loading-dots, .loading-overlay, .loading-spinner, .refresh-indicator';

function replacedIndicatorOf(fixture: ComponentFixture<unknown>): Element | null {
  return (fixture.nativeElement as HTMLElement).querySelector(REPLACED_INDICATORS);
}

function textOf(fixture: ComponentFixture<unknown>): string {
  return ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ').trim();
}

function queryResult(value: number | null, rows = 1): QueryExecutionResult {
  return {
    family: 'runtime',
    queryRtId: 'q-1',
    associatedCkTypeId: 'Test/Device',
    columns: [{ attributePath: 'value' }],
    rows: Array.from({ length: rows }, () => ({
      __typename: 'RtAggregationQueryRow',
      rtId: 'dev-1',
      cells: [{ attributePath: 'value', value }]
    })),
    totalCount: rows,
    hasNextPage: false,
    endCursor: null
  } as unknown as QueryExecutionResult;
}

interface WidgetCase {
  name: string;
  component: Type<unknown>;
  config: Record<string, unknown>;
  setLoading(widget: Record<string, unknown>, loading: boolean): void;
}

function signalOf<T>(widget: Record<string, unknown>, name: string): WritableSignal<T> {
  return widget[name] as WritableSignal<T>;
}

const isLoadingSignal = (widget: Record<string, unknown>, loading: boolean): void =>
  signalOf<boolean>(widget, '_isLoading').set(loading);

const WIDGETS: WidgetCase[] = [
  { name: 'KPI', component: KpiWidgetComponent, config: { ...BASE, id: 'kpi', type: 'kpi', title: 'KPI', dataSource: QUERY, queryMode: 'simpleCount' }, setLoading: isLoadingSignal },
  { name: 'gauge', component: GaugeWidgetComponent, config: { ...BASE, id: 'gauge', type: 'gauge', title: 'Gauge', dataSource: QUERY, gaugeType: 'arc', min: 0, max: 100, queryMode: 'simpleCount' }, setLoading: isLoadingSignal },
  { name: 'bar chart', component: BarChartWidgetComponent, config: { ...BASE, id: 'bar', type: 'barChart', title: 'Bar', dataSource: QUERY, chartType: 'column', categoryField: 'name', series: [{ field: 'value', name: 'Value' }] }, setLoading: isLoadingSignal },
  { name: 'line chart', component: LineChartWidgetComponent, config: { ...BASE, id: 'line', type: 'lineChart', title: 'Line', dataSource: QUERY, chartType: 'line', categoryField: 'timestamp', seriesGroupField: 'name', valueField: 'value' }, setLoading: isLoadingSignal },
  { name: 'pie chart', component: PieChartWidgetComponent, config: { ...BASE, id: 'pie', type: 'pieChart', title: 'Pie', dataSource: QUERY, chartType: 'pie', categoryField: 'name', valueField: 'value' }, setLoading: isLoadingSignal },
  { name: 'heatmap', component: HeatmapWidgetComponent, config: { ...BASE, id: 'heat', type: 'heatmap', title: 'Heatmap', dataSource: QUERY, dateField: 'timestamp', aggregation: 'count' }, setLoading: isLoadingSignal },
  { name: 'entity card', component: EntityCardWidgetComponent, config: { ...BASE, id: 'card', type: 'entityCard', title: 'Card', dataSource: { type: 'runtimeEntity', ckTypeId: 'Test/Device', rtId: 'dev-1' } }, setLoading: isLoadingSignal },
  { name: 'entity with associations', component: EntityAssociationsWidgetComponent, config: { ...BASE, id: 'assoc', type: 'entityWithAssociations', title: 'Assoc', dataSource: { type: 'runtimeEntity', ckTypeId: 'Test/Device', rtId: 'dev-1' } }, setLoading: isLoadingSignal },
  { name: 'stats grid', component: StatsGridWidgetComponent, config: { ...BASE, id: 'stats', type: 'statsGrid', title: 'Stats', dataSource: { type: 'static' }, stats: [{ label: 'Devices', ckTypeId: 'Test/Device', aggregation: 'count' }] }, setLoading: isLoadingSignal },
  { name: 'summary card', component: SummaryCardWidgetComponent, config: { ...BASE, id: 'summary', type: 'summaryCard', title: 'Summary', dataSource: { type: 'static' }, tiles: [{ label: 'Devices', ckTypeId: 'Test/Device', aggregation: 'count' }] }, setLoading: isLoadingSignal },
  { name: 'status indicator', component: StatusIndicatorWidgetComponent, config: { ...BASE, id: 'status', type: 'statusIndicator', title: 'Status', dataSource: { type: 'serviceCall', callType: 'modelAvailable', modelName: 'Test' } }, setLoading: isLoadingSignal },
  { name: 'status list', component: StatusListWidgetComponent, config: { ...BASE, id: 'slist', type: 'statusList', title: 'List', dataSource: { type: 'static' }, ckTypeId: 'Test/Device', labelField: 'name', statusField: 'state' }, setLoading: isLoadingSignal },
  { name: 'alert banner', component: AlertBannerWidgetComponent, config: { ...BASE, id: 'banner', type: 'alertBanner', title: 'Banner', dataSource: { type: 'static' } }, setLoading: isLoadingSignal },
  { name: 'alert list', component: AlertListWidgetComponent, config: { ...BASE, id: 'alerts', type: 'alertList', title: 'Alerts', dataSource: { type: 'static' } }, setLoading: isLoadingSignal },
  { name: 'AI insights', component: AiInsightsWidgetComponent, config: { ...BASE, id: 'ai', type: 'aiInsights', title: 'AI', dataSource: { type: 'static' } }, setLoading: isLoadingSignal },
  { name: 'process', component: ProcessWidgetComponent, config: { ...BASE, id: 'process', type: 'process', title: 'Process', dataSource: { type: 'static' } }, setLoading: isLoadingSignal },
  {
    name: 'widget group',
    component: WidgetGroupComponent,
    config: { ...BASE, id: 'group', type: 'widgetGroup', title: 'Group', dataSource: { type: 'repeaterQuery', ckTypeId: 'Test/Device' }, childTemplate: { type: 'kpi' } },
    setLoading: (widget, loading) => {
      signalOf<unknown>(widget, '_config').set(widget['config']);
      isLoadingSignal(widget, loading);
    }
  },
  {
    name: 'service health',
    component: ServiceHealthWidgetComponent,
    config: { ...BASE, id: 'health', type: 'serviceHealth', title: 'Health', dataSource: { type: 'serviceCall', callType: 'healthCheck', serviceType: 'identity' } },
    setLoading: (widget, loading) => signalOf<string>(widget, '_healthStatus').set(loading ? 'loading' : 'healthy')
  },
  {
    name: 'cockpit KPI',
    component: CockpitKpiWidgetComponent,
    config: { ...BASE, id: 'tenants', type: 'tenantCount', title: 'Tenants', dataSource: { type: 'static' } },
    setLoading: (widget, loading) => signalOf<unknown>(widget, '_result').set(loading ? { state: 'loading' } : { state: 'unavailable', reason: 'n/a', forBuilder: false })
  },
  {
    name: 'attention list',
    component: AttentionListWidgetComponent,
    config: { ...BASE, id: 'attention', type: 'attentionList', title: 'Attention', dataSource: { type: 'static' } },
    setLoading: (widget, loading) => signalOf<unknown>(widget, '_state').set({ findings: [], loading, visibleProviders: 1 })
  },
  {
    name: 'recent items',
    component: RecentItemsWidgetComponent,
    config: { ...BASE, id: 'recent', type: 'recentItems', title: 'Recent', dataSource: { type: 'static' } },
    setLoading: (widget, loading) => signalOf<boolean>(widget, '_pending').set(loading)
  }
];

const LIFECYCLE_HOOKS = ['ngOnInit', 'ngOnChanges', 'ngAfterViewInit', 'ngOnDestroy'] as const;

describe('widget loading spinner (AB#9735)', () => {
  let queryExecutor: { execute: ReturnType<typeof vi.fn>; resolveFamily: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    queryExecutor = { execute: vi.fn(), resolveFamily: vi.fn().mockReturnValue(of('runtime')) };
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } },
        { provide: DashboardDataService, useValue: {} },
        { provide: QueryExecutorService, useValue: queryExecutor },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
        { provide: GetDashboardEntityDtoGQL, useValue: {} },
        { provide: SecretSafeAttributeNamesService, useValue: {} },
        { provide: HealthService, useValue: {} },
        { provide: AiInsightsService, useValue: {} },
        { provide: CockpitKpiService, useValue: {} },
        { provide: CockpitAttentionService, useValue: {} },
        { provide: CockpitContextService, useValue: {} },
        { provide: SymbolLibraryService, useValue: {} }
      ]
    });
    TestBed.overrideComponent(ProcessWidgetComponent, {
      set: { providers: [{ provide: ProcessDataService, useValue: {} }, ExpressionEvaluatorService] }
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('AC1: the widget spinner is the table widget\'s spinner (Kendo Grid loading mask)', () => {
    const fixture = TestBed.createComponent(SpinnerComparisonHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const tableMask = root.querySelector('.table-reference .k-loading-mask');
    const widgetMask = root.querySelector('.widget-reference .k-loading-mask');

    expect(tableMask).not.toBeNull();
    expect(widgetMask).not.toBeNull();
    const parts = (mask: Element): string[] => Array.from(mask.children).map(child => `${child.tagName}.${child.className}`);
    expect(parts(widgetMask!)).toEqual(parts(tableMask!));
  });

  describe('AC1/AC2: every widget shows the spinner exactly while it loads', () => {
    for (const widgetCase of WIDGETS) {
      it(`${widgetCase.name}`, () => {
        for (const hook of LIFECYCLE_HOOKS) {
          const prototype = widgetCase.component.prototype as Record<string, unknown>;
          if (typeof prototype[hook] === 'function') {
            vi.spyOn(prototype as Record<string, () => void>, hook).mockImplementation(() => undefined);
          }
        }
        const fixture = TestBed.createComponent(widgetCase.component);
        const widget = fixture.componentInstance as Record<string, unknown>;
        widget['config'] = widgetCase.config;

        widgetCase.setLoading(widget, true);
        fixture.detectChanges();
        expect(spinnerOf(fixture)).not.toBeNull();
        expect(replacedIndicatorOf(fixture)).toBeNull();

        widgetCase.setLoading(widget, false);
        fixture.detectChanges();
        expect(spinnerOf(fixture)).toBeNull();

        widgetCase.setLoading(widget, true);
        fixture.detectChanges();
        expect(spinnerOf(fixture)).not.toBeNull();
      });
    }
  });

  describe('AC2/AC3 with a real load (KPI on a persistent query)', () => {
    function createKpi(): { fixture: ComponentFixture<KpiWidgetComponent>; answers: Subject<QueryExecutionResult>[] } {
      const answers: Subject<QueryExecutionResult>[] = [];
      queryExecutor.execute.mockImplementation(() => {
        const answer = new Subject<QueryExecutionResult>();
        answers.push(answer);
        return answer.asObservable();
      });
      const fixture = TestBed.createComponent(KpiWidgetComponent);
      fixture.componentRef.setInput('config', {
        ...BASE, id: 'kpi', type: 'kpi', title: 'KPI', dataSource: QUERY, queryMode: 'aggregation', queryValueField: 'value'
      } as KpiWidgetConfig);
      fixture.detectChanges();
      return { fixture, answers };
    }

    async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
      await new Promise(resolve => setTimeout(resolve));
      fixture.detectChanges();
    }

    it('AC1+AC2: spinner while the query runs, gone once the value is shown', async () => {
      const { fixture, answers } = createKpi();
      await settle(fixture);
      expect(answers.length).toBe(1);
      expect(spinnerOf(fixture)).not.toBeNull();

      answers[0].next(queryResult(42));
      answers[0].complete();
      await settle(fixture);

      expect(spinnerOf(fixture)).toBeNull();
      expect(textOf(fixture)).toContain('42');
    });

    it('AC2: spinner gone once an empty result is shown', async () => {
      const { fixture, answers } = createKpi();
      await settle(fixture);
      expect(spinnerOf(fixture)).not.toBeNull();
      answers[0].next(queryResult(null, 0));
      answers[0].complete();
      await settle(fixture);

      expect(spinnerOf(fixture)).toBeNull();
    });

    it('AC2: spinner gone once an error is shown', async () => {
      const { fixture, answers } = createKpi();
      await settle(fixture);
      expect(spinnerOf(fixture)).not.toBeNull();
      answers[0].error(new Error('Query failed'));
      await settle(fixture);

      expect(spinnerOf(fixture)).toBeNull();
      expect(textOf(fixture)).toContain('Failed to load data');
    });

    it('AC3: the spinner shows again while the data reloads after a filter change', async () => {
      const { fixture, answers } = createKpi();
      await settle(fixture);
      answers[0].next(queryResult(42));
      answers[0].complete();
      await settle(fixture);
      expect(spinnerOf(fixture)).toBeNull();

      fixture.componentRef.setInput('config', {
        ...BASE, id: 'kpi', type: 'kpi', title: 'KPI', dataSource: QUERY, queryMode: 'aggregation', queryValueField: 'value',
        filters: [{ attributePath: 'state', operator: 'eq', comparisonValue: 'ON' }]
      } as KpiWidgetConfig);
      fixture.detectChanges();
      await settle(fixture);

      expect(answers.length).toBe(2);
      expect(spinnerOf(fixture)).not.toBeNull();

      answers[1].next(queryResult(7));
      answers[1].complete();
      await settle(fixture);
      expect(spinnerOf(fixture)).toBeNull();
      expect(textOf(fixture)).toContain('7');
    });
  });

  describe('AC2/AC3 with a real load (cockpit widgets)', () => {
    async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
      await new Promise(resolve => setTimeout(resolve));
      fixture.detectChanges();
    }

    it('AC2: the attention list hides the spinner once its error is shown', async () => {
      const states = new Subject<AttentionState>();
      TestBed.overrideProvider(CockpitContextService, {
        useValue: { tenantId: () => Promise.resolve('t-1'), isBuilder: () => Promise.resolve(true), resolveLinkTarget: () => null }
      });
      TestBed.overrideProvider(CockpitAttentionService, { useValue: { state: () => states.asObservable() } });
      const fixture = TestBed.createComponent(AttentionListWidgetComponent);
      fixture.componentRef.setInput('config', { ...BASE, id: 'attention', type: 'attentionList', title: 'Attention', dataSource: { type: 'static' } });
      fixture.detectChanges();
      await settle(fixture);
      states.next({ findings: [], loading: true, visibleProviders: 1 });
      fixture.detectChanges();
      expect(spinnerOf(fixture)).not.toBeNull();

      states.error(new Error('Provider failed'));
      fixture.detectChanges();

      expect(spinnerOf(fixture)).toBeNull();
      expect((fixture.nativeElement as HTMLElement).querySelector('.cw-error-text')).not.toBeNull();
    });

    it('AC3: the recent items widget shows the spinner again while it reloads', async () => {
      const answers: ((items: CockpitRecentItem[]) => void)[] = [];
      TestBed.overrideProvider(COCKPIT_RECENT_ITEMS, {
        useValue: {
          items: () => new Promise<CockpitRecentItem[]>(resolve => answers.push(resolve)),
          open: () => undefined
        }
      });
      const fixture = TestBed.createComponent(RecentItemsWidgetComponent);
      fixture.componentRef.setInput('config', { ...BASE, id: 'recent', type: 'recentItems', title: 'Recent', dataSource: { type: 'static' } });
      fixture.detectChanges();
      expect(spinnerOf(fixture)).not.toBeNull();

      answers[0]([]);
      await settle(fixture);
      expect(spinnerOf(fixture)).toBeNull();

      (fixture.componentInstance as RecentItemsWidgetComponent).refresh();
      fixture.detectChanges();
      expect(spinnerOf(fixture)).not.toBeNull();

      answers[1]([]);
      await settle(fixture);
      expect(spinnerOf(fixture)).toBeNull();
    });

    it('AC2: the recent items widget without a host source shows its message, not the spinner', () => {
      const fixture = TestBed.createComponent(RecentItemsWidgetComponent);
      fixture.componentRef.setInput('config', { ...BASE, id: 'recent', type: 'recentItems', title: 'Recent', dataSource: { type: 'static' } });
      fixture.detectChanges();

      expect(spinnerOf(fixture)).toBeNull();
    });
  });
});
