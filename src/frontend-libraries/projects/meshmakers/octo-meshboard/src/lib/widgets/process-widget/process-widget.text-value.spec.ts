import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  ExpressionEvaluatorService,
  PrimitiveBase,
  ProcessDiagramConfig,
  SymbolDefinition,
  SymbolInstance,
  SymbolLibraryService
} from '@meshmakers/octo-process-diagrams';
import { ProcessWidgetComponent } from './process-widget.component';
import { BoundDataResult, ProcessDataService, QueryResultData } from './services/process-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { DiagramPropertyMapping, ProcessWidgetConfig } from './process-widget-config.model';
import { RuntimeEntityData } from '../../models/meshboard.models';
import { MESHBOARD_LANGUAGE } from '../../utils/meshboard-language';

/**
 * Process Widget `text.value` bindings (AB#8022): a text element shows the
 * live value with unit, decimals and the board language; "–" when there is no
 * value (no data yet, empty cell, missing attribute, non-numeric text) — never
 * 0 and never the static design-time text. A text on a connection shows the
 * absolute value via `abs(value)`, the arrow carries the sign. Diagrams without
 * a text.value binding render exactly as before.
 */
describe('ProcessWidgetComponent — text value (AB#8022)', () => {
  let loadBindings: ReturnType<typeof vi.fn>;
  const language = signal<string | null>(null);

  const text = (id: string, content: string): PrimitiveBase => ({
    id, type: 'text', name: id, position: { x: 10, y: 10 }, config: { content }
  } as unknown as PrimitiveBase);

  function diagram(withTextBindings = true): ProcessDiagramConfig {
    return {
      id: 'd1',
      name: 'Energiefluss',
      version: '1.0',
      canvas: { width: 400, height: 200 },
      elements: [],
      connections: [],
      primitives: [
        text('txt-pv-value', '0,0 kW (static)'),
        text('txt-grid-flow', 'grid (static)'),
        { id: 'line-grid', type: 'line', name: 'line-grid', position: { x: 0, y: 0 }, config: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } } } as unknown as PrimitiveBase
      ],
      symbolInstances: [],
      transformProperties: [
        { id: 'pvPower', name: 'pvPower', type: 'number', defaultValue: 0, unit: 'kW' },
        { id: 'gridPower', name: 'gridPower', type: 'number', defaultValue: 0, unit: 'kW' }
      ],
      propertyBindings: withTextBindings
        ? [
          { propertyId: 'pvPower', targetType: 'primitive', targetId: 'txt-pv-value', effectType: 'text.value', expression: 'value', textFormat: { unit: 'kW', decimals: 1, noValueText: '–' } },
          // Text on the grid connection: absolute value, the arrow direction carries the sign
          { propertyId: 'gridPower', targetType: 'primitive', targetId: 'txt-grid-flow', effectType: 'text.value', expression: 'abs(value)', textFormat: { unit: 'kW', decimals: 1 } },
          { propertyId: 'gridPower', targetType: 'primitive', targetId: 'line-grid', effectType: 'style.stroke.color', expression: "value >= 0 ? '#111111' : '#222222'" }
        ]
        : [
          { propertyId: 'pvPower', targetType: 'primitive', targetId: 'txt-pv-value', effectType: 'transform.offsetX', expression: 'value' }
        ]
    } as unknown as ProcessDiagramConfig;
  }

  function rows(column: string, values: unknown[]): QueryResultData {
    return {
      columns: [{ attributePath: column }],
      rows: values.map(v => ({ cells: new Map<string, unknown>([[column, v]]) })),
      totalCount: values.length
    };
  }

  const query = (name: string, result: QueryResultData): BoundDataResult =>
    ({ type: 'query', bindingName: name, queryResult: result, loadedAt: new Date() });

  function entity(name: string, attributes: { attributeName: string; value: unknown }[]): BoundDataResult {
    const e = { rtId: 'e1', ckTypeId: 'Test/Meter', attributes } as unknown as RuntimeEntityData;
    return { type: 'entity', bindingName: name, entity: e, loadedAt: new Date() };
  }

  const mappings: DiagramPropertyMapping[] = [
    { propertyId: 'pvPower', sourceType: 'column', sourcePath: 'power', bindingName: 'pv' },
    { propertyId: 'gridPower', sourceType: 'attribute', sourcePath: 'activePower', bindingName: 'netz' }
  ];

  function config(inline: ProcessDiagramConfig = diagram()): ProcessWidgetConfig {
    return {
      id: 'flow',
      type: 'process',
      title: 'Energiefluss',
      col: 1,
      row: 1,
      colSpan: 4,
      rowSpan: 3,
      dataSource: { type: 'static', data: null },
      inlineConfig: inline,
      bindings: [
        { name: 'pv', mode: 'persistentQuery', queryRtId: 'q1', queryFamily: 'runtime' },
        { name: 'netz', mode: 'runtimeEntity', ckTypeId: 'Test/Meter', rtId: 'e1' }
      ],
      propertyMappings: mappings
    };
  }

  async function render(widgetConfig: ProcessWidgetConfig = config()): Promise<ProcessWidgetComponent> {
    const fixture = TestBed.createComponent(ProcessWidgetComponent);
    fixture.componentInstance.config = widgetConfig;
    fixture.componentInstance.ngOnInit();
    await vi.waitFor(() => expect(loadBindings).toHaveBeenCalled());
    await fixture.whenStable();
    await new Promise(resolve => setTimeout(resolve));
    return fixture.componentInstance;
  }

  function contents(primitives: PrimitiveBase[]): Record<string, string> {
    return Object.fromEntries(primitives
      .filter(p => p.type === 'text')
      .map(p => [p.id, String((p as unknown as { config: { content: string } }).config.content)]));
  }

  const plain = (s: string): string => s.replace(/[\u00a0\u202f]/g, ' ');

  beforeEach(() => {
    language.set(null);
    loadBindings = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: MeshBoardStateService, useValue: { getConfig: () => ({ entitySelectors: [] }) } },
        { provide: SymbolLibraryService, useValue: {} },
        { provide: MESHBOARD_LANGUAGE, useValue: language }
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

  const liveData = (pv: unknown, grid: unknown): Map<string, BoundDataResult> => new Map([
    ['pv', query('pv', rows('power', [pv]))],
    ['netz', entity('netz', [{ attributeName: 'activePower', value: grid }])]
  ]);

  it('shows 14,4 kW for 14.425 with unit kW and 1 decimal when the host has no language (de-AT)', async () => {
    loadBindings.mockResolvedValue(liveData(14.425, 3.2));

    const component = await render();

    expect(contents(component.boundPrimitives())['txt-pv-value']).toBe('14,4 kW');
  });

  it('follows the host language: de-AT 14,4 kW, en-GB 14.4 kW, grouping per locale', async () => {
    loadBindings.mockResolvedValue(liveData(1234.5, 3.2));
    language.set('de-AT');
    const component = await render();
    expect(plain(contents(component.boundPrimitives())['txt-pv-value'])).toBe('1 234,5 kW');

    language.set('en-GB');
    expect(contents(component.boundPrimitives())['txt-pv-value']).toBe('1,234.5 kW');
  });

  it('a text on a connection shows the absolute value; the sign drives the line style, not the text', async () => {
    loadBindings.mockResolvedValue(liveData(6.3, -1.84));

    const component = await render();
    const primitives = component.boundPrimitives();

    expect(contents(primitives)['txt-grid-flow']).toBe('1,8 kW');
    const line = primitives.find(p => p.id === 'line-grid');
    expect(line?.style?.stroke?.color).toBe('#222222');
  });

  it('no bound data yet: the text shows "–", never the static design-time text', async () => {
    loadBindings.mockResolvedValue(new Map());

    const component = await render();

    expect(contents(component.boundPrimitives())).toEqual({ 'txt-pv-value': '–', 'txt-grid-flow': '–' });
  });

  it.each([
    ['an empty cell / null attribute', null, null],
    ['a non-numeric text', 'n/a', 'offline']
  ])('%s shows "–", never 0', async (_case, pv, grid) => {
    loadBindings.mockResolvedValue(liveData(pv, grid));

    const component = await render();

    expect(contents(component.boundPrimitives())).toEqual({ 'txt-pv-value': '–', 'txt-grid-flow': '–' });
  });

  it('a missing attribute shows "–"', async () => {
    loadBindings.mockResolvedValue(new Map([
      ['pv', query('pv', rows('power', [2]))],
      ['netz', entity('netz', [])]
    ]));

    const component = await render();

    expect(contents(component.boundPrimitives())).toEqual({ 'txt-pv-value': '2,0 kW', 'txt-grid-flow': '–' });
  });

  it('a diagram without a text.value binding renders exactly as before', async () => {
    const legacy = diagram(false);
    loadBindings.mockResolvedValue(new Map());
    const pending = await render(config(legacy));
    // No data: the very same primitives array, static texts included
    expect(pending.boundPrimitives()).toBe(legacy.primitives);

    loadBindings.mockResolvedValue(liveData(14.425, 3.2));
    const loaded = await render(config(legacy));
    const shown = loaded.boundPrimitives();
    expect(contents(shown)).toEqual({ 'txt-pv-value': '0,0 kW (static)', 'txt-grid-flow': 'grid (static)' });
    expect(shown.find(p => p.id === 'txt-pv-value')?.position.x).toBe(10 + 14.425);
    // Primitives without bindings are passed through untouched
    expect(shown.find(p => p.id === 'txt-grid-flow')).toBe(legacy.primitives![1]);
  });

  describe('text inside a symbol', () => {
    const definition = {
      rtId: 'sym-node',
      name: 'Node',
      version: '1.0.0',
      bounds: { width: 100, height: 50 },
      primitives: [text('txt-node-value', 'static')],
      transformProperties: [{ id: 'power', name: 'power', type: 'number', defaultValue: 0, unit: 'kW' }],
      propertyBindings: [
        { propertyId: 'power', targetType: 'primitive', targetId: 'txt-node-value', effectType: 'text.value', expression: 'value', textFormat: { decimals: 1 } }
      ]
    } as unknown as SymbolDefinition;
    const instance = { id: 'node-pv', symbolRtId: 'sym-node', position: { x: 0, y: 0 } } as unknown as SymbolInstance;

    function symbolDiagram(): ProcessDiagramConfig {
      const d = diagram();
      d.symbolInstances = [instance];
      d.propertyBindings = [
        ...(d.propertyBindings ?? []),
        { propertyId: 'pvPower', targetType: 'symbolInstance', targetId: 'node-pv', effectType: 'property', targetPropertyId: 'power', expression: 'value' }
      ];
      return d;
    }

    function symbolTexts(component: ProcessWidgetComponent): Record<string, string> {
      const internals = component as unknown as {
        _symbolDefinitions: { set(v: Map<string, SymbolDefinition>): void };
        getSymbolPrimitives(i: SymbolInstance): PrimitiveBase[];
      };
      internals._symbolDefinitions.set(new Map([['sym-node', definition]]));
      return contents(internals.getSymbolPrimitives(instance));
    }

    it('shows the passed value formatted with the symbol property unit', async () => {
      loadBindings.mockResolvedValue(liveData(14.425, 0));
      const component = await render(config(symbolDiagram()));
      expect(symbolTexts(component)).toEqual({ 'txt-node-value': '14,4 kW' });
    });

    it('shows "–" while the parent property has no value', async () => {
      loadBindings.mockResolvedValue(new Map());
      const component = await render(config(symbolDiagram()));
      expect(symbolTexts(component)).toEqual({ 'txt-node-value': '–' });
    });
  });
});
