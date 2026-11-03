/**
 * `text.value` bindings in the editor previews (AB#8022): the designer's
 * diagram simulation, the designer's symbol preview and the symbol editor
 * simulation replace the text with the formatted value; an emptied simulation
 * field shows "–", other effects behave as before.
 *
 * The components are large; the binding methods only need the evaluator and
 * the binding/property state, so the specs call them on a prototype instance
 * with exactly that state instead of rendering the whole editor.
 */
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ProcessDesignerComponent } from './process-designer.component';
import { SymbolEditorComponent } from '../admin/symbol-editor.component';
import { SimulationPanelComponent } from './simulation-panel.component';
import { ExpressionEvaluatorService } from '../services/expression-evaluator.service';
import { PrimitiveBase } from '../primitives/models/primitive.models';
import { PropertyBinding, TransformProperty } from '../primitives/models/transform-property.models';
import { SymbolDefinition } from '../primitives/models/symbol.model';

const NO_VALUE = String.fromCharCode(0x2013);

const text = (id: string): PrimitiveBase => ({
  id, type: 'text', name: id, position: { x: 0, y: 0 }, config: { content: 'static' }
} as unknown as PrimitiveBase);

const rect = (id: string): PrimitiveBase => ({
  id, type: 'rectangle', name: id, position: { x: 0, y: 0 }, config: { width: 10, height: 10 }
} as unknown as PrimitiveBase);

const content = (primitives: PrimitiveBase[], id: string): string =>
  (primitives.find(p => p.id === id) as unknown as { config: { content: string } }).config.content;

const properties: TransformProperty[] = [
  { id: 'pvPower', name: 'pvPower', type: 'number', defaultValue: 0, unit: 'kW' },
  { id: 'gridPower', name: 'gridPower', type: 'number', defaultValue: 0, unit: 'kW' }
];

const bindings: PropertyBinding[] = [
  { propertyId: 'pvPower', targetType: 'primitive', targetId: 'txt-pv-value', effectType: 'text.value', expression: 'value', textFormat: { unit: 'kW', decimals: 1, noValueText: NO_VALUE } },
  { propertyId: 'gridPower', targetType: 'primitive', targetId: 'txt-grid-flow', effectType: 'text.value', expression: 'abs(value)', textFormat: { decimals: 1 } },
  { propertyId: 'gridPower', targetType: 'primitive', targetId: 'rect-grid', effectType: 'transform.offsetX', expression: 'value' }
];

describe('text value in the editor previews (AB#8022)', () => {
  let evaluator: ExpressionEvaluatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ExpressionEvaluatorService] });
    evaluator = TestBed.inject(ExpressionEvaluatorService);
  });

  describe('designer diagram simulation', () => {
    function designer(simValues: Record<string, unknown>): { apply(p: PrimitiveBase[]): PrimitiveBase[] } {
      const instance = Object.create(ProcessDesignerComponent.prototype) as Record<string, unknown>;
      instance['expressionEvaluator'] = evaluator;
      instance['_diagramTransformProperties'] = signal(properties);
      instance['_diagramPropertyBindings'] = signal(bindings);
      instance['_diagramSimulationValues'] = signal(simValues);
      const method = instance['applyDiagramBindingsToPrimitives'] as (p: PrimitiveBase[]) => PrimitiveBase[];
      return { apply: p => method.call(instance, p) };
    }

    const primitives = (): PrimitiveBase[] => [text('txt-pv-value'), text('txt-grid-flow'), rect('rect-grid')];

    it('shows the simulated value formatted (de-AT), the connection text as absolute value', () => {
      const shown = designer({ pvPower: 14.425, gridPower: -1.84 }).apply(primitives());
      expect(content(shown, 'txt-pv-value')).toBe('14,4 kW');
      expect(content(shown, 'txt-grid-flow')).toBe('1,8 kW');
      expect(shown.find(p => p.id === 'rect-grid')?.transform?.offsetX).toBe(-1.84);
    });

    it('an emptied simulation field shows "–", an untouched one the formatted default', () => {
      const shown = designer({ pvPower: null }).apply(primitives());
      expect(content(shown, 'txt-pv-value')).toBe(NO_VALUE);
      expect(content(shown, 'txt-grid-flow')).toBe('0,0 kW');
    });

    it('leaves the stored primitives untouched', () => {
      const stored = primitives();
      designer({ pvPower: 3 }).apply(stored);
      expect(content(stored, 'txt-pv-value')).toBe('static');
    });
  });

  describe('designer symbol preview', () => {
    it('formats a text inside a symbol from the instance property values', () => {
      const instance = Object.create(ProcessDesignerComponent.prototype) as Record<string, unknown>;
      instance['expressionEvaluator'] = evaluator;
      const definition = {
        rtId: 's', name: 's', version: '1', bounds: { width: 10, height: 10 },
        primitives: [text('txt-pv-value')], transformProperties: properties, propertyBindings: bindings
      } as unknown as SymbolDefinition;
      const method = instance['applyPropertyBindingsToPrimitives'] as (p: PrimitiveBase[], d: SymbolDefinition, v: Record<string, unknown>) => PrimitiveBase[];

      expect(content(method.call(instance, definition.primitives, definition, { pvPower: 2.25 }), 'txt-pv-value')).toBe('2,3 kW');
      expect(content(method.call(instance, definition.primitives, definition, { pvPower: undefined }), 'txt-pv-value')).toBe(NO_VALUE);
    });
  });

  describe('symbol editor simulation', () => {
    it('formats the text live and shows "–" for an emptied field', () => {
      const instance = Object.create(SymbolEditorComponent.prototype) as Record<string, unknown>;
      instance['expressionEvaluator'] = evaluator;
      const method = instance['applyBindingsToPrimitive'] as (p: PrimitiveBase, props: TransformProperty[], b: PropertyBinding[], v: Record<string, unknown>) => PrimitiveBase;
      const read = (p: PrimitiveBase): string => (p as unknown as { config: { content: string } }).config.content;

      expect(read(method.call(instance, text('txt-pv-value'), properties, bindings, { pvPower: 1234.5 })).replace(/[\u00a0\u202f]/g, ' ')).toBe('1 234,5 kW');
      expect(read(method.call(instance, text('txt-pv-value'), properties, bindings, { pvPower: null }))).toBe(NO_VALUE);
    });
  });

  describe('simulation panel number field', () => {
    it('emits null for an emptied field and the number otherwise', () => {
      const panel = Object.create(SimulationPanelComponent.prototype) as SimulationPanelComponent;
      const emitted: unknown[] = [];
      Object.assign(panel, {
        _localValues: signal<Record<string, unknown>>({}),
        valueChange: { emit: (e: { value: unknown }) => emitted.push(e.value) }
      });

      panel.onNumberInput('pvPower', '');
      panel.onNumberInput('pvPower', '14.425');
      panel.onNumberInput('pvPower', 'abc');

      expect(emitted).toEqual([null, 14.425, null]);
    });
  });
});
