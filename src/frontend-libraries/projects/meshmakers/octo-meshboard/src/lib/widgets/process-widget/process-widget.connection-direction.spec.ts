import { TestBed } from '@angular/core/testing';
import { ExpressionEvaluatorService, ProcessDiagramConfig, SymbolLibraryService } from '@meshmakers/octo-process-diagrams';
import { ProcessWidgetComponent } from './process-widget.component';
import { BoundDataResult, ProcessDataService, QueryResultData } from './services/process-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { ProcessConnectionDirection, ProcessWidgetConfig } from './process-widget-config.model';

/**
 * Connection direction picked in the widget dialog (AB#8025): the direction
 * effects of a line follow the property the widget names, not the one the
 * stored diagram binds them to; the diagram itself stays unchanged.
 */
describe('ProcessWidgetComponent — connection directions (AB#8025)', () => {
  let loadBindings: ReturnType<typeof vi.fn>;

  function diagram(): ProcessDiagramConfig {
    return {
      id: 'd',
      name: 'Energiefluss',
      version: '1.0',
      canvas: { width: 400, height: 200 },
      elements: [],
      connections: [],
      primitives: [{
        id: 'grid-line',
        type: 'line',
        name: 'Netz ↔ Haus',
        position: { x: 0, y: 0 },
        style: { stroke: { color: '#888888', width: 2 } },
        config: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
        animations: [
          { id: 'fwd', animation: { type: 'animate', attributeName: 'stroke-dashoffset', from: '15', to: '0', dur: '0.5s', repeatCount: 'indefinite' } },
          { id: 'rev', animation: { type: 'animate', attributeName: 'stroke-dashoffset', from: '0', to: '15', dur: '0.5s', repeatCount: 'indefinite' } }
        ]
      }],
      transformProperties: [
        { id: 'gridPower', name: 'Netz', type: 'number', defaultValue: 0 },
        { id: 'gridSum', name: 'Netz Σ', type: 'number', defaultValue: 0 }
      ],
      propertyBindings: [
        { propertyId: 'gridPower', targetType: 'primitive', targetId: 'grid-line', effectType: 'animation.enabled', animationId: 'fwd', expression: 'value > 0' },
        { propertyId: 'gridPower', targetType: 'primitive', targetId: 'grid-line', effectType: 'animation.enabled', animationId: 'rev', expression: 'value < 0' },
        { propertyId: 'gridPower', targetType: 'primitive', targetId: 'grid-line', effectType: 'style.stroke.color', expression: "value > 0 ? '#c62828' : '#2e7d32'" }
      ]
    } as unknown as ProcessDiagramConfig;
  }

  function rows(value: number): QueryResultData {
    return { columns: [{ attributePath: 'power' }], rows: [{ cells: new Map<string, unknown>([['power', value]]) }], totalCount: 1 };
  }

  function result(name: string, value: number): BoundDataResult {
    return { type: 'query', bindingName: name, queryResult: rows(value), loadedAt: new Date() };
  }

  function config(connectionDirections?: ProcessConnectionDirection[]): ProcessWidgetConfig {
    return {
      id: 'flow', type: 'process', title: 'Energiefluss', col: 1, row: 1, colSpan: 4, rowSpan: 3,
      dataSource: { type: 'static', data: null },
      inlineConfig: diagram(),
      bindings: [
        { name: 'netz', mode: 'persistentQuery', queryRtId: 'q1' },
        { name: 'summe', mode: 'persistentQuery', queryRtId: 'q2' }
      ],
      propertyMappings: [
        { propertyId: 'gridPower', sourceType: 'column', sourcePath: 'power', bindingName: 'netz' },
        { propertyId: 'gridSum', sourceType: 'column', sourcePath: 'power', bindingName: 'summe' }
      ],
      ...(connectionDirections && { connectionDirections })
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

  beforeEach(() => {
    loadBindings = vi.fn().mockResolvedValue(new Map([['netz', result('netz', 2)], ['summe', result('summe', -4)]]));
    TestBed.configureTestingModule({
      providers: [
        { provide: MeshBoardStateService, useValue: { getConfig: () => ({ entitySelectors: [] }) } },
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

  it('without an override the line follows the property of the diagram', async () => {
    const component = await render(config());

    expect(component.animationEnabledStates()).toEqual({ 'grid-line:fwd': true, 'grid-line:rev': false });
    expect(component.boundPrimitives()[0].style?.stroke?.color).toBe('#c62828');
  });

  it('with an override the line follows the picked property (negative → reverse)', async () => {
    const component = await render(config([{ connectionId: 'grid-line', propertyId: 'gridSum' }]));

    expect(component.animationEnabledStates()).toEqual({ 'grid-line:fwd': false, 'grid-line:rev': true });
    expect(component.boundPrimitives()[0].style?.stroke?.color).toBe('#2e7d32');
  });

  it('ignores and reports an override of an unknown connection or property once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const component = await render(config([
      { connectionId: 'nope', propertyId: 'gridSum' },
      { connectionId: 'grid-line', propertyId: 'missing' }
    ]));

    expect(component.animationEnabledStates()).toEqual({ 'grid-line:fwd': true, 'grid-line:rev': false });
    const messages = warn.mock.calls.map(c => String(c[0]));
    expect(messages.filter(m => m.includes("unknown connection 'nope'"))).toHaveLength(1);
    expect(messages.filter(m => m.includes("unknown property 'missing'"))).toHaveLength(1);
  });
});
