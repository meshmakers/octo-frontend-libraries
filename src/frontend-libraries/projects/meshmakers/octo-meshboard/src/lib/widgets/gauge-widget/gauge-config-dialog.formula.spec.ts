import { TestBed } from '@angular/core/testing';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { AttributeSelectorService, CkModelService, CkTypeSelectorService } from '@meshmakers/octo-services';
import { GaugeConfigDialogComponent } from './gauge-config-dialog.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { QueryExecutorService } from '../../services/query-executor.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { GetRuntimeQueryColumnsDtoGQL } from '../../graphQL/getRuntimeQueryColumns';
import { AnyWidgetConfig, KpiWidgetConfig } from '../../models/meshboard.models';

describe('GaugeConfigDialogComponent — formula data source (AB#7950)', () => {
  let component: GaugeConfigDialogComponent;
  let stateService: MeshBoardStateService;
  let windowRef: { close: ReturnType<typeof vi.fn> };

  function kpi(id: string, overrides: Partial<KpiWidgetConfig> = {}): KpiWidgetConfig {
    return {
      id, type: 'kpi', title: `Widget ${id}`, col: 1, row: 1, colSpan: 1, rowSpan: 1,
      valueAttribute: '', dataSource: { type: 'static' }, ...overrides
    };
  }

  async function open(widgets: AnyWidgetConfig[], inputs: Partial<GaugeConfigDialogComponent> = {}): Promise<void> {
    stateService.setConfig({
      id: 'board', name: 'Board', columns: 6, rowHeight: 200, gap: 16, widgets,
      variables: [
        { name: 'import', type: 'number', source: 'static', value: '30' },
        { name: 'consumption', type: 'number', source: 'static', value: '120' }
      ]
    });
    component = TestBed.createComponent(GaugeConfigDialogComponent).componentInstance;
    Object.assign(component, { initialWidgetId: 'self', initialDataSourceType: 'formula', ...inputs });
    await component.ngOnInit();
  }

  beforeEach(() => {
    windowRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [GaugeConfigDialogComponent],
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: {} },
        { provide: CkTypeSelectorService, useValue: {} },
        { provide: AttributeSelectorService, useValue: {} },
        { provide: QueryExecutorService, useValue: {} },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
        { provide: GetRuntimeQueryColumnsDtoGQL, useValue: {} },
        { provide: WindowRef, useValue: windowRef }
      ]
    });
    TestBed.overrideComponent(GaugeConfigDialogComponent, { set: { template: '', imports: [] } });
    stateService = TestBed.inject(MeshBoardStateService);
  });

  it('accepts a valid formula', async () => {
    await open([], { initialFormula: 'max(0, min(100, (1 - ${import} / ${consumption}) * 100))' });

    expect(component.formulaValidation.valid).toBe(true);
    expect(component.isValid).toBe(true);
  });

  it('disables Save for a syntax error, an unknown variable or an empty formula', async () => {
    await open([], { initialFormula: '${import} *' });
    expect(component.isValid).toBe(false);
    expect(component.formulaValidation.error).toBeTruthy();

    component.form.formula = '${import} + ${missing}';
    expect(component.formulaValidation.error).toBe('Unknown variable: missing');
    expect(component.isValid).toBe(false);

    component.form.formula = '   ';
    expect(component.isValid).toBe(false);
  });

  it('uses the same messages as the KPI dialog (shared validation)', async () => {
    await open([], { initialFormula: '${import} + nope' });

    expect(component.formulaValidation).toEqual({ valid: false, error: 'Unknown variable: nope', unknownVariables: ['nope'] });
  });

  it('accepts declared KPI outputs and selector variables without a value yet', async () => {
    await open([kpi('other', { outputVariableName: 'share' })], { initialFormula: '${share} * 100 + ${mp_rtId}' });
    stateService.updateEntitySelectors([{ id: 'mp', label: 'MP', ckTypeId: 'Test/MeteringPoint', attributeMappings: [] }]);

    expect(component.formulaValidation.valid).toBe(true);
  });

  it('offers published outputs of KPIs', async () => {
    stateService.setWidgetVariable('other', 'share', '0.5');
    await open([kpi('other')], { initialFormula: '${share}' });

    expect(component.formulaVariables.map(v => v.name)).toEqual(['import', 'consumption', 'share']);
  });

  it('returns formula and gauge options on save, without filters', async () => {
    await open([], {
      initialFormula: ' ${import} / ${consumption} * 100 ',
      initialGaugeType: 'radial',
      initialMin: 0,
      initialMax: 100,
      initialSuffix: ' %',
      initialFilters: [{ attributePath: 'x', operator: 'EQUALS', comparisonValue: '1' }]
    });

    component.onSave();

    expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({
      dataSourceType: 'formula',
      formula: '${import} / ${consumption} * 100',
      gaugeType: 'radial',
      min: 0,
      max: 100,
      suffix: ' %',
      filters: undefined
    }));
  });

  it('opens a new gauge on the runtime entity source as before', async () => {
    await open([], { initialDataSourceType: undefined });

    expect(component.dataSourceType).toBe('runtimeEntity');
    expect(component.form.formula).toBe('');
  });
});
