import { TestBed } from '@angular/core/testing';
import { ExpressionEvaluatorService, ProcessDiagramConfig, SymbolLibraryService } from '@meshmakers/octo-process-diagrams';
import { ProcessWidgetComponent } from './process-widget.component';
import { BoundDataResult, ProcessDataService, QueryResultData } from './services/process-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { DiagramPropertyMapping, ProcessWidgetConfig } from './process-widget-config.model';
import { RuntimeEntityData } from '../../models/meshboard.models';

/**
 * Process Widget aggregation per mapped value (AB#8024): sum / avg / min / max
 * over all rows of a query binding's selector scope, the expression applied to
 * the aggregate, no value for an empty scope, a partial scope warned once, and
 * the fallback to the first row for a runtime-entity binding or a non-number
 * property. Mappings without `aggregate` read the first row as before.
 *
 * Every property moves one rectangle by `transform.offsetX`; the property
 * default is 99, so "no value" (offset 0, effect skipped) is distinguishable
 * from "default" (99).
 */
describe('ProcessWidgetComponent — aggregation (AB#8024)', () => {
  let loadBindings: ReturnType<typeof vi.fn>;
  let warn: ReturnType<typeof vi.spyOn>;

  const numberProps = ['devicesPower', 'devicesFirst', 'socAvg'];

  function diagram(): ProcessDiagramConfig {
    const props = [...numberProps, 'online'];
    return {
      id: 'd1',
      name: 'Energiefluss',
      version: '1.0',
      canvas: { width: 400, height: 200 },
      elements: [],
      connections: [],
      primitives: props.map(id => ({
        id: `rect-${id}`,
        type: 'rectangle',
        name: id,
        position: { x: 0, y: 0 },
        config: { width: 10, height: 10 }
      })),
      transformProperties: [
        ...numberProps.map(id => ({ id, name: id, type: 'number', defaultValue: 99 })),
        { id: 'online', name: 'online', type: 'boolean', defaultValue: false }
      ],
      propertyBindings: [
        ...numberProps.map(id => ({
          propertyId: id,
          targetType: 'primitive',
          targetId: `rect-${id}`,
          effectType: 'transform.offsetX',
          expression: 'value'
        })),
        { propertyId: 'online', targetType: 'primitive', targetId: 'rect-online', effectType: 'transform.offsetX', expression: 'value ? 1 : 2' }
      ]
    } as unknown as ProcessDiagramConfig;
  }

  /** Seven appliances of the picked site, one with no reading and one with a text cell. */
  const appliancePower: unknown[] = [120, 2300, 45.5, null, 800, 'n/a', 15];

  function rows(values: unknown[], totalCount = values.length, column = 'activePower'): QueryResultData {
    return {
      columns: [{ attributePath: column }],
      rows: values.map(v => ({ cells: new Map<string, unknown>([[column, v]]) })),
      totalCount
    };
  }

  function query(name: string, result: QueryResultData): BoundDataResult {
    return { type: 'query', bindingName: name, queryResult: result, loadedAt: new Date() };
  }

  function entity(name: string, soc: number): BoundDataResult {
    const e = { rtId: 'bat', ckTypeId: 'Test/Battery', attributes: [{ attributeName: 'stateOfCharge', value: soc }] } as unknown as RuntimeEntityData;
    return { type: 'entity', bindingName: name, entity: e, loadedAt: new Date() };
  }

  function config(mappings: DiagramPropertyMapping[]): ProcessWidgetConfig {
    return {
      id: 'flow',
      type: 'process',
      title: 'Energiefluss',
      col: 1,
      row: 1,
      colSpan: 4,
      rowSpan: 3,
      dataSource: { type: 'static', data: null },
      inlineConfig: diagram(),
      bindings: [
        { name: 'geraete', mode: 'persistentQuery', queryRtId: 'q1', queryFamily: 'runtime', entitySelectorId: 'geraete' },
        { name: 'batterie', mode: 'runtimeEntity', ckTypeId: 'Test/Battery', entitySelectorId: 'batterie' }
      ],
      propertyMappings: mappings
    };
  }

  async function render(widgetConfig: ProcessWidgetConfig): Promise<ProcessWidgetComponent> {
    const fixture = TestBed.createComponent(ProcessWidgetComponent);
    fixture.componentInstance.config = widgetConfig;
    fixture.componentInstance.ngOnInit();
    await vi.waitFor(() => expect(loadBindings).toHaveBeenCalled());
    await fixture.whenStable();
    await new Promise(resolve => setTimeout(resolve));
    return fixture.componentInstance;
  }

  function offsets(component: ProcessWidgetComponent): Record<string, number> {
    return Object.fromEntries(component.boundPrimitives().map(p => [p.name, p.position.x]));
  }

  function warnings(): string[] {
    return warn.mock.calls.map((c: unknown[]) => String(c[0]));
  }

  beforeEach(() => {
    loadBindings = vi.fn();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: MeshBoardStateService, useValue: { getConfig: () => ({ entitySelectors: [{ id: 'geraete' }, { id: 'batterie' }] }) } },
        { provide: SymbolLibraryService, useValue: {} }
      ]
    });
    TestBed.overrideComponent(ProcessWidgetComponent, {
      set: {
        providers: [
          { provide: ProcessDataService, useValue: { loadBindings, loadRuntimeData: vi.fn().mockResolvedValue(null) } },
          ExpressionEvaluatorService
        ]
      }
    });
  });

  const devices = (aggregate: DiagramPropertyMapping['aggregate'], expression?: string): DiagramPropertyMapping => ({
    propertyId: 'devicesPower', sourceType: 'column', sourcePath: 'activePower', bindingName: 'geraete', aggregate, expression
  });

  it('sum: the property equals the sum of the numeric cells of all 7 appliances', async () => {
    loadBindings.mockResolvedValue(new Map([['geraete', query('geraete', rows(appliancePower))]]));

    const component = await render(config([devices('sum')]));

    expect(offsets(component)['devicesPower']).toBe(120 + 2300 + 45.5 + 800 + 15);
  });

  it.each([
    ['avg', (120 + 2300 + 45.5 + 800 + 15) / 5],
    ['min', 15],
    ['max', 2300]
  ] as const)('%s over the numeric cells, null and text cells skipped', async (aggregate, expected) => {
    loadBindings.mockResolvedValue(new Map([['geraete', query('geraete', rows(appliancePower))]]));

    const component = await render(config([devices(aggregate)]));

    expect(offsets(component)['devicesPower']).toBeCloseTo(expected, 10);
  });

  it('applies the mapping expression after the aggregation (sum, then value / 1000)', async () => {
    loadBindings.mockResolvedValue(new Map([['geraete', query('geraete', rows([1500, 2500, 1000]))]]));

    const component = await render(config([devices('sum', 'value / 1000')]));

    expect(offsets(component)['devicesPower']).toBe(5);
  });

  it('zero rows or no numeric cell: the property gets no value (not 0, not the default)', async () => {
    loadBindings.mockResolvedValueOnce(new Map([['geraete', query('geraete', rows([], 0))]]));
    const component = await render(config([devices('sum')]));
    // Effect skipped: the rectangle stays at its own position, neither 0-valued flow nor default 99.
    expect(offsets(component)['devicesPower']).toBe(0);

    loadBindings.mockResolvedValueOnce(new Map([['geraete', query('geraete', rows([null, 'n/a']))]]));
    component.refresh();
    await vi.waitFor(() => expect(loadBindings).toHaveBeenCalledTimes(2));
    await new Promise(resolve => setTimeout(resolve));
    expect(offsets(component)['devicesPower']).toBe(0);
  });

  it('a partial scope is still aggregated and warned once with the binding and the counts', async () => {
    loadBindings.mockResolvedValue(new Map([['geraete', query('geraete', rows([10, 20, 30], 1200))]]));

    const component = await render(config([devices('sum')]));
    // Read the values several times (every computed re-evaluation) — still one warning.
    offsets(component);
    offsets(component);

    expect(offsets(component)['devicesPower']).toBe(60);
    const partial = warnings().filter(w => w.includes("binding 'geraete'") && w.includes('covers 3 of 1200 rows'));
    expect(partial).toHaveLength(1);
  });

  it('a mapping without aggregate (and with first) reads the first row, as before', async () => {
    loadBindings.mockResolvedValue(new Map([['geraete', query('geraete', rows([120, 2300, 15]))]]));

    const component = await render(config([
      { propertyId: 'devicesFirst', sourceType: 'column', sourcePath: 'activePower', bindingName: 'geraete' },
      devices('first')
    ]));

    expect(offsets(component)['devicesFirst']).toBe(120);
    expect(offsets(component)['devicesPower']).toBe(120);
    expect(warnings().filter(w => w.includes('aggregate') || w.includes('Aggregate'))).toEqual([]);
  });

  it('one binding gives the sum of power and the average of another column', async () => {
    const result: QueryResultData = {
      columns: [{ attributePath: 'activePower' }, { attributePath: 'stateOfCharge' }],
      rows: [
        { cells: new Map<string, unknown>([['activePower', 100], ['stateOfCharge', 40]]) },
        { cells: new Map<string, unknown>([['activePower', 300], ['stateOfCharge', 80]]) }
      ],
      totalCount: 2
    };
    loadBindings.mockResolvedValue(new Map([['geraete', query('geraete', result)]]));

    const component = await render(config([
      devices('sum'),
      { propertyId: 'socAvg', sourceType: 'column', sourcePath: 'stateOfCharge', bindingName: 'geraete', aggregate: 'avg' }
    ]));

    expect(offsets(component)['devicesPower']).toBe(400);
    expect(offsets(component)['socAvg']).toBe(60);
  });

  it('runtime-entity binding: aggregate is reported by the validator and the entity value is used', async () => {
    loadBindings.mockResolvedValue(new Map([['batterie', entity('batterie', 63)]]));

    const component = await render(config([
      { propertyId: 'socAvg', sourceType: 'attribute', sourcePath: 'stateOfCharge', bindingName: 'batterie', aggregate: 'avg' }
    ]));

    expect(offsets(component)['socAvg']).toBe(63);
    expect(warnings().filter(w => w.includes("Aggregate 'avg' needs a persistent query binding"))).toHaveLength(1);
  });

  it('non-number property: aggregate is reported and the first row is used', async () => {
    loadBindings.mockResolvedValue(new Map([['geraete', query('geraete', rows([0, 1, 1], 3, 'online'))]]));

    const component = await render(config([
      { propertyId: 'online', sourceType: 'column', sourcePath: 'online', bindingName: 'geraete', aggregate: 'max' }
    ]));

    // First row 0 → false → offset 2; an applied max (1 → true) would give 1.
    expect(offsets(component)['online']).toBe(2);
    expect(warnings().filter(w => w.includes("Aggregate 'max' needs a number property, not 'boolean'"))).toHaveLength(1);
  });
});
