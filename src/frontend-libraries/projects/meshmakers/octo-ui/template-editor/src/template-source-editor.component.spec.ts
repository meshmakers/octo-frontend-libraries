import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { TemplateSourceEditorComponent } from './template-source-editor.component';

describe('TemplateSourceEditorComponent', () => {
  const KNOWN = new Set(['${customer.firstName}', '${community.name}']);
  let fixture: ComponentFixture<TemplateSourceEditorComponent>;
  let component: TemplateSourceEditorComponent;

  function mount(value: string, singleLine = false): HTMLElement {
    component.control = new FormControl(value);
    component.singleLine = singleLine;
    component.isKnownToken = token => KNOWN.has(token);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function shownText(el: HTMLElement): string {
    return [...el.querySelectorAll('.cm-line')].map(line => line.textContent).join('\n');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TemplateSourceEditorComponent] }).compileComponents();
    fixture = TestBed.createComponent(TemplateSourceEditorComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('shows the value of its control', () => {
    expect(shownText(mount('Guten Tag'))).toBe('Guten Tag');
  });

  it('marks a placeholder the host knows', () => {
    const el = mount('Hallo ${customer.firstName}!');

    expect(el.querySelector('.cm-placeholder-known')?.textContent).toBe('${customer.firstName}');
  });

  it('marks a placeholder the host does not know differently', () => {
    const el = mount('Hallo ${customer.nickname}!');

    expect(el.querySelector('.cm-placeholder-unknown')?.textContent).toBe('${customer.nickname}');
  });

  it('repaints when the host swaps its rule', () => {
    const el = mount('Hallo ${customer.nickname}!');

    component.isKnownToken = () => true;
    fixture.detectChanges();

    expect(el.querySelector('.cm-placeholder-known')?.textContent).toBe('${customer.nickname}');
    expect(el.querySelector('.cm-placeholder-unknown')).toBeNull();
  });

  it('follows the control when the value is set from outside', () => {
    const el = mount('erste');

    component.control.setValue('zweite');
    fixture.detectChanges();

    expect(shownText(el)).toBe('zweite');
  });

  it('lets go of its control when destroyed', () => {
    mount('erste');
    const control = component.control;
    const changes = control.valueChanges as unknown as { observed: boolean };

    expect(changes.observed).toBe(true);

    fixture.destroy();

    expect(changes.observed).toBe(false);
    expect(() => control.setValue('nach dem Ende')).not.toThrow();
  });

  it('writes an inserted token through to the control and marks it dirty', () => {
    mount('Hallo');

    component.insertToken('${customer.firstName}');

    expect(component.control.value).toBe('${customer.firstName}Hallo');
    expect(component.control.dirty).toBe(true);
  });

  it('paints a token the moment it is inserted', () => {
    const el = mount('Hallo');

    component.insertToken('${community.name}');
    fixture.detectChanges();

    expect(el.querySelector('.cm-placeholder-known')?.textContent).toBe('${community.name}');
  });

  it('strips a newline in single-line mode, because a subject is one line', () => {
    mount('Abrechnung', true);

    component.insertToken('Q2\nQ3');

    expect(component.control.value).toBe('Q2Q3Abrechnung');
  });

  it('keeps a newline in the body', () => {
    mount('eins');

    component.insertToken('zwei\ndrei');

    expect(component.control.value).toBe('zwei\ndreieins');
  });
});
