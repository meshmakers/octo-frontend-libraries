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

  function groupChildValue(value: unknown, decimalPlaces?: number): KpiWidgetConfig {
    return kpi({
      valueAttribute: 'value',
      decimalPlaces,
      dataSource: {
        type: 'static',
        data: { rtId: 'e', ckTypeId: 'T', attributes: [{ attributeName: 'value', value }], associations: [] }
      }
    });
  }

  describe('strict number parsing with decimalPlaces (AB#7686)', () => {
    const plain = (shown: string): string => shown.replace(/[\u00a0\u202f]/g, ' ');
    const cases: [string, string, string][] = [
      ['12 kWh', '12 kWh', '12'],
      ['2024-05-01T10:00:00Z', '2024-05-01T10:00:00Z', '2 024'],
      ['1e3', '1 000,0', '1 000'],
      [' 12 ', '12,0', '12'],
      ['-', '-', '-'],
      ['n/a', 'n/a', 'n/a'],
      ['12,5', '12,5', '12'],
      ['  ', '  ', '  '],
      ['Infinity', 'Infinity', '∞']
    ];

    for (const [input, withDecimals, unset] of cases) {
      it(`shows "${input}" as "${withDecimals}" with 1 decimal and as before when unset`, () => {
        render(kpi({ staticValue: input, decimalPlaces: 1 }));
        expect(plain(component.value())).toBe(withDecimals);

        render(kpi({ staticValue: input }));
        expect(plain(component.value())).toBe(unset);
      });
    }

    it('shows an empty value as a dash', () => {
      render(kpi({ staticValue: '', decimalPlaces: 1 }));
      expect(component.value()).toBe('-');
    });

    it('formats numbers given as numbers with 0 to 3 digits', () => {
      const digits = ['12', '12,3', '12,35', '12,346'];
      for (let decimalPlaces = 0; decimalPlaces <= 3; decimalPlaces++) {
        render(groupChildValue(12.3456, decimalPlaces));
        expect(component.value()).toBe(digits[decimalPlaces]);
      }
    });

    async function renderQueryCell(cellValue: unknown, overrides: Partial<KpiWidgetConfig>): Promise<void> {
      queryExecutor.execute.mockReturnValue(of({
        totalCount: 1,
        columns: [],
        rows: [{ __typename: 'RtAggregationQueryRow', cells: [{ attributePath: 'amount_sum', value: cellValue }] }]
      }));
      render(kpi({
        dataSource: { type: 'persistentQuery', queryRtId: 'q-1' },
        queryMode: 'aggregation',
        queryValueField: 'amount_sum',
        ...overrides
      }));
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('keeps a query cell text with decimalPlaces and parses it leniently when unset', async () => {
      await renderQueryCell('12 kWh', { decimalPlaces: 1 });
      expect(plain(component.value())).toBe('12 kWh');

      await renderQueryCell('12 kWh', {});
      expect(plain(component.value())).toBe('12');
    });

    it('applies the multiplier to a numeric query cell given as text with decimalPlaces', async () => {
      await renderQueryCell('9418.39', { decimalPlaces: 1, valueMultiplier: 2 });
      expect(plain(component.value())).toBe('18 836,8');
    });
  });

  describe('widget-group child with entity data (AB#7686)', () => {
    function groupChild(value: unknown, overrides: Partial<KpiWidgetConfig> = {}): KpiWidgetConfig {
      return kpi({
        valueAttribute: 'value',
        labelAttribute: 'name',
        dataSource: {
          type: 'static',
          data: {
            rtId: 'entity-1',
            ckTypeId: 'TestType',
            attributes: [
              { attributeName: 'value', value },
              { attributeName: 'name', value: 'Machine 1' }
            ],
            associations: []
          }
        },
        ...overrides
      });
    }

    it('shows the value from the entity data', () => {
      render(groupChild(38.9));
      expect(component.value()).toBe('38,90');

      render(groupChild(46));
      expect(component.value()).toBe('46');
    });

    it('applies decimalPlaces to the entity value', () => {
      render(groupChild(38.9, { decimalPlaces: 1 }));
      expect(component.value()).toBe('38,9');
      expect(text()).toContain('38,9');

      render(groupChild(46, { decimalPlaces: 1 }));
      expect(component.value()).toBe('46,0');
    });

    it('shows the label from labelAttribute', () => {
      render(groupChild(46));

      expect(component.label()).toBe('Machine 1');
    });

    it('shows a dash when the value attribute is missing', () => {
      render(groupChild(46, { valueAttribute: 'missing' }));

      expect(component.value()).toBe('-');
    });

    it('keeps the static value path for a KPI without entity data', () => {
      render(kpi({ staticValue: '${a}', decimalPlaces: 1 }));

      expect(component.rawValue()).toBe('5000');
      expect(component.value()).toMatch(/^5\D?000,0$/);
    });
  });

  describe('decimalPlaces (AB#7686)', () => {
    it('shows exactly the configured number of fraction digits', () => {
      render(kpi({ staticValue: '38.9', decimalPlaces: 1 }));

      expect(component.value()).toBe('38,9');
    });

    it('rounds to the configured number of fraction digits', () => {
      render(kpi({ staticValue: '52.649', decimalPlaces: 1 }));

      expect(component.value()).toBe('52,6');
    });

    it('pads a whole number to the configured number of fraction digits', () => {
      render(kpi({ staticValue: '46', decimalPlaces: 1 }));

      expect(component.value()).toBe('46,0');
    });

    it('pads zero to the configured number of fraction digits', () => {
      render(kpi({ staticValue: '0', decimalPlaces: 1 }));

      expect(component.value()).toBe('0,0');
    });

    it('shows no fraction digits when set to zero', () => {
      render(kpi({ staticValue: '38.9', decimalPlaces: 0 }));

      expect(component.value()).toBe('39');
    });

    it('applies to formula values', () => {
      render(kpi({ valueMode: 'formula', formula: '${b} / ${a} * 100', decimalPlaces: 1 }));

      expect(component.value()).toBe('40,0');
    });

    it('keeps two fraction digits for a decimal value when unset', () => {
      render(kpi({ staticValue: '38.9' }));

      expect(component.value()).toBe('38,90');
    });

    it('keeps no fraction digits for a whole number when unset', () => {
      render(kpi({ staticValue: '46' }));

      expect(component.value()).toBe('46');
    });

    it('keeps zero without fraction digits when unset', () => {
      render(kpi({ staticValue: '0' }));

      expect(component.value()).toBe('0');
    });

    it('falls back to the default for an invalid setting', () => {
      render(kpi({ staticValue: '38.9', decimalPlaces: -1 }));

      expect(component.value()).toBe('38,90');
    });

    it('falls back to the default for a non-integer setting', () => {
      render(kpi({ staticValue: '38.9', decimalPlaces: 1.5 }));

      expect(component.value()).toBe('38,90');
    });

    it('falls back to the default for a setting above 3', () => {
      render(kpi({ staticValue: '38.9', decimalPlaces: 4 }));

      expect(component.value()).toBe('38,90');
    });

    it('accepts the upper limit of 3', () => {
      render(kpi({ staticValue: '46', decimalPlaces: 3 }));

      expect(component.value()).toBe('46,000');
    });

    it('shows a negative value that rounds to zero without a sign', () => {
      render(kpi({ staticValue: '-0.04', decimalPlaces: 1 }));
      expect(component.value()).toBe('0,0');

      render(kpi({ staticValue: '-0.3', decimalPlaces: 0 }));
      expect(component.value()).toBe('0');
    });

    it('shows a negative zero input without a sign', () => {
      render(kpi({ staticValue: '-0', decimalPlaces: 1 }));
      expect(component.value()).toBe('0,0');

      render(kpi({ staticValue: '-0', decimalPlaces: 0 }));
      expect(component.value()).toBe('0');
    });

    it('keeps the sign of a negative value that does not round to zero', () => {
      render(kpi({ staticValue: '-3.25', decimalPlaces: 1 }));

      expect(component.value()).toBe('-3,3');
    });

    it('shows positive zero with the configured digits', () => {
      render(kpi({ staticValue: '0', decimalPlaces: 1 }));

      expect(component.value()).toBe('0,0');
    });

    it('keeps the automatic format for a negative value when unset', () => {
      render(kpi({ staticValue: '-0.04' }));

      expect(component.value()).toBe('-0,04');
    });

    it('falls back to the default for extreme or invalid settings without an error', () => {
      for (const decimalPlaces of [4, 6, 10, 20, 21, 100, 101, 1e21, Infinity, NaN]) {
        render(kpi({ staticValue: '38.9', decimalPlaces }));
        expect(component.value()).toBe('38,90');
      }
    });

    it('formats extreme values with 0 to 3 digits without NaN or Infinity text', () => {
      const values = ['1e21', '1e-7', '-1e21', String(Number.MAX_SAFE_INTEGER)];
      for (const staticValue of values) {
        for (let decimalPlaces = 0; decimalPlaces <= 3; decimalPlaces++) {
          render(kpi({ staticValue, decimalPlaces }));
          const shown = component.value();
          expect(shown).not.toMatch(/NaN|Infinity/);
          const fraction = decimalPlaces === 0 ? '' : `,[0-9]{${decimalPlaces}}`;
          expect(shown).toMatch(new RegExp(`^-?[0-9 \u00a0\u202f]+${fraction}$`));
        }
      }
      render(kpi({ staticValue: '1e-7', decimalPlaces: 3 }));
      expect(component.value()).toBe('0,000');
      render(kpi({ staticValue: '-1e-7', decimalPlaces: 1 }));
      expect(component.value()).toBe('0,0');
    });

    it('leaves a missing value and text untouched', () => {
      render(kpi({ staticValue: '', decimalPlaces: 1 }));
      expect(component.value()).toBe('-');

      render(kpi({ staticValue: 'n/a', decimalPlaces: 1 }));
      expect(component.value()).toBe('n/a');
    });
  });
});
