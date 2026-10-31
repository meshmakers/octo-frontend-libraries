import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CkModelService } from '@meshmakers/octo-services';
import { GaugeWidgetComponent } from './gauge-widget.component';
import { KpiWidgetComponent } from '../kpi-widget/kpi-widget.component';
import { DashboardDataService } from '../../services/meshboard-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { QueryExecutorService } from '../../services/query-executor.service';
import { AnyWidgetConfig, GaugeWidgetConfig, KpiWidgetConfig, MeshBoardConfig } from '../../models/meshboard.models';
import { NON_FINITE_FORMULA_REASON } from '../../utils/meshboard-formula';

/**
 * Gauge in formula mode (AB#7950): same engine and rules as the KPI formula, the result
 * must be a number, the pointer clamps to the scale and the label shows the real value.
 */
describe('GaugeWidgetComponent — formula mode (AB#7950)', () => {
  let fixture: ComponentFixture<GaugeWidgetComponent>;
  let component: GaugeWidgetComponent;
  let stateService: MeshBoardStateService;
  let queryExecutor: { execute: ReturnType<typeof vi.fn> };
  let dataService: { fetchEntityWithAssociations: ReturnType<typeof vi.fn> };

  function gauge(overrides: Partial<GaugeWidgetConfig> = {}): GaugeWidgetConfig {
    return {
      id: 'gauge-1',
      type: 'gauge',
      title: 'Gauge',
      col: 1,
      row: 1,
      colSpan: 1,
      rowSpan: 1,
      gaugeType: 'arc',
      valueAttribute: '',
      min: 0,
      max: 100,
      dataSource: { type: 'static' },
      valueMode: 'formula',
      ...overrides
    };
  }

  function board(widgets: AnyWidgetConfig[]): MeshBoardConfig {
    return {
      id: 'board',
      name: 'Board',
      columns: 6,
      rowHeight: 200,
      gap: 16,
      widgets,
      variables: [
        { name: 'import', type: 'number', source: 'static', value: '30' },
        { name: 'consumption', type: 'number', source: 'static', value: '120' }
      ]
    };
  }

  function render(config: GaugeWidgetConfig, widgets: AnyWidgetConfig[] = [config]): void {
    stateService.setConfig(board(widgets));
    fixture = TestBed.createComponent(GaugeWidgetComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  beforeEach(() => {
    queryExecutor = { execute: vi.fn() };
    dataService = { fetchEntityWithAssociations: vi.fn() };
    TestBed.configureTestingModule({
      imports: [GaugeWidgetComponent, KpiWidgetComponent],
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } },
        { provide: DashboardDataService, useValue: dataService },
        { provide: QueryExecutorService, useValue: queryExecutor }
      ]
    });
    stateService = TestBed.inject(MeshBoardStateService);
  });

  const AUTARKY = 'max(0, min(100, (1 - ${import} / ${consumption}) * 100))';

  it('computes the value from the formula without loading data', () => {
    render(gauge({ formula: AUTARKY }));

    expect(component.numericValue()).toBe(75);
    expect(component.pointerValue()).toBe(75);
    expect(component.formattedValue()).toBe('75');
    expect(component.formulaError()).toBeNull();
    expect(queryExecutor.execute).not.toHaveBeenCalled();
    expect(dataService.fetchEntityWithAssociations).not.toHaveBeenCalled();
  });

  it('shows the same value as a KPI with the same formula, and both follow a variable change', () => {
    const formula = '(${consumption} - ${import}) / 3';
    const kpi: KpiWidgetConfig = {
      id: 'kpi-1', type: 'kpi', title: 'KPI', col: 1, row: 1, colSpan: 1, rowSpan: 1,
      valueAttribute: '', dataSource: { type: 'static' }, valueMode: 'formula', formula
    };
    const gaugeConfig = gauge({ formula });
    render(gaugeConfig, [gaugeConfig, kpi]);
    const kpiFixture = TestBed.createComponent(KpiWidgetComponent);
    kpiFixture.componentRef.setInput('config', kpi);
    kpiFixture.detectChanges();

    expect(component.numericValue()).toBe(30);
    expect(kpiFixture.componentInstance.rawValue()).toBe(30);

    stateService.setVariableValue('import', '60');
    fixture.detectChanges();
    kpiFixture.detectChanges();

    expect(component.numericValue()).toBe(20);
    expect(kpiFixture.componentInstance.rawValue()).toBe(20);
    expect(text()).toContain('20');
  });

  it('follows a value published by another widget (output variable)', () => {
    render(gauge({ formula: '${share} * 100' }));
    expect(component.formattedValue()).toBe('-');

    stateService.setWidgetVariable('kpi-x', 'share', '0.42');
    fixture.detectChanges();

    expect(component.numericValue()).toBe(42);
    expect(text()).toContain('42');
  });

  it('shows "-" and no error while a referenced variable has no value', () => {
    render(gauge({ formula: '${notYet} * 2' }));

    expect(component.formulaError()).toBeNull();
    expect(component.hasValue()).toBe(false);
    expect(component.formattedValue()).toBe('-');
    expect(component.pointerValue()).toBe(0);
    expect(text()).toContain('-');
  });

  it('shows the widget error state for a syntax error', () => {
    render(gauge({ formula: '${import} *' }));

    expect(component.formulaError()).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.error-message')?.textContent?.trim())
      .toBe(component.formulaError());
  });

  it('shows "Result is not a number" for a non-numeric result', () => {
    render(gauge({ formula: '${import} > 1 ? "high" : "low"' }));

    expect(component.formulaError()).toBe('Result is not a number');
    expect(text()).toContain('Result is not a number');
  });

  it('shows "-" with the reason as tooltip for a division by zero, no error', () => {
    stateService.setConfig(board([]));
    stateService.setVariableValue('consumption', '0');
    const config = gauge({ formula: '${import} / ${consumption}' });
    fixture = TestBed.createComponent(GaugeWidgetComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();

    expect(component.formulaError()).toBeNull();
    expect(component.formattedValue()).toBe('-');
    expect(component.valueTooltip()).toBe(NON_FINITE_FORMULA_REASON);
    const label = (fixture.nativeElement as HTMLElement).querySelector('.value-text');
    expect(label?.getAttribute('title')).toBe(NON_FINITE_FORMULA_REASON);
  });

  it('clamps the pointer at the scale end and shows the real value in the label', () => {
    render(gauge({ formula: '${consumption} * 2', gaugeType: 'radial' }));

    expect(component.numericValue()).toBe(240);
    expect(component.pointerValue()).toBe(100);
    expect(text()).toContain('240');
  });

  it('clamps below the scale start too, also on a reversed min/max', () => {
    render(gauge({ formula: '-${import}' }));
    expect(component.pointerValue()).toBe(0);
    expect(component.formattedValue()).toBe('-30');

    render(gauge({ formula: '${consumption}', min: 50, max: 10 }));
    expect(component.pointerValue()).toBe(50);
  });

  it('re-evaluates when the formula in the config changes', () => {
    render(gauge({ formula: '${import}' }));
    expect(component.numericValue()).toBe(30);

    fixture.componentRef.setInput('config', gauge({ formula: '${consumption}' }));
    fixture.detectChanges();

    expect(component.numericValue()).toBe(120);
  });

  it('is "not configured" while the formula is empty', () => {
    render(gauge({ formula: '  ' }));

    expect(component.isNotConfigured()).toBe(true);
  });

  it('renders a linear gauge only once there is a value', () => {
    render(gauge({ formula: '${missing}', gaugeType: 'linear' }));
    expect((fixture.nativeElement as HTMLElement).querySelector('kendo-lineargauge')).toBeNull();

    stateService.setWidgetVariable('kpi-x', 'missing', '5');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('kendo-lineargauge')).not.toBeNull();
  });

  describe('existing gauges are unchanged', () => {
    it('reads a static entity value as before (widget-group child)', () => {
      render(gauge({
        valueMode: undefined,
        valueAttribute: 'level',
        dataSource: { type: 'static', data: { rtId: 'e', ckTypeId: 't', attributes: [{ attributeName: 'level', value: '64.5' }] } }
      }));

      expect(component.numericValue()).toBe(64.5);
      expect(component.pointerValue()).toBe(64.5);
      expect(component.formattedValue()).toBe('64,5');
      expect(component.valueTooltip()).toBeNull();
    });

    it('ignores a stored formula when not in formula mode', () => {
      render(gauge({
        valueMode: undefined,
        formula: '${import}',
        valueAttribute: 'level',
        dataSource: { type: 'static', data: { rtId: 'e', ckTypeId: 't', attributes: [{ attributeName: 'level', value: 7 }] } }
      }));

      expect(component.numericValue()).toBe(7);
    });
  });
});
