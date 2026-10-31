import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MeshBoardVariable } from '../../models/meshboard.models';
import { NON_FINITE_FORMULA_REASON } from '../../utils/meshboard-formula';
import { FormulaFieldComponent } from './formula-field.component';

describe('FormulaFieldComponent (AB#7950)', () => {
  let fixture: ComponentFixture<FormulaFieldComponent>;
  let component: FormulaFieldComponent;

  const variables: MeshBoardVariable[] = [
    { name: 'a', type: 'number', source: 'static', value: '5000' },
    { name: 'b', type: 'number', source: 'static', value: '2000' },
    { name: 'consumption', type: 'number', source: 'widget', value: '10', widgetId: 'w' }
  ];

  function render(formula: string, inputs: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(FormulaFieldComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('formula', formula);
    fixture.componentRef.setInput('variables', variables);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return element().textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FormulaFieldComponent] });
  });

  it('shows the preview of a valid formula', () => {
    render('(${a} - ${b}) / 1000');

    expect(component.validation().valid).toBe(true);
    expect(element().querySelector('.field-error')).toBeNull();
    expect(text()).toContain('Preview: 3');
  });

  it('shows the syntax error as alert', () => {
    render('${a} *');

    const error = element().querySelector('.field-error');
    expect(component.validation().valid).toBe(false);
    expect(error?.textContent?.trim()).toBe(component.validation().error);
    expect(error?.getAttribute('role')).toBe('alert');
  });

  it('names unknown variables, bare identifiers included', () => {
    render('${a} + ${missing} + x');

    expect(element().querySelector('.field-error')?.textContent?.trim()).toBe('Unknown variables: missing, x');
  });

  it('accepts a declared name without value and previews it as pending', () => {
    render('${loading} * 2', { declaredNames: ['loading'] });

    expect(component.validation().valid).toBe(true);
    expect(text()).toContain('Preview: - (a referenced variable has no value yet)');
  });

  it('previews a division by zero as "-" with the reason', () => {
    render('${a} / 0');

    expect(component.validation().valid).toBe(true);
    expect(component.preview()).toBe(`- (${NON_FINITE_FORMULA_REASON})`);
  });

  it('previews a non-numeric result as error when the widget needs a number', () => {
    render('${a} > 1 ? "on" : "off"', { numericOnly: true });
    expect(component.preview()).toBe('Result is not a number');

    fixture.componentRef.setInput('numericOnly', false);
    expect(component.preview()).toBe('on');
  });

  it('shows no message for an empty formula, but Save stays blocked', () => {
    render('');

    expect(element().querySelector('.field-error')).toBeNull();
    expect(text()).not.toContain('Preview');
    expect(component.validation().valid).toBe(false);
  });

  it('shows the clamp pattern only when asked', () => {
    render('${a}');
    expect(text()).not.toContain('max(0, min(100, …))');

    fixture.componentRef.setInput('clampHint', true);
    fixture.detectChanges();
    expect(text()).toContain('max(0, min(100, …))');
  });

  it('inserts a variable reference and updates the two-way formula', () => {
    render('1 +');
    const emitted: string[] = [];
    component.formula.subscribe(value => emitted.push(value));

    const button = Array.from(element().querySelectorAll('button')).find(b => b.textContent?.includes('consumption'));
    button?.click();
    fixture.detectChanges();

    expect(component.formula()).toBe('1 + ${consumption}');
    expect(emitted).toEqual(['1 + ${consumption}']);
    expect(button?.textContent).toContain('(widget)');
  });

  it('links the label to the input and describes it by hint and message (keyboard / screen reader)', async () => {
    render('${a}');
    // Kendo applies inputAttributes once the zone is stable
    fixture.ngZone?.run(() => undefined);
    await fixture.whenStable();

    const label = element().querySelector('label');
    const input = element().querySelector('input');
    expect(input).not.toBeNull();
    expect(label?.getAttribute('for')).toBe(input?.id);
    expect(input?.getAttribute('aria-required')).toBe('true');
    expect(input?.getAttribute('aria-describedby')).toBe(`${component.hintId} ${component.messageId}`);
    expect(element().querySelector(`#${component.messageId}`)).not.toBeNull();
  });

  it('variable buttons are plain buttons in the tab order', () => {
    render('${a}');

    const buttons = Array.from(element().querySelectorAll('.variable-list button'));
    expect(buttons.map(b => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['a', 'b', 'consumption(widget)']);
    for (const button of buttons) {
      expect(button.getAttribute('type')).toBe('button');
      expect(button.getAttribute('tabindex')).not.toBe('-1');
    }
  });

  it('says how to get variables when there are none', () => {
    fixture = TestBed.createComponent(FormulaFieldComponent);
    fixture.detectChanges();

    expect(text()).toContain('No variables defined.');
  });
});
