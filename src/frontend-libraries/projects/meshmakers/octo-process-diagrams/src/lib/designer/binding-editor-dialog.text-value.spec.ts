/**
 * Binding editor: the "Text value" effect (AB#8022) — offered only for text
 * targets, format fields with defaults from the property, live preview in
 * de-AT / en-GB / no value, saved into the binding's `textFormat`.
 */
import { TestBed } from '@angular/core/testing';
import { BindingEditorDialogComponent } from './binding-editor-dialog.component';
import { ExpressionEvaluatorService } from '../services/expression-evaluator.service';
import { PrimitiveBase } from '../primitives/models/primitive.models';
import { PropertyBinding, TransformProperty } from '../primitives/models/transform-property.models';

describe('BindingEditorDialogComponent — text value (AB#8022)', () => {
  const pvPower: TransformProperty = { id: 'pvPower', name: 'pvPower', type: 'number', defaultValue: 14.425, unit: 'kW' };
  const primitives = [
    { id: 'txt-pv-value', type: 'text', name: 'PV value', position: { x: 0, y: 0 }, config: { content: '0 kW' } },
    { id: 'rect-pv', type: 'rectangle', name: 'PV box', position: { x: 0, y: 0 }, config: { width: 10, height: 10 } }
  ] as unknown as PrimitiveBase[];

  let dialog: BindingEditorDialogComponent;
  let saved: PropertyBinding[] | undefined;

  function open(bindings: PropertyBinding[] = []): void {
    dialog.primitives = primitives;
    dialog.existingBindings = bindings;
    dialog.property = pvPower;
    dialog.show = true;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ExpressionEvaluatorService] });
    dialog = TestBed.runInInjectionContext(() => new BindingEditorDialogComponent());
    saved = undefined;
    dialog.saved.subscribe(b => (saved = b));
  });

  const groups = (binding: PropertyBinding): string[] => dialog.effectGroupsFor(binding).map(g => g.name);

  it('offers the group "Text" with "Text value" only for a text target', () => {
    open();
    const onText = { propertyId: 'pvPower', targetType: 'primitive', targetId: 'txt-pv-value', effectType: 'visible', expression: 'value' } as PropertyBinding;
    const onRect = { ...onText, targetId: 'rect-pv' };
    const onSymbol = { ...onText, targetType: 'symbolInstance', targetId: 'node-1' } as PropertyBinding;

    expect(groups(onText)).toContain('Text');
    expect(dialog.effectGroupsFor(onText).find(g => g.name === 'Text')?.effects).toEqual([{ value: 'text.value', label: 'Text value' }]);
    expect(groups(onRect)).not.toContain('Text');
    expect(groups(onSymbol)).not.toContain('Text');
  });

  it('choosing "Text value" sets the defaults: property unit, 0 decimals, "–"', () => {
    open();
    dialog.addBinding();
    dialog.updateBinding(0, 'target', 'primitive:txt-pv-value');
    dialog.updateBinding(0, 'effectType', 'text.value');

    expect(dialog.bindings()[0].textFormat).toEqual({ unit: 'kW', decimals: 0, noValueText: String.fromCharCode(0x2013) });
  });

  it('previews the sample value in de-AT and en-GB and the no-value text', () => {
    open([{ propertyId: 'pvPower', targetType: 'primitive', targetId: 'txt-pv-value', effectType: 'text.value', expression: 'value', textFormat: { unit: 'kW', decimals: 1, noValueText: '–' } }]);
    const binding = dialog.bindings()[0];

    expect(dialog.previewInputValue()).toBe(14.425);
    expect(dialog.textPreview(binding, 'de-AT')).toBe('14,4 kW');
    expect(dialog.textPreview(binding, 'en-GB')).toBe('14.4 kW');
    expect(dialog.textPreview(binding, 'de-AT', true)).toBe('–');
  });

  it('edits unit, decimals (clamped 0–6) and no-value text and saves them', () => {
    open([{ propertyId: 'pvPower', targetType: 'primitive', targetId: 'txt-pv-value', effectType: 'text.value', expression: 'abs(value)', textFormat: { unit: 'kW', decimals: 0 } }]);

    dialog.updateTextFormat(0, 'unit', 'W');
    dialog.updateTextFormat(0, 'decimals', '9');
    dialog.updateTextFormat(0, 'noValueText', 'n/a');
    dialog.save();

    expect(saved?.[0].textFormat).toEqual({ unit: 'W', decimals: 6, noValueText: 'n/a' });
    expect(dialog.decimalOptions).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('moving the binding to a non-text target or another effect drops the text format', () => {
    open([{ propertyId: 'pvPower', targetType: 'primitive', targetId: 'txt-pv-value', effectType: 'text.value', expression: 'value', textFormat: { unit: 'kW' } }]);
    dialog.updateBinding(0, 'target', 'primitive:rect-pv');
    expect(dialog.bindings()[0].effectType).toBe('dimension.width');
    expect(dialog.bindings()[0].textFormat).toBeUndefined();

    dialog.updateBinding(0, 'target', 'primitive:txt-pv-value');
    dialog.updateBinding(0, 'effectType', 'text.value');
    dialog.updateBinding(0, 'effectType', 'visible');
    expect(dialog.bindings()[0].textFormat).toBeUndefined();
  });

  it('existing bindings of other effects are saved unchanged (no textFormat added)', () => {
    const legacy: PropertyBinding = { propertyId: 'pvPower', targetType: 'primitive', targetId: 'rect-pv', effectType: 'transform.offsetX', expression: 'value' };
    open([legacy]);
    dialog.save();
    expect(saved).toEqual([legacy]);
  });
});
