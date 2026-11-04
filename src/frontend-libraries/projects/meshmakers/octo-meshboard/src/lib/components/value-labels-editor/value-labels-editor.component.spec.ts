import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ValueLabelRow } from '../../utils/chart-value-labels';
import { ValueLabelsEditorComponent } from './value-labels-editor.component';

describe('ValueLabelsEditorComponent (AB#7235)', () => {
  let fixture: ComponentFixture<ValueLabelsEditorComponent>;
  let component: ValueLabelsEditorComponent;

  const tick = () => new Promise<void>(resolve => setTimeout(resolve));

  function render(rows: ValueLabelRow[] = [], subject?: string): void {
    fixture = TestBed.createComponent(ValueLabelsEditorComponent);
    document.body.appendChild(fixture.nativeElement);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('rows', rows);
    if (subject) {
      fixture.componentRef.setInput('subject', subject);
    }
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rowElements(): HTMLElement[] {
    return Array.from(el().querySelectorAll<HTMLElement>('[data-value-label-row]'));
  }

  function inputs(row: HTMLElement): HTMLInputElement[] {
    return Array.from(row.querySelectorAll<HTMLInputElement>('input'));
  }

  function type(input: HTMLInputElement, text: string): void {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function click(selector: string, scope: ParentNode = el()): void {
    scope.querySelector<HTMLElement>(selector)?.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ValueLabelsEditorComponent] });
  });

  afterEach(() => {
    fixture?.nativeElement.remove();
  });

  it('shows a short hint instead of a blank area while the list is empty', () => {
    render();

    expect(rowElements().length).toBe(0);
    expect(el().querySelector('[data-value-labels-empty]')?.textContent).toContain('No names yet');
    expect(el().querySelector('[data-value-labels-action="add"]')?.textContent?.trim()).toBe('Add category name');
  });

  it('names the subject in the texts', () => {
    render([], 'series');

    expect(el().textContent).toContain('raw series value');
    expect(el().querySelector('[data-value-labels-action="add"]')?.textContent?.trim()).toBe('Add series name');
  });

  it('adds a row, focuses its value input and edits both fields', async () => {
    render();

    click('[data-value-labels-action="add"]');
    await tick();

    expect(component.rows().length).toBe(1);
    const [row] = rowElements();
    const [valueInput, nameInput] = inputs(row);
    expect(document.activeElement).toBe(valueInput);

    type(valueInput, '1-1:2.9.0 G.03');
    type(nameInput, 'Feed-in');
    expect(component.rows()).toEqual([{ id: 1, value: '1-1:2.9.0 G.03', label: 'Feed-in' }]);
    expect(el().querySelector('[data-value-labels-empty]')).toBeNull();
  });

  it('shows the rows it was given and keeps a row element while it is edited', async () => {
    render([{ id: 4, value: 'A1', label: 'Alpha' }, { id: 7, value: 'B2', label: 'Beta' }]);
    await tick();
    fixture.detectChanges();

    const before = rowElements();
    expect(inputs(before[0]).map(i => i.value)).toEqual(['A1', 'Alpha']);
    expect(inputs(before[1]).map(i => i.value)).toEqual(['B2', 'Beta']);

    type(inputs(before[0])[1], 'Alpha 2');

    expect(rowElements()[0]).toBe(before[0]);
    expect(component.rows()[0]).toEqual({ id: 4, value: 'A1', label: 'Alpha 2' });
    expect(component.rows()[1]).toEqual({ id: 7, value: 'B2', label: 'Beta' });
  });

  it('removes a row, moves the focus to the next row and to the add button after the last one', async () => {
    render([{ id: 1, value: 'A1', label: 'Alpha' }, { id: 2, value: 'B2', label: 'Beta' }]);

    click('.remove-button', rowElements()[0]);
    await tick();
    expect(component.rows().map(r => r.value)).toEqual(['B2']);
    expect(document.activeElement).toBe(inputs(rowElements()[0])[0]);

    click('.remove-button', rowElements()[0]);
    await tick();
    expect(component.rows()).toEqual([]);
    expect(document.activeElement).toBe(el().querySelector('[data-value-labels-action="add"]'));
    expect(el().querySelector('[data-value-labels-empty]')).not.toBeNull();
  });

  it('gives a row added after a removal a fresh id', () => {
    render([{ id: 1, value: 'A1', label: 'Alpha' }, { id: 2, value: 'B2', label: 'Beta' }]);

    click('.remove-button', rowElements()[0]);
    click('[data-value-labels-action="add"]');

    expect(component.rows().map(r => r.id)).toEqual([2, 3]);
  });

  it('puts the accessible names on the inner inputs, not on the textbox hosts', async () => {
    render([{ id: 1, value: 'A1', label: 'Alpha' }], 'series');
    await tick();
    fixture.detectChanges();

    const [row] = rowElements();
    const [valueInput, nameInput] = inputs(row);
    expect(valueInput.getAttribute('aria-label')).toBe('Series value, entry 1');
    expect(nameInput.getAttribute('aria-label')).toBe('Series name, entry 1');
    row.querySelectorAll('kendo-textbox').forEach(host => expect(host.hasAttribute('aria-label')).toBe(false));
    expect(row.querySelector('.remove-button')?.getAttribute('aria-label')).toBe('Remove series name, entry 1');
  });

  it('warns about a value that two complete rows list', () => {
    render([{ id: 1, value: 'A1', label: 'Alpha' }, { id: 2, value: 'A1', label: 'Again' }, { id: 3, value: 'B2', label: 'Beta' }]);

    const warning = el().querySelector('[data-value-labels-duplicates]');
    expect(warning?.textContent).toContain('Listed more than once: A1');
    expect(warning?.getAttribute('role')).toBe('status');
  });

  it('does not warn about an unfinished duplicate row', () => {
    render([{ id: 1, value: 'A1', label: 'Alpha' }, { id: 2, value: 'A1', label: '' }]);

    expect(el().querySelector('[data-value-labels-duplicates]')).toBeNull();
  });
});
