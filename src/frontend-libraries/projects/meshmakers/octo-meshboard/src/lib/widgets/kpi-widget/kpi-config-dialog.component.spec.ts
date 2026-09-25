import { TestBed } from '@angular/core/testing';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { AttributeSelectorService, CkModelService, CkTypeSelectorService } from '@meshmakers/octo-services';
import { KpiConfigDialogComponent } from './kpi-config-dialog.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { QueryExecutorService } from '../../services/query-executor.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { GetRuntimeQueryColumnsDtoGQL } from '../../graphQL/getRuntimeQueryColumns';
import { KpiWidgetConfig } from '../../models/meshboard.models';

describe('KpiConfigDialogComponent — formula and output variable (AB#5364)', () => {
  let component: KpiConfigDialogComponent;
  let stateService: MeshBoardStateService;
  let windowRef: { close: ReturnType<typeof vi.fn> };

  function kpi(id: string, overrides: Partial<KpiWidgetConfig> = {}): KpiWidgetConfig {
    return {
      id,
      type: 'kpi',
      title: `Widget ${id}`,
      col: 1,
      row: 1,
      colSpan: 1,
      rowSpan: 1,
      valueAttribute: '',
      dataSource: { type: 'static' },
      ...overrides
    };
  }

  async function open(widgets: KpiWidgetConfig[], inputs: Partial<KpiConfigDialogComponent> = {}): Promise<void> {
    stateService.setConfig({
      id: 'board',
      name: 'Board',
      columns: 6,
      rowHeight: 200,
      gap: 16,
      widgets,
      variables: [
        { name: 'a', type: 'number', source: 'static', value: '5000' },
        { name: 'b', type: 'number', source: 'static', value: '2000' }
      ]
    });
    component = TestBed.createComponent(KpiConfigDialogComponent).componentInstance;
    Object.assign(component, { initialWidgetId: 'self', initialDataSourceType: 'formula', ...inputs });
    await component.ngOnInit();
  }

  beforeEach(() => {
    windowRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [KpiConfigDialogComponent],
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
    TestBed.overrideComponent(KpiConfigDialogComponent, { set: { template: '', imports: [] } });
    stateService = TestBed.inject(MeshBoardStateService);
  });

  it('validates the formula and previews its result', async () => {
    await open([kpi('self')], { initialFormula: '(${a} - ${b}) / 1000' });

    expect(component.formulaValidation.valid).toBe(true);
    expect(component.formulaPreview).toBe('3');
    expect(component.isValid).toBe(true);
  });

  it('reports unknown variables', async () => {
    await open([kpi('self')], { initialFormula: '${a} + ${missing}' });

    expect(component.formulaValidation.unknownVariables).toEqual(['missing']);
    expect(component.isValid).toBe(false);
  });

  it('offers the outputs of other widgets, but not its own', async () => {
    stateService.setWidgetVariable('other', 'consumption', '10');
    stateService.setWidgetVariable('self', 'mine', '1');
    await open([kpi('self'), kpi('other')], { initialFormula: '${consumption} * 2' });

    expect(component.formulaVariables.map(v => v.name)).toEqual(['a', 'b', 'consumption']);
    expect(component.formulaPreview).toBe('20');
  });

  it('rejects an invalid output variable name', async () => {
    await open([kpi('self')], { initialFormula: '${a}', initialOutputVariableName: '1abc' });

    expect(component.outputVariableError).toBeTruthy();
    expect(component.isValid).toBe(false);
  });

  it('rejects an output name that clashes with a MeshBoard variable or another widget', async () => {
    await open([kpi('self'), kpi('other', { outputVariableName: 'taken' })], { initialFormula: '${a}', initialOutputVariableName: 'a' });
    expect(component.outputVariableError).toContain('MeshBoard variable');

    component.form.outputVariableName = 'taken';
    expect(component.outputVariableError).toContain('Widget other');
  });

  it('blocks saving a circular reference', async () => {
    const other = kpi('other', { valueMode: 'formula', formula: '${self_out} + 1', outputVariableName: 'other_out' });
    await open([kpi('self'), other], { initialFormula: '${other_out} + 1', initialOutputVariableName: 'self_out' });

    expect(component.cycleError).toBeTruthy();
    expect(component.isValid).toBe(false);

    component.form.outputVariableName = '';
    expect(component.cycleError).toBeNull();
  });

  it('returns the formula result on save', async () => {
    await open([kpi('self')], { initialFormula: ' ${a} * 2 ', initialOutputVariableName: 'double', initialComparisonText: 'x' });

    component.onSave();

    expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({
      dataSourceType: 'formula',
      formula: '${a} * 2',
      outputVariableName: 'double',
      comparisonText: 'x'
    }));
  });

  it('inserts a variable reference', async () => {
    await open([kpi('self')], { initialFormula: '1 +' });

    component.insertVariable('a');

    expect(component.form.formula).toBe('1 + ${a}');
  });
});
