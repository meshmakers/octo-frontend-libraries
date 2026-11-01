import { TestBed } from '@angular/core/testing';
import { ExpressionEvaluatorService, ProcessDiagramConfig, SymbolLibraryService } from '@meshmakers/octo-process-diagrams';
import { ProcessWidgetComponent } from './process-widget.component';
import { BoundDataResult, ProcessDataService, QueryResultData } from './services/process-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { DiagramPropertyMapping, ProcessWidgetConfig } from './process-widget-config.model';
import { RuntimeEntityData } from '../../models/meshboard.models';

/**
 * Process Widget with several named bindings (AB#8023): every mapped property
 * takes its value from its own binding; a pending binding does not blank the
 * others; a failing binding is named in the error badge; an unknown binding
 * name is reported once; a legacy widget behaves as before.
 *
 * The diagram has one rectangle per property, moved by `transform.offsetX`
 * by the property value, so `boundPrimitives()` shows which value arrived.
 */
describe('ProcessWidgetComponent — named bindings (AB#8023)', () => {
  let loadBindings: ReturnType<typeof vi.fn>;

  const properties = ['grid', 'pv', 'soc'];

  function diagram(): ProcessDiagramConfig {
    return {
      id: 'd1',
      name: 'Energiefluss',
      version: '1.0',
      canvas: { width: 400, height: 200 },
      elements: [],
      connections: [],
      primitives: properties.map(id => ({
        id: `rect-${id}`,
        type: 'rectangle',
        name: id,
        position: { x: 0, y: 0 },
        config: { width: 10, height: 10 }
      })),
      transformProperties: properties.map(id => ({ id, name: id, type: 'number', defaultValue: 0 })),
      propertyBindings: properties.map(id => ({
        propertyId: id,
        targetType: 'primitive',
        targetId: `rect-${id}`,
        effectType: 'transform.offsetX',
        expression: 'value'
      }))
    } as unknown as ProcessDiagramConfig;
  }

  function rows(value: number): QueryResultData {
    return { columns: [{ attributePath: 'power' }], rows: [{ cells: new Map<string, unknown>([['power', value]]) }], totalCount: 1 };
  }

  function queryResult(name: string, value: number): BoundDataResult {
    return { type: 'query', bindingName: name, queryResult: rows(value), loadedAt: new Date() };
  }

  function entityResult(name: string, soc: number): BoundDataResult {
    const entity = { rtId: 'bat', ckTypeId: 'Test/Battery', attributes: [{ attributeName: 'stateOfCharge', value: soc }] } as unknown as RuntimeEntityData;
    return { type: 'entity', bindingName: name, entity, loadedAt: new Date() };
  }

  const mappings: DiagramPropertyMapping[] = [
    { propertyId: 'grid', sourceType: 'column', sourcePath: 'power', bindingName: 'netz' },
    { propertyId: 'pv', sourceType: 'column', sourcePath: 'power', bindingName: 'pv' },
    { propertyId: 'soc', sourceType: 'attribute', sourcePath: 'stateOfCharge', bindingName: 'batterie' }
  ];

  function config(overrides: Partial<ProcessWidgetConfig> = {}): ProcessWidgetConfig {
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
        { name: 'netz', mode: 'persistentQuery', queryRtId: 'q1', entitySelectorId: 'netz' },
        { name: 'pv', mode: 'persistentQuery', queryRtId: 'q2', entitySelectorId: 'pv' },
        { name: 'batterie', mode: 'runtimeEntity', ckTypeId: 'Test/Battery', entitySelectorId: 'batterie' }
      ],
      propertyMappings: mappings,
      ...overrides
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

  beforeEach(() => {
    loadBindings = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MeshBoardStateService, useValue: { getConfig: () => ({ entitySelectors: [{ id: 'netz' }, { id: 'pv' }, { id: 'batterie' }] }) } },
        { provide: SymbolLibraryService, useValue: {} }
      ]
    });
    TestBed.overrideComponent(ProcessWidgetComponent, {
      set: {
        providers: [
          {
            provide: ProcessDataService,
            useValue: { loadBindings, loadRuntimeData: vi.fn().mockResolvedValue(null) }
          },
          ExpressionEvaluatorService
        ]
      }
    });
  });

  it('gives every mapped property the value of its own binding', async () => {
    loadBindings.mockResolvedValue(new Map([
      ['netz', queryResult('netz', 2)],
      ['pv', queryResult('pv', 14)],
      ['batterie', entityResult('batterie', 63)]
    ]));

    const component = await render(config());

    expect(offsets(component)).toEqual({ grid: 2, pv: 14, soc: 63 });
    expect(component.isLoading()).toBe(false);
    expect(component.bindingErrors()).toEqual([]);
  });

  it('a pending binding keeps its default, the others render', async () => {
    loadBindings.mockResolvedValue(new Map([
      ['netz', queryResult('netz', 2)],
      ['pv', { type: 'query', bindingName: 'pv', pending: true, loadedAt: new Date() } as BoundDataResult],
      ['batterie', entityResult('batterie', 63)]
    ]));

    const component = await render(config());

    expect(offsets(component)).toEqual({ grid: 2, pv: 0, soc: 63 });
    expect(component.isLoading()).toBe(false);
  });

  it('stays loading only while every binding is pending', async () => {
    const pending = (name: string) => ({ type: 'query', bindingName: name, pending: true, loadedAt: new Date() } as BoundDataResult);
    loadBindings.mockResolvedValue(new Map([['netz', pending('netz')], ['pv', pending('pv')], ['batterie', pending('batterie')]]));

    const component = await render(config());

    expect(component.isLoading()).toBe(true);
  });

  it('an empty scope gives no value (default), never the value of a previous load', async () => {
    loadBindings.mockResolvedValueOnce(new Map([['netz', queryResult('netz', 2)], ['pv', queryResult('pv', 14)], ['batterie', entityResult('batterie', 63)]]));
    const component = await render(config());
    expect(offsets(component)).toEqual({ grid: 2, pv: 14, soc: 63 });

    // Leader switched to a site without PV: empty rows for pv, entity-less result for batterie.
    loadBindings.mockResolvedValueOnce(new Map([
      ['netz', queryResult('netz', 4)],
      ['pv', { type: 'query', bindingName: 'pv', queryResult: { columns: [], rows: [], totalCount: 0 }, loadedAt: new Date() } as BoundDataResult],
      ['batterie', { type: 'entity', bindingName: 'batterie', loadedAt: new Date() } as BoundDataResult]
    ]));
    component.refresh();
    await vi.waitFor(() => expect(loadBindings).toHaveBeenCalledTimes(2));
    await new Promise(resolve => setTimeout(resolve));

    expect(offsets(component)).toEqual({ grid: 4, pv: 0, soc: 0 });
  });

  it('names a failing binding in the error badge and renders the others', async () => {
    loadBindings.mockResolvedValue(new Map([
      ['netz', queryResult('netz', 2)],
      ['pv', { type: 'query', bindingName: 'pv', error: 'Query failed', loadedAt: new Date() } as BoundDataResult],
      ['batterie', entityResult('batterie', 63)]
    ]));

    const component = await render(config());

    expect(offsets(component)).toEqual({ grid: 2, pv: 0, soc: 63 });
    expect(component.bindingErrors()).toEqual([{ name: 'pv', message: 'Query failed' }]);
    expect(component.bindingErrorText()).toBe('Binding pv: Query failed');
    expect(component.error()).toBeNull();
  });

  it('reports a mapping with an unknown binding once and leaves the property at its default', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    loadBindings.mockResolvedValue(new Map([['netz', queryResult('netz', 2)], ['pv', queryResult('pv', 14)], ['batterie', entityResult('batterie', 63)]]));
    const widgetConfig = config({ propertyMappings: [...mappings.slice(0, 2), { ...mappings[2], bindingName: 'speicher' }] });

    const component = await render(widgetConfig);
    component.refresh();
    await vi.waitFor(() => expect(loadBindings).toHaveBeenCalledTimes(2));

    expect(offsets(component)['soc']).toBe(0);
    const unknown = warn.mock.calls.filter(c => String(c[0]).includes("unknown binding 'speicher'"));
    expect(unknown.length).toBe(1);
  });

  /**
   * Connections (flow lines PV→Haus, Netz↔Haus, …) are line primitives driven by
   * `propertyBindings`. Direction comes from the sign of the bound value: two flow
   * animations (forward / reverse) gated by `animation.enabled`, plus two arrow
   * lines (markerEnd / markerStart) toggled by `visible`, a colour by sign and
   * `visible` for the line itself — 0 or no value = hidden / neutral.
   * The value comes from the SECOND binding (`netz`), not the first (`pv`).
   */
  describe('connections driven by any binding (AB#8023, wireframe approval)', () => {
    function connectionDiagram(): ProcessDiagramConfig {
      const line = (id: string, extra: Record<string, unknown> = {}) => ({
        id,
        type: 'line',
        name: id,
        position: { x: 0, y: 0 },
        style: { stroke: { color: '#888888', width: 2 } },
        config: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
        ...extra
      });
      return {
        id: 'd2',
        name: 'Energiefluss',
        version: '1.0',
        canvas: { width: 400, height: 200 },
        elements: [],
        connections: [],
        primitives: [
          line('grid-line', {
            animations: [
              { id: 'toHouse', animation: { type: 'animate', attributeName: 'stroke-dashoffset', from: '15', to: '0', dur: '0.5s', repeatCount: 'indefinite' } },
              { id: 'toGrid', animation: { type: 'animate', attributeName: 'stroke-dashoffset', from: '0', to: '15', dur: '0.5s', repeatCount: 'indefinite' } }
            ]
          }),
          line('grid-arrow-house', { config: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, markerEnd: 'arrow' } }),
          line('grid-arrow-grid', { config: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, markerStart: 'arrow' } })
        ],
        transformProperties: [
          { id: 'pvPower', name: 'PV', type: 'number', defaultValue: 0 },
          { id: 'gridPower', name: 'Netz', type: 'number', defaultValue: 0 }
        ],
        propertyBindings: [
          { propertyId: 'gridPower', targetType: 'primitive', targetId: 'grid-line', effectType: 'animation.enabled', animationId: 'toHouse', expression: 'value > 0' },
          { propertyId: 'gridPower', targetType: 'primitive', targetId: 'grid-line', effectType: 'animation.enabled', animationId: 'toGrid', expression: 'value < 0' },
          { propertyId: 'gridPower', targetType: 'primitive', targetId: 'grid-line', effectType: 'visible', expression: 'value != 0' },
          { propertyId: 'gridPower', targetType: 'primitive', targetId: 'grid-line', effectType: 'style.stroke.color', expression: "value > 0 ? '#c62828' : (value < 0 ? '#2e7d32' : '#888888')" },
          { propertyId: 'gridPower', targetType: 'primitive', targetId: 'grid-arrow-house', effectType: 'visible', expression: 'value > 0' },
          { propertyId: 'gridPower', targetType: 'primitive', targetId: 'grid-arrow-grid', effectType: 'visible', expression: 'value < 0' }
        ]
      } as unknown as ProcessDiagramConfig;
    }

    function connectionConfig(): ProcessWidgetConfig {
      return config({
        inlineConfig: connectionDiagram(),
        bindings: [
          { name: 'pv', mode: 'persistentQuery', queryRtId: 'q-pv', entitySelectorId: 'pv' },
          { name: 'netz', mode: 'persistentQuery', queryRtId: 'q-netz', entitySelectorId: 'netz' }
        ],
        propertyMappings: [
          { propertyId: 'pvPower', sourceType: 'column', sourcePath: 'power', bindingName: 'pv' },
          { propertyId: 'gridPower', sourceType: 'column', sourcePath: 'power', bindingName: 'netz' }
        ]
      });
    }

    function line(component: ProcessWidgetComponent, id: string) {
      const p = component.boundPrimitives().find(x => x.id === id)!;
      return { visible: p.visible, stroke: p.style?.stroke?.color };
    }

    it('import (positive value of the second binding): flow and arrow towards the house', async () => {
      loadBindings.mockResolvedValue(new Map([['pv', queryResult('pv', 6)], ['netz', queryResult('netz', 2.5)]]));

      const component = await render(connectionConfig());

      expect(component.animationEnabledStates()).toEqual({ 'grid-line:toHouse': true, 'grid-line:toGrid': false });
      expect(line(component, 'grid-line')).toEqual({ visible: true, stroke: '#c62828' });
      expect(line(component, 'grid-arrow-house').visible).toBe(true);
      expect(line(component, 'grid-arrow-grid').visible).toBe(false);
    });

    it('export (negative value): reverse flow and arrow towards the grid', async () => {
      loadBindings.mockResolvedValue(new Map([['pv', queryResult('pv', 6)], ['netz', queryResult('netz', -3.1)]]));

      const component = await render(connectionConfig());

      expect(component.animationEnabledStates()).toEqual({ 'grid-line:toHouse': false, 'grid-line:toGrid': true });
      expect(line(component, 'grid-line')).toEqual({ visible: true, stroke: '#2e7d32' });
      expect(line(component, 'grid-arrow-house').visible).toBe(false);
      expect(line(component, 'grid-arrow-grid').visible).toBe(true);
    });

    it('zero: no flow, line hidden and neutral', async () => {
      loadBindings.mockResolvedValue(new Map([['pv', queryResult('pv', 6)], ['netz', queryResult('netz', 0)]]));

      const component = await render(connectionConfig());

      expect(component.animationEnabledStates()).toEqual({ 'grid-line:toHouse': false, 'grid-line:toGrid': false });
      expect(line(component, 'grid-line')).toEqual({ visible: false, stroke: '#888888' });
      expect(line(component, 'grid-arrow-house').visible).toBe(false);
      expect(line(component, 'grid-arrow-grid').visible).toBe(false);
    });

    it('no value (second binding pending or empty): no flow, line hidden — even when the first binding has data', async () => {
      loadBindings.mockResolvedValueOnce(new Map([
        ['pv', queryResult('pv', 6)],
        ['netz', { type: 'query', bindingName: 'netz', pending: true, loadedAt: new Date() } as BoundDataResult]
      ]));
      const pending = await render(connectionConfig());

      expect(pending.animationEnabledStates()).toEqual({ 'grid-line:toHouse': false, 'grid-line:toGrid': false });
      expect(line(pending, 'grid-line').visible).toBe(false);

      loadBindings.mockResolvedValueOnce(new Map([
        ['pv', queryResult('pv', 6)],
        ['netz', { type: 'query', bindingName: 'netz', queryResult: { columns: [], rows: [], totalCount: 0 }, loadedAt: new Date() } as BoundDataResult]
      ]));
      const empty = await render(connectionConfig());

      expect(empty.animationEnabledStates()).toEqual({ 'grid-line:toHouse': false, 'grid-line:toGrid': false });
      expect(line(empty, 'grid-line').visible).toBe(false);
    });

    it('a leader switch from import to export flips the direction in one refresh', async () => {
      loadBindings.mockResolvedValueOnce(new Map([['pv', queryResult('pv', 6)], ['netz', queryResult('netz', 2.5)]]));
      const component = await render(connectionConfig());
      expect(component.animationEnabledStates()['grid-line:toHouse']).toBe(true);

      loadBindings.mockResolvedValueOnce(new Map([['pv', queryResult('pv', 9)], ['netz', queryResult('netz', -1)]]));
      component.refresh();
      await vi.waitFor(() => expect(loadBindings).toHaveBeenCalledTimes(2));
      await new Promise(resolve => setTimeout(resolve));

      expect(component.animationEnabledStates()).toEqual({ 'grid-line:toHouse': false, 'grid-line:toGrid': true });
      expect(line(component, 'grid-arrow-grid').visible).toBe(true);
    });

    it('a legacy diagram drives the same connection effects from its single binding unchanged', async () => {
      loadBindings.mockResolvedValue(new Map([['default', queryResult('default', -2)]]));

      const component = await render(config({
        inlineConfig: connectionDiagram(),
        bindings: undefined,
        dataBindingMode: 'persistentQuery',
        bindingQueryRtId: 'q-netz',
        propertyMappings: [{ propertyId: 'gridPower', sourceType: 'column', sourcePath: 'power' }]
      }));

      expect(component.animationEnabledStates()).toEqual({ 'grid-line:toHouse': false, 'grid-line:toGrid': true });
      expect(line(component, 'grid-line')).toEqual({ visible: true, stroke: '#2e7d32' });
    });
  });

  describe('legacy single-binding widget', () => {
    function legacyConfig(): ProcessWidgetConfig {
      return config({
        bindings: undefined,
        dataBindingMode: 'persistentQuery',
        bindingQueryRtId: 'q1',
        propertyMappings: [{ propertyId: 'grid', sourceType: 'column', sourcePath: 'power' }]
      });
    }

    it('maps mappings without bindingName from the default binding', async () => {
      loadBindings.mockResolvedValue(new Map([['default', queryResult('default', 5)]]));

      const component = await render(legacyConfig());

      expect(offsets(component)).toEqual({ grid: 5, pv: 0, soc: 0 });
      expect(component.boundData()?.queryResult?.rows.length).toBe(1);
    });

    it('stays loading while its binding is pending (as before)', async () => {
      loadBindings.mockResolvedValue(new Map([['default', { type: 'query', pending: true, loadedAt: new Date() } as BoundDataResult]]));

      const component = await render(legacyConfig());

      expect(component.isLoading()).toBe(true);
    });

    it('shows no error badge for a failed binding (as before)', async () => {
      loadBindings.mockResolvedValue(new Map([['default', { type: 'query', error: 'boom', loadedAt: new Date() } as BoundDataResult]]));

      const component = await render(legacyConfig());

      expect(component.bindingErrors()).toEqual([]);
      expect(offsets(component)['grid']).toBe(0);
    });
  });
});
