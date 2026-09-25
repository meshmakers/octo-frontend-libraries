import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CkModelService } from '@meshmakers/octo-services';
import { KpiWidgetComponent } from './kpi-widget.component';
import { DashboardDataService } from '../../services/meshboard-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { QueryExecutorService } from '../../services/query-executor.service';
import { KpiWidgetConfig, MeshBoardConfig } from '../../models/meshboard.models';

describe('KpiWidgetComponent — formula and output variables (AB#5364)', () => {
  let fixture: ComponentFixture<KpiWidgetComponent>;
  let component: KpiWidgetComponent;
  let stateService: MeshBoardStateService;
  let queryExecutor: { execute: ReturnType<typeof vi.fn> };

  function kpi(overrides: Partial<KpiWidgetConfig> = {}): KpiWidgetConfig {
    return {
      id: 'kpi-1',
      type: 'kpi',
      title: 'KPI',
      col: 1,
      row: 1,
      colSpan: 1,
      rowSpan: 1,
      valueAttribute: '',
      dataSource: { type: 'static' },
      ...overrides
    };
  }

  function board(widgets: KpiWidgetConfig[]): MeshBoardConfig {
    return {
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
    };
  }

  function render(config: KpiWidgetConfig, widgets: KpiWidgetConfig[] = [config]): void {
    stateService.setConfig(board(widgets));
    fixture = TestBed.createComponent(KpiWidgetComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  beforeEach(() => {
    queryExecutor = { execute: vi.fn() };
    TestBed.configureTestingModule({
      imports: [KpiWidgetComponent],
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } },
        { provide: DashboardDataService, useValue: {} },
        { provide: QueryExecutorService, useValue: queryExecutor }
      ]
    });
    stateService = TestBed.inject(MeshBoardStateService);
  });

  it('computes the formula value', () => {
    render(kpi({ valueMode: 'formula', formula: '(${a} - ${b}) / 1000' }));

    expect(component.rawValue()).toBe(3);
    expect(text()).toContain('3');
  });

  it('reacts to variable changes', () => {
    render(kpi({ valueMode: 'formula', formula: '${a} / 1000' }));
    expect(component.rawValue()).toBe(5);

    stateService.setVariableValue('a', '8000');
    fixture.detectChanges();

    expect(component.rawValue()).toBe(8);
  });

  it('shows "-" while a referenced variable is missing', () => {
    render(kpi({ valueMode: 'formula', formula: '${unknown} * 2' }));

    expect(component.value()).toBe('-');
    expect(component.formulaError()).toBeNull();
  });

  it('shows the error of an invalid formula', () => {
    render(kpi({ valueMode: 'formula', formula: '${a} / 0' }));

    expect(component.formulaError()).toBeTruthy();
    expect(text()).toContain(component.formulaError() as string);
  });

  it('publishes the raw value as output variable', () => {
    render(kpi({ valueMode: 'formula', formula: '${a} - ${b}', outputVariableName: 'diff' }));

    expect(stateService.getVariable('diff')).toEqual(
      expect.objectContaining({ value: '3000', source: 'widget', widgetId: 'kpi-1' })
    );
  });

  it('chains a published value into another formula', () => {
    const producer = kpi({ id: 'p', valueMode: 'formula', formula: '${a} - ${b}', outputVariableName: 'diff' });
    const consumer = kpi({ id: 'c', valueMode: 'formula', formula: '${diff} * 2' });
    render(producer, [producer, consumer]);

    const consumerFixture = TestBed.createComponent(KpiWidgetComponent);
    consumerFixture.componentRef.setInput('config', consumer);
    consumerFixture.detectChanges();

    expect(consumerFixture.componentInstance.rawValue()).toBe(6000);

    stateService.setVariableValue('a', '3000');
    fixture.detectChanges();
    consumerFixture.detectChanges();

    expect(consumerFixture.componentInstance.rawValue()).toBe(2000);
  });

  it('clears the output variable on destroy', () => {
    render(kpi({ valueMode: 'formula', formula: '${a}', outputVariableName: 'out' }));
    expect(stateService.getVariable('out')).toBeDefined();

    fixture.destroy();

    expect(stateService.getVariable('out')).toBeUndefined();
  });

  it('clears the output variable when the name is removed', () => {
    render(kpi({ valueMode: 'formula', formula: '${a}', outputVariableName: 'out' }));

    fixture.componentRef.setInput('config', kpi({ valueMode: 'formula', formula: '${a}' }));
    fixture.detectChanges();

    expect(stateService.getVariable('out')).toBeUndefined();
  });

  it('refuses to evaluate a widget in a circular reference', () => {
    const a = kpi({ id: 'A', valueMode: 'formula', formula: '${outB} + 1', outputVariableName: 'outA' });
    const b = kpi({ id: 'B', valueMode: 'formula', formula: '${outA} + 1', outputVariableName: 'outB' });
    render(a, [a, b]);

    expect(component.formulaError()).toBe('Circular variable reference');
    expect(stateService.getVariable('outA')).toBeUndefined();
  });

  it('publishes a query value after applying the value multiplier', async () => {
    queryExecutor.execute.mockReturnValue(of({ totalCount: 10, rows: [], columns: [] }));
    render(kpi({
      dataSource: { type: 'persistentQuery', queryRtId: 'q-1' },
      queryMode: 'simpleCount',
      valueMultiplier: 0.5,
      outputVariableName: 'half'
    }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(stateService.getVariable('half')?.value).toBe('5');
  });

  it('keeps the last value during a refresh and clears it when the refresh fails', async () => {
    queryExecutor.execute.mockReturnValue(of({ totalCount: 10, rows: [], columns: [] }));
    render(kpi({
      dataSource: { type: 'persistentQuery', queryRtId: 'q-1' },
      queryMode: 'simpleCount',
      outputVariableName: 'count'
    }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(stateService.getVariable('count')?.value).toBe('10');

    queryExecutor.execute.mockReturnValue(throwError(() => new Error('boom')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    component.refresh();
    fixture.detectChanges();
    expect(component.isLoading()).toBe(true);
    expect(stateService.getVariable('count')?.value).toBe('10');

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).toBeTruthy();
    expect(stateService.getVariable('count')).toBeUndefined();
  });

  it('keeps the existing static value behaviour', () => {
    render(kpi({ staticValue: '${a}' }));

    expect(component.rawValue()).toBe('5000');
  });
});
