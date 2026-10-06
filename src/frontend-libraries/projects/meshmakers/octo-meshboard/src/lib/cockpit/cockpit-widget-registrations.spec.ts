import { TestBed } from '@angular/core/testing';
import { WindowService } from '@progress/kendo-angular-dialog';
import {
  AnyWidgetConfig,
  AttentionListWidgetConfig,
  COCKPIT_WIDGET_TYPES,
  isCockpitWidgetType,
  PipelineExecutionsWidgetConfig
} from '../models/meshboard.models';
import { registerDefaultWidgets } from '../registrations/default-widget-registrations';
import { PersistedWidgetData, WidgetRegistryService } from '../services/widget-registry.service';
import { registerCockpitWidgets } from './cockpit-widget-registrations';
import { AttentionListWidgetComponent } from './widgets/attention-list-widget.component';
import { CockpitKpiWidgetComponent } from './widgets/cockpit-kpi-widget.component';

/** A `System.UI/DashboardWidget` row of a seeded board (blueprint seed YAML attributes). */
interface SeedWidgetRow {
  name: string;
  type: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  dataSourceType: string;
  config: string;
}

/**
 * The widgets of the `cockpit` board seeded by the System.UI.TenantCockpit blueprint (1.1.0,
 * octo-platform-services `src/SystemUiCkModel/Blueprints/System.UI.TenantCockpit/seed-data/entities.yaml`).
 * Keep in step with the seed: when the sibling repository is checked out next to this one (the
 * worktree-pair layout) and its TenantCockpit blueprint is >= TENANT_COCKPIT_SEED_VERSION, a test
 * compares this fixture with the real seed file; older sibling branches are skipped.
 */
/** Blueprint version of System.UI.TenantCockpit whose seed the fixture below describes. */
const TENANT_COCKPIT_SEED_VERSION = '1.1.0';

const TENANT_COCKPIT_SEED: SeedWidgetRow[] = [
  { name: 'Construction Kit Models', type: 'pieChart', col: 1, row: 3, colSpan: 2, rowSpan: 2, dataSourceType: 'constructionKitQuery',
    config: '{"chartType":"pie","categoryField":"","valueField":"","showLabels":false,"showLegend":true,"legendPosition":"right","ckQueryTarget":"models","ckGroupBy":"modelState"}' },
  { name: 'Needs attention', type: 'attentionList', col: 1, row: 1, colSpan: 6, rowSpan: 1, dataSourceType: 'static', config: '{"maxItems":6}' },
  { name: 'Adapters online', type: 'adapterStatus', col: 1, row: 2, colSpan: 2, rowSpan: 1, dataSourceType: 'static', config: '{"showDetail":true}' },
  { name: 'CK models', type: 'ckModelState', col: 3, row: 2, colSpan: 2, rowSpan: 1, dataSourceType: 'static', config: '{"showDetail":true}' },
  { name: 'Pipeline executions 24 h', type: 'pipelineExecutions', col: 5, row: 2, colSpan: 2, rowSpan: 1, dataSourceType: 'static', config: '{"showDetail":true,"showSparkline":true}' }
];

function persisted(row: SeedWidgetRow, index: number): PersistedWidgetData {
  return {
    rtId: `seed-${index}`,
    ckTypeId: 'System.UI/DashboardWidget',
    name: row.name,
    type: row.type,
    col: row.col,
    row: row.row,
    colSpan: row.colSpan,
    rowSpan: row.rowSpan,
    dataSourceType: row.dataSourceType,
    dataSourceCkTypeId: '',
    dataSourceRtId: '',
    config: row.config
  };
}

/** Reads the widget rows of a seed YAML without a YAML parser (attribute id / value pairs). */
function parseSeedWidgets(yaml: string): SeedWidgetRow[] {
  const entities = yaml.split(/\n {2}- rtId: /).slice(1).filter(block => block.includes('ckTypeId: System.UI/DashboardWidget-1'));
  return entities.map(block => {
    const value = (id: string): string => {
      const match = block.match(new RegExp(`- id: ${id.replace(/[./]/g, '\\$&')}\\n\\s+value: (.*)`));
      if (!match) {
        throw new Error(`${id} missing in seed widget`);
      }
      const raw = match[1].trim();
      return raw.startsWith("'") ? raw.slice(1, -1).replace(/''/g, "'") : raw;
    };
    return {
      name: value('System/Name-1'),
      type: value('System.UI/DashboardWidget.Type-1'),
      col: Number(value('System.UI/DashboardWidget.Col-1')),
      row: Number(value('System.UI/DashboardWidget.Row-1')),
      colSpan: Number(value('System.UI/DashboardWidget.ColSpan-1')),
      rowSpan: Number(value('System.UI/DashboardWidget.RowSpan-1')),
      dataSourceType: value('System.UI/DashboardWidget.DataSourceType-1'),
      config: value('System.UI/DashboardWidget.Config-1')
    };
  });
}

/** `1.1.0` from `blueprintId: System.UI.TenantCockpit-1.1.0`, or null. */
function blueprintVersionOf(yaml: string): string | null {
  return yaml.match(/^blueprintId:\s*\S+?-(\d+\.\d+\.\d+)\s*$/m)?.[1] ?? null;
}

/** Numeric comparison of `major.minor.patch`. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) {
      return (pa[i] ?? 0) - (pb[i] ?? 0);
    }
  }
  return 0;
}

interface NodeFs {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: 'utf8'): string;
}
declare const process: { cwd(): string };

describe('Cockpit widget registrations (AB#5558)', () => {
  let registry: WidgetRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: WindowService, useValue: { open: vi.fn() } }] });
    registry = TestBed.inject(WidgetRegistryService);
    registerDefaultWidgets(registry);
    registerCockpitWidgets(registry);
  });

  function roundTrip(widget: AnyWidgetConfig): AnyWidgetConfig {
    const data = registry.serializeWidget(widget);
    return registry.deserializeWidget({
      rtId: widget.id, ckTypeId: 'System.UI/DashboardWidget', name: widget.title, type: widget.type,
      col: widget.col, row: widget.row, colSpan: widget.colSpan, rowSpan: widget.rowSpan,
      dataSourceType: data.dataSourceType, dataSourceCkTypeId: data.dataSourceCkTypeId ?? null, dataSourceRtId: data.dataSourceRtId ?? null,
      config: JSON.stringify(data.config)
    });
  }

  it('registers the four cockpit widget types with their components and dialogs', () => {
    for (const type of COCKPIT_WIDGET_TYPES) {
      expect(registry.hasConfigDialog(type)).toBe(true);
      expect(isCockpitWidgetType(type)).toBe(true);
    }
    expect(registry.getWidgetComponent('attentionList')).toBe(AttentionListWidgetComponent);
    expect(registry.getWidgetComponent('pipelineExecutions')).toBe(CockpitKpiWidgetComponent);
    expect(isCockpitWidgetType('kpi')).toBe(false);
  });

  it('creates defaults with a static data source', () => {
    const widget = registry.createWidget('attentionList', { id: 'a', title: 'A', col: 1, row: 1, colSpan: 1, rowSpan: 1 });
    expect(widget).toMatchObject({ type: 'attentionList', colSpan: 6, rowSpan: 1, dataSource: { type: 'static' } });
    expect(registry.createWidget('adapterStatus', { id: 'b', title: 'B', col: 1, row: 1, colSpan: 1, rowSpan: 1 })).toMatchObject({ colSpan: 2, rowSpan: 1 });
  });

  it('round-trips the attention list config and applies the dialog result', () => {
    const base = registry.createWidget('attentionList', { id: 'a', title: 'Needs attention', col: 1, row: 1, colSpan: 6, rowSpan: 1 }) as AttentionListWidgetConfig;
    const applied = registry.applyConfigResult(base, { ckTypeId: '', providerIds: ['adapters', 'secrets-re-entry'], maxItems: 4, showExplain: false } as never) as AttentionListWidgetConfig;
    expect(roundTrip(applied)).toMatchObject({ type: 'attentionList', title: 'Needs attention', providerIds: ['adapters', 'secrets-re-entry'], maxItems: 4, showExplain: false });

    const all = registry.applyConfigResult(applied, { ckTypeId: '', providerIds: [], maxItems: 6, showExplain: true } as never) as AttentionListWidgetConfig;
    expect(all.providerIds).toBeUndefined();
    expect(registry.serializeWidget(all)).toEqual({ dataSourceType: 'static', config: { providerIds: undefined, maxItems: 6, showExplain: true } });
  });

  it('round-trips the KPI options; only pipeline executions persist the sparkline flag', () => {
    const pipelines = registry.createWidget('pipelineExecutions', { id: 'p', title: 'P', col: 1, row: 1, colSpan: 2, rowSpan: 1 });
    const applied = registry.applyConfigResult(pipelines, { ckTypeId: '', showDetail: false, showSparkline: false } as never) as PipelineExecutionsWidgetConfig;
    expect(roundTrip(applied)).toMatchObject({ type: 'pipelineExecutions', showDetail: false, showSparkline: false });

    const adapters = registry.applyConfigResult(registry.createWidget('adapterStatus', { id: 'a', title: 'A', col: 1, row: 1, colSpan: 2, rowSpan: 1 }), { ckTypeId: '', showDetail: false, showSparkline: false } as never);
    expect(registry.serializeWidget(adapters).config).toEqual({ showDetail: false });
  });

  it('tolerates broken or foreign persisted configs', () => {
    const widget = registry.deserializeWidget({ ...persisted(TENANT_COCKPIT_SEED[1], 0), config: '{"providerIds":"adapters","maxItems":-3,"showExplain":"yes"}' }) as AttentionListWidgetConfig;
    expect(widget).toMatchObject({ type: 'attentionList', providerIds: undefined, maxItems: undefined, showExplain: undefined });
    expect(registry.deserializeWidget({ ...persisted(TENANT_COCKPIT_SEED[2], 1), config: '' })).toMatchObject({ type: 'adapterStatus', showDetail: undefined });
  });

  it('parses the seeded tenant cockpit board as the library persists it', () => {
    const widgets = TENANT_COCKPIT_SEED.map((row, index) => registry.deserializeWidget(persisted(row, index)));
    expect(widgets.map(w => w.type)).toEqual(['pieChart', 'attentionList', 'adapterStatus', 'ckModelState', 'pipelineExecutions']);
    expect(widgets[1]).toMatchObject({ title: 'Needs attention', providerIds: undefined, maxItems: 6, col: 1, row: 1, colSpan: 6 });
    expect(widgets[4]).toMatchObject({ showDetail: true, showSparkline: true, colSpan: 2 });
    // The seed encodes each cockpit widget exactly as toPersistedConfig would.
    for (const [index, widget] of widgets.entries()) {
      if (!isCockpitWidgetType(widget.type)) continue;
      const serialized = registry.serializeWidget(widget);
      expect(serialized.dataSourceType).toBe(TENANT_COCKPIT_SEED[index].dataSourceType);
      expect(JSON.parse(JSON.stringify(serialized.config))).toEqual(JSON.parse(TENANT_COCKPIT_SEED[index].config));
    }
    // No two seeded widgets overlap on the 6-column board.
    const cells = new Set<string>();
    for (const w of widgets) {
      for (let c = w.col; c < w.col + w.colSpan; c++) {
        for (let r = w.row; r < w.row + w.rowSpan; r++) {
          expect(c).toBeLessThanOrEqual(6);
          expect(cells.has(`${c}:${r}`)).toBe(false);
          cells.add(`${c}:${r}`);
        }
      }
    }
  });

  it('matches the real seed file when a sibling octo-platform-services carries this seed version', async (context) => {
    const moduleName = 'node:fs';
    const fs = (await import(/* @vite-ignore */ moduleName)) as NodeFs;
    const blueprintDir = `${process.cwd()}/../../../octo-platform-services/src/SystemUiCkModel/Blueprints/System.UI.TenantCockpit`;
    if (!fs.existsSync(`${blueprintDir}/blueprint.yaml`)) {
      // CI checks out this repository alone; the fixture above is then the contract.
      context.skip('octo-platform-services is not checked out next to this repository');
      return;
    }
    const siblingVersion = blueprintVersionOf(fs.readFileSync(`${blueprintDir}/blueprint.yaml`, 'utf8'));
    if (!siblingVersion || compareVersions(siblingVersion, TENANT_COCKPIT_SEED_VERSION) < 0) {
      // An older sibling branch (e.g. TenantCockpit 1.0.0 without the widgets) is not a contract breach.
      context.skip(`sibling TenantCockpit is ${siblingVersion ?? 'unknown'}, the fixture targets ${TENANT_COCKPIT_SEED_VERSION}`);
      return;
    }
    expect(parseSeedWidgets(fs.readFileSync(`${blueprintDir}/seed-data/entities.yaml`, 'utf8'))).toEqual(TENANT_COCKPIT_SEED);
  });

  it('reads and compares blueprint versions for the sibling check', () => {
    expect(blueprintVersionOf('blueprintId: System.UI.TenantCockpit-1.1.0\n')).toBe('1.1.0');
    expect(blueprintVersionOf('description: x')).toBeNull();
    expect(compareVersions('1.0.0', '1.1.0')).toBeLessThan(0);
    expect(compareVersions('1.10.0', '1.9.3')).toBeGreaterThan(0);
    expect(compareVersions('1.1.0', '1.1.0')).toBe(0);
  });
});
