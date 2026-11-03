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
  let queryExecutor: { fetchStreamDataColumns: ReturnType<typeof vi.fn> };

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
    queryExecutor = { fetchStreamDataColumns: vi.fn() };
    TestBed.configureTestingModule({
      imports: [KpiConfigDialogComponent],
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: {} },
        { provide: CkTypeSelectorService, useValue: {} },
        { provide: AttributeSelectorService, useValue: {} },
        { provide: QueryExecutorService, useValue: queryExecutor },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
        { provide: GetRuntimeQueryColumnsDtoGQL, useValue: {} },
        { provide: WindowRef, useValue: windowRef }
      ]
    });
    TestBed.overrideComponent(KpiConfigDialogComponent, { set: { template: '', imports: [] } });
    stateService = TestBed.inject(MeshBoardStateService);
  });

  it('validates the formula', async () => {
    await open([kpi('self')], { initialFormula: '(${a} - ${b}) / 1000' });

    expect(component.formulaValidation.valid).toBe(true);
    expect(component.isValid).toBe(true);
  });

  it('disables Save for a syntax error with the message the formula field shows (AB#7950)', async () => {
    await open([kpi('self')], { initialFormula: '${a} *' });

    expect(component.formulaValidation.valid).toBe(false);
    expect(component.formulaValidation.error).toBeTruthy();
    expect(component.isValid).toBe(false);
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
    expect(component.formulaValidation.valid).toBe(true);
  });

  it('picks up an output published while the dialog is open', async () => {
    await open([kpi('self'), kpi('other')], { initialFormula: '${late} + 1' });
    expect(component.formulaValidation.unknownVariables).toEqual(['late']);

    stateService.setWidgetVariable('other', 'late', '41');

    expect(component.formulaValidation.valid).toBe(true);
  });

  it('accepts a declared output that has no value yet, preview stays pending', async () => {
    await open([kpi('self'), kpi('other', { outputVariableName: 'loading' })], { initialFormula: '${loading} * 2' });

    expect(component.formulaValidation.valid).toBe(true);
    expect(component.declaredVariableNames).toContain('loading');
    expect(component.isValid).toBe(true);
  });

  it('accepts entity-selector variables before an entity is picked', async () => {
    await open([kpi('self')], { initialFormula: '${mp_power} + ${mp_rtId}' });
    stateService.updateEntitySelectors([{
      id: 'mp',
      label: 'Metering point',
      ckTypeId: 'Test/MeteringPoint',
      attributeMappings: [{ attributePath: 'power', variableName: 'mp_power' }]
    }]);

    expect(component.formulaValidation.valid).toBe(true);
  });

  it('ignores a cycle through a name shadowed by a MeshBoard variable', async () => {
    const other = kpi('other', { valueMode: 'formula', formula: '${self_out} + 1', outputVariableName: 'a' });
    await open([kpi('self'), other], { initialFormula: '${a} + 1', initialOutputVariableName: 'self_out' });

    expect(component.cycleError).toBeNull();
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

  it('returns the decimal places on save (AB#7686)', async () => {
    await open([kpi('self')], { initialFormula: '${a}', initialDecimalPlaces: 1 });

    expect(component.form.decimalPlaces).toBe(1);
    component.onSave();

    expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({ decimalPlaces: 1 }));
  });

  it('returns no decimal places when the field is empty (AB#7686)', async () => {
    await open([kpi('self')], { initialFormula: '${a}' });

    expect(component.form.decimalPlaces).toBeNull();
    component.onSave();

    expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({ decimalPlaces: undefined }));
  });

  it('does not save a typed value above 3 (AB#7686)', async () => {
    await open([kpi('self')], { initialFormula: '${a}' });
    component.form.decimalPlaces = 7;
    component.onSave();

    expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({ decimalPlaces: undefined }));
  });

  describe('display fields in every mode on save (AB#7686)', () => {
    const expected = {
      prefix: 'EUR ',
      suffix: ' kWh',
      trend: 'down',
      comparisonText: 'vs. last week',
      decimalPlaces: 1,
      outputVariableName: 'shown'
    };

    async function openWithDisplayFields(mode: string): Promise<void> {
      await open([kpi('self')], {
        initialDataSourceType: mode as never,
        initialFormula: '${a}',
        initialStaticValue: '42',
        initialPrefix: 'EUR ',
        initialSuffix: ' kWh',
        initialTrend: 'down',
        initialComparisonText: 'vs. last week',
        initialDecimalPlaces: 1,
        initialOutputVariableName: ' shown '
      });
      Object.assign(component, {
        selectedPersistentQuery: { rtId: 'q-1', name: 'Query', ckTypeId: 'System/RuntimeQuery' },
        selectedCkType: { rtCkTypeId: 'Test/Type' }
      });
    }

    for (const mode of ['formula', 'static', 'persistentQuery', 'runtimeEntity']) {
      it(`returns every display field for ${mode}`, async () => {
        await openWithDisplayFields(mode);
        component.onSave();

        expect(windowRef.close).toHaveBeenCalledWith(expect.objectContaining({ dataSourceType: mode, ...expected }));
      });
    }
  });
  describe('value fields of an Integral query (AB#7921)', () => {
    const integralQuery = { rtId: 'q-int', name: 'Netzbezug Energie', ckTypeId: 'System/AggregationSdQuery' };

    it('lists the _integral column, probing the board window because Integral needs from/to', async () => {
      const boardWindow = { from: new Date('2026-10-30T00:00:00Z'), to: new Date('2026-10-31T00:00:00Z') };
      queryExecutor.fetchStreamDataColumns.mockResolvedValue([
        { attributePath: 'importpower_integral', attributeValueType: 'DOUBLE', aggregationType: 'INTEGRAL' }
      ]);
      await open([kpi('self')], { initialDataSourceType: 'persistentQuery' as never });
      vi.spyOn(stateService, 'resolveStreamDataTimeArgs').mockReturnValue(boardWindow);

      await component.onQuerySelected(integralQuery);

      expect(component.queryColumns.map(c => c.attributePath)).toEqual(['importpower_integral']);
      expect(queryExecutor.fetchStreamDataColumns).toHaveBeenCalledWith('q-int', boardWindow);
    });

    it('probes the last 24 hours when the board has no time filter', async () => {
      queryExecutor.fetchStreamDataColumns.mockResolvedValue([]);
      await open([kpi('self')], { initialDataSourceType: 'persistentQuery' as never });
      vi.spyOn(stateService, 'resolveStreamDataTimeArgs').mockReturnValue(undefined);

      await component.onQuerySelected(integralQuery);

      const probe = queryExecutor.fetchStreamDataColumns.mock.calls[0][1] as { from: Date; to: Date };
      expect(probe.to.getTime() - probe.from.getTime()).toBe(24 * 60 * 60 * 1000);
    });
  });
});
