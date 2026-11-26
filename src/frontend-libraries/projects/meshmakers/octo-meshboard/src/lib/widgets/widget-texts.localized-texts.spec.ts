import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { KpiWidgetComponent } from './kpi-widget/kpi-widget.component';
import { GaugeWidgetComponent } from './gauge-widget/gauge-widget.component';
import { MarkdownWidgetComponent } from './markdown-widget/markdown-widget.component';
import { StatusIndicatorWidgetComponent } from './status-indicator-widget/status-indicator-widget.component';
import { StatsGridWidgetComponent, StatValue } from './stats-grid-widget/stats-grid-widget.component';
import { SummaryCardWidgetComponent } from './summary-card-widget/summary-card-widget.component';
import { StatusListWidgetComponent } from './status-list-widget/status-list-widget.component';
import { WidgetGroupComponent } from './widget-group/widget-group.component';
import { TableWidgetComponent } from './table-widget/table-widget.component';
import { DashboardDataService, MeshBoardDataService } from '../services/meshboard-data.service';
import { MeshBoardStateService } from '../services/meshboard-state.service';
import { MeshBoardVariableService } from '../services/meshboard-variable.service';
import { QueryExecutorService } from '../services/query-executor.service';
import { createWidgetTextResolver, MESHBOARD_LANGUAGE } from '../utils/meshboard-language';
import { MESHBOARD_TABLE_ROW_ACTION_HANDLER } from '../utils/meshboard-table-row-action';
import { CkModelService } from '@meshmakers/octo-services';
import { SecretSafeAttributeNamesService } from '@meshmakers/octo-ui';
import { GetDashboardEntityDtoGQL } from '../graphQL/getDashboardEntity';
import { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';
import {
  GaugeWidgetConfig, KpiWidgetConfig, MarkdownWidgetConfig, StatusIndicatorWidgetConfig, StatusListWidgetConfig,
  StatsGridWidgetConfig, SummaryCardWidgetConfig, TableWidgetConfig, WidgetGroupConfig
} from '../models/meshboard.models';

/**
 * Author texts of the non-chart widgets per UI language. Each case names the acceptance criterion
 * it proves:
 * - AC 1: the text of the viewer's language is shown, and follows a language switch;
 * - AC 2: without a translation (no host language, no entry for it, an unusable entry) the single
 *   text is shown as before.
 */
describe('Widget texts per language', () => {
  let language: WritableSignal<string | null>;

  const base = { col: 1, row: 1, colSpan: 2, rowSpan: 2 };

  function create<T>(factory: () => T, withLanguage = true, extra: unknown[] = []): T {
    TestBed.configureTestingModule({
      providers: [
        { provide: DashboardDataService, useValue: {} },
        { provide: MeshBoardDataService, useValue: {} },
        { provide: QueryExecutorService, useValue: {} },
        { provide: CkModelService, useValue: {} },
        { provide: SecretSafeAttributeNamesService, useValue: {} },
        { provide: GetDashboardEntityDtoGQL, useValue: {} },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
        {
          provide: MeshBoardStateService,
          useValue: { getVariables: () => [], timeZoneMode: signal('local'), persistedMeshBoardId: signal('board-1') }
        },
        { provide: MeshBoardVariableService, useValue: { resolveVariables: (text: string) => text } },
        ...(withLanguage ? [{ provide: MESHBOARD_LANGUAGE, useValue: language }] : []),
        ...extra
      ]
    });
    return TestBed.runInInjectionContext(factory);
  }

  beforeEach(() => {
    language = signal<string | null>('de-AT');
  });

  describe('KPI', () => {
    const kpi: KpiWidgetConfig = {
      ...base, id: 'k1', type: 'kpi', title: 'Energy', valueAttribute: '', dataSource: { type: 'static' },
      prefix: 'approx.', prefixes: { 'de-AT': 'ca.', 'en-GB': 'approx. (GB)' },
      suffix: 'kWh', suffixes: { 'de-AT': 'kWh (Energie)' },
      comparisonText: 'vs. last week', comparisonTexts: { 'de-AT': 'ggü. Vorwoche', 'en-GB': 'vs. last week (GB)' }
    };

    function kpiWith(config: KpiWidgetConfig, withLanguage = true): KpiWidgetComponent {
      const cmp = create(() => new KpiWidgetComponent(), withLanguage);
      cmp.config = config;
      return cmp;
    }

    it('AC 1: prefix, unit and comparison text appear in the viewer language and follow a switch', () => {
      const cmp = kpiWith(kpi);
      expect([cmp.prefix(), cmp.suffix(), cmp.comparisonText()]).toEqual(['ca.', 'kWh (Energie)', 'ggü. Vorwoche']);

      language.set('en-GB');
      expect([cmp.prefix(), cmp.suffix(), cmp.comparisonText()]).toEqual(['approx. (GB)', 'kWh', 'vs. last week (GB)']);
    });

    it('AC 2: without a host language the single texts are shown', () => {
      const cmp = kpiWith(kpi, false);
      expect([cmp.prefix(), cmp.suffix(), cmp.comparisonText()]).toEqual(['approx.', 'kWh', 'vs. last week']);
    });

    it('AC 2: an empty or non-string entry is ignored with one warning and the single text stays', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const cmp = kpiWith({ ...kpi, suffixes: { 'de-AT': '' } });

      expect(cmp.suffix()).toBe('kWh');
      expect(cmp.suffix()).toBe('kWh');
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it('AC 2: a KPI without any per-language map shows exactly its single texts', () => {
      const cmp = kpiWith({ ...base, id: 'k2', type: 'kpi', title: 'Energy', valueAttribute: '', dataSource: { type: 'static' }, suffix: 'kWh' });
      expect([cmp.prefix(), cmp.suffix(), cmp.comparisonText()]).toEqual(['', 'kWh', null]);
    });
  });

  it('AC 1 / AC 2: gauge prefix and suffix follow the language, else the single texts', () => {
    const gauge = {
      ...base, id: 'g1', type: 'gauge', title: 'Load', gaugeType: 'arc', valueAttribute: 'v', dataSource: { type: 'static' },
      prefix: '~', prefixes: { 'de-AT': 'ca. ' }, suffix: ' %', suffixes: { 'en-GB': ' percent' }
    } as GaugeWidgetConfig;
    const cmp = create(() => new GaugeWidgetComponent());
    cmp.config = gauge;
    expect([cmp.prefix(), cmp.suffix()]).toEqual(['ca. ', ' %']);
    language.set('en-GB');
    expect([cmp.prefix(), cmp.suffix()]).toEqual(['~', ' percent']);
  });

  it('AC 1 / AC 2: markdown content follows the language, else the single content', () => {
    const markdown: MarkdownWidgetConfig = {
      ...base, id: 'm1', type: 'markdown', title: 'Notes', dataSource: { type: 'static' },
      content: '# Hello', contents: { de: '# Hallo' }
    };
    const cmp = create(() => new MarkdownWidgetComponent());
    cmp.config = markdown;
    expect(cmp.resolvedContent()).toBe('# Hallo');
    language.set('en-GB');
    expect(cmp.resolvedContent()).toBe('# Hello');
  });

  it('AC 1: a markdown widget with only per-language content counts as configured', () => {
    const cmp = create(() => new MarkdownWidgetComponent());
    cmp.config = { ...base, id: 'm2', type: 'markdown', title: 'Notes', dataSource: { type: 'static' }, content: '', contents: { 'de-AT': 'Text' } };
    expect(cmp.isNotConfigured()).toBe(false);
  });

  it('AC 1 / AC 2: status indicator labels follow the language, else the single labels', () => {
    const indicator = {
      ...base, id: 's1', type: 'statusIndicator', title: 'Model', dataSource: { type: 'serviceCall', callType: 'modelAvailable' },
      trueLabel: 'ON', trueLabels: { 'de-AT': 'EIN' }, falseLabel: 'OFF', falseLabels: { 'de-AT': 'AUS' }
    } as StatusIndicatorWidgetConfig;
    const cmp = create(() => new StatusIndicatorWidgetComponent());
    cmp.config = indicator;
    const status = cmp as unknown as { _status: WritableSignal<boolean | null>; _isLoading: WritableSignal<boolean> };
    status._isLoading.set(false);
    status._status.set(true);
    expect(cmp.statusLabel).toBe('EIN');
    status._status.set(false);
    expect(cmp.statusLabel).toBe('AUS');
    language.set('en-GB');
    expect(cmp.statusLabel).toBe('OFF');
  });

  it('AC 1 / AC 2: stats grid label, prefix and suffix follow the language, else the single texts', () => {
    const cmp = create(() => new StatsGridWidgetComponent());
    cmp.config = { ...base, id: 'sg', type: 'statsGrid', title: 'Stats', dataSource: { type: 'aggregation', queries: [] }, stats: [] } as StatsGridWidgetConfig;
    const stat: StatValue = {
      label: 'Meters', labels: { 'de-AT': 'Zähler' }, value: 5, color: 'stat-default', isLoading: false,
      prefix: '#', prefixes: { 'de-AT': 'Nr. ' }, suffix: ' pcs', suffixes: { 'en-GB': ' pieces' }
    };
    expect([cmp.statLabel(stat), cmp.formatValue(stat)]).toEqual(['Zähler', 'Nr. 5 pcs']);
    language.set('en-GB');
    expect([cmp.statLabel(stat), cmp.formatValue(stat)]).toEqual(['Meters', '#5 pieces']);
  });

  it('AC 1 / AC 2: summary card tile texts follow the language, else the single texts', () => {
    const cmp = create(() => new SummaryCardWidgetComponent());
    cmp.config = { ...base, id: 'sc', type: 'summaryCard', title: 'Summary', dataSource: { type: 'static' }, tiles: [] } as SummaryCardWidgetConfig;
    const tile = { id: 't1', label: 'Members', value: '3', prefix: '', suffix: '', color: 'default', fullWidth: false };
    expect(cmp.tileText(tile, 'labels', 'Members', { 'de-AT': 'Mitglieder' })).toBe('Mitglieder');
    language.set('fr-FR');
    expect(cmp.tileText(tile, 'labels', 'Members', { 'de-AT': 'Mitglieder' })).toBe('Members');
  });

  it('AC 1: the stats grid keeps the per-language texts of a configured stat when it loads its values', async () => {
    const fetchAggregations = vi.fn().mockResolvedValue(new Map([['q1', 5]]));
    const cmp = create(() => new StatsGridWidgetComponent(), true, [{ provide: MeshBoardDataService, useValue: { fetchAggregations } }]);
    cmp.config = {
      ...base, id: 'sg', type: 'statsGrid', title: 'Stats',
      dataSource: { type: 'aggregation', queries: [{ id: 'q1', ckTypeId: 'System/Adapter', aggregation: 'count' }] },
      stats: [{
        queryId: 'q1', label: 'Meters', labels: { 'de-AT': 'Zähler' },
        prefix: '#', prefixes: { 'de-AT': 'Nr. ' }, suffix: ' pcs', suffixes: { 'en-GB': ' pieces' }
      }]
    } as StatsGridWidgetConfig;

    cmp.ngOnInit();
    await vi.waitFor(() => expect(cmp.statValues()[0]?.value).toBe(5));

    const [stat] = cmp.statValues();
    expect([cmp.statLabel(stat), cmp.formatValue(stat)]).toEqual(['Zähler', 'Nr. 5 pcs']);
    language.set('en-GB');
    expect([cmp.statLabel(stat), cmp.formatValue(stat)]).toEqual(['Meters', '#5 pieces']);
  });

  it('AC 1: the summary card keeps the per-language texts of a configured tile when it loads its values', async () => {
    const cmp = create(() => new SummaryCardWidgetComponent());
    cmp.config = {
      ...base, id: 'sc', type: 'summaryCard', title: 'Summary', dataSource: { type: 'static' },
      tiles: [{
        id: 't1', label: 'Members', labels: { 'de-AT': 'Mitglieder' },
        prefix: '', prefixes: { 'de-AT': 'ca. ' }, suffix: '', suffixes: { 'de-AT': ' Pers.' }
      }]
    } as SummaryCardWidgetConfig;

    cmp.ngOnInit();
    await vi.waitFor(() => expect(cmp.tileValues().length).toBe(1));

    const [tile] = cmp.tileValues();
    expect([
      cmp.tileText(tile, 'labels', tile.label, tile.labels),
      cmp.tileText(tile, 'prefixes', tile.prefix, tile.prefixes),
      cmp.tileText(tile, 'suffixes', tile.suffix, tile.suffixes)
    ]).toEqual(['Mitglieder', 'ca. ', ' Pers.']);
  });

  it('AC 1 / AC 2: status list badge text follows the language, else the single label, else the status', () => {
    const cmp = create(() => new StatusListWidgetComponent());
    cmp.config = {
      ...base, id: 'sl', type: 'statusList', title: 'Adapters', dataSource: { type: 'static' }, ckTypeId: 'System/Adapter',
      labelField: 'name', statusField: 'state',
      statusColors: { OK: { color: 'green', label: 'Running', labels: { 'de-AT': 'Läuft' } }, FAIL: { color: 'red' } }
    } as StatusListWidgetConfig;
    const ok = { label: 'A1', status: 'OK', color: 'green', displayLabel: 'Running' };
    const fail = { label: 'A2', status: 'FAIL', color: 'red', displayLabel: 'FAIL' };
    expect([cmp.statusLabel(ok), cmp.statusLabel(fail)]).toEqual(['Läuft', 'FAIL']);
    language.set('en-GB');
    expect(cmp.statusLabel(ok)).toBe('Running');
  });

  describe('widget group', () => {
    function group(overrides: Partial<WidgetGroupConfig>): WidgetGroupComponent {
      const cmp = create(() => new WidgetGroupComponent());
      cmp.config = {
        ...base, id: 'wg', type: 'widgetGroup', title: 'Meters', layout: 'grid',
        dataSource: { type: 'repeaterQuery', ckTypeId: 'System/Adapter' },
        childTemplate: { widgetType: 'kpi', titleTemplate: 'Meter $name', titleTemplates: { 'de-AT': 'Zähler $name' }, attributeMappings: { valueAttribute: 'v' },
          staticConfig: { suffix: 'kWh', suffixes: { 'de-AT': 'kWh (de)' } } },
        ...overrides
      } as WidgetGroupConfig;
      return cmp;
    }

    it('AC 1: child headers use the title template of the viewer language and children get the unit maps', () => {
      const cmp = group({});
      const child = (cmp as unknown as { createChildConfig(item: unknown, index: number): KpiWidgetConfig })
        .createChildConfig({ rtId: 'r1', ckTypeId: 'System/Adapter', attributes: new Map([['name', 'A']]) }, 0);
      expect(cmp.childTitle(child)).toBe('Zähler A');
      expect(child.suffixes).toEqual({ 'de-AT': 'kWh (de)' });
      language.set('en-GB');
      expect(cmp.childTitle(child)).toBe('Meter A');
    });

    it('AC 1 / AC 2: the empty message follows the language, else the single message', () => {
      const cmp = group({ emptyMessage: 'No meters', emptyMessages: { 'de-AT': 'Keine Zähler' } });
      expect(cmp.emptyMessage()).toBe('Keine Zähler');
      language.set('en-GB');
      expect(cmp.emptyMessage()).toBe('No meters');
    });
  });

  describe('table (column headers are covered elsewhere)', () => {
    function table(config: Partial<TableWidgetConfig>, withLanguage = true): TableWidgetComponent {
      const cmp = create(() => new TableWidgetComponent(), withLanguage,
        [{ provide: MESHBOARD_TABLE_ROW_ACTION_HANDLER, useValue: vi.fn() }]);
      cmp.config = { ...base, id: 't1', type: 'table', title: 'Daily', dataSource: { type: 'persistentQuery', queryRtId: 'q1' }, columns: [], ...config } as TableWidgetConfig;
      return cmp;
    }

    it('AC 1 / AC 2: the row action label follows the language, else the single label', () => {
      const cmp = table({ rowAction: { label: 'Details', labels: { 'de-AT': 'Einzelheiten' } } });
      expect(cmp.rowActions().map(action => action.label)).toEqual(['Einzelheiten']);
      language.set('en-GB');
      expect(cmp.rowActions().map(action => action.label)).toEqual(['Details']);
    });

    it('AC 1 / AC 2: marker and status icon tooltips follow the language, else the single tooltips', () => {
      const cmp = table({
        columns: [
          { field: 'manual', title: 'Manual' },
          { field: 'state', title: 'State', dataType: 'statusIcons', statusMapping: { ok: { icon: 'check-circle', tooltip: 'Fine', tooltips: { 'de-AT': 'In Ordnung' } } } }
        ],
        valueMarkers: [{ field: 'manual', tooltip: 'Manual values', tooltips: { 'de-AT': 'Manuelle Werte' } }]
      });
      const tooltips = (): unknown[] => {
        const [marker, status] = cmp.listViewColumns();
        return [(marker.cellInputs!({ manual: 1 }) as { tooltip: string }).tooltip, status.statusMapping?.['ok']?.tooltip];
      };
      expect(tooltips()).toEqual(['Manuelle Werte', 'In Ordnung']);
      language.set(null);
      expect(tooltips()).toEqual(['Manual values', 'Fine']);
    });
  });

  describe('ignored entries', () => {
    it('AC 2: the single text stays and one warning is logged per ignored set of entries, not on every read', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const resolve = createWidgetTextResolver(signal<string | null>('de-AT'));

      const reads = [1, 2, 3].map(() => resolve('widget "Energy"', 'suffixes', 'kWh', { 'de-AT': '', german: 'x' }));
      expect(reads).toEqual(['kWh', 'kWh', 'kWh']);
      expect(warn).toHaveBeenCalledTimes(1);

      resolve('widget "Energy"', 'suffixes', 'kWh', { 'de-AT': '' });
      resolve('widget "Energy"', 'prefixes', '', { 'de-AT': '' });
      resolve('widget "Energy"', 'prefixes', '', { 'de-AT': '' });
      expect(warn).toHaveBeenCalledTimes(3);
    });
  });
});
