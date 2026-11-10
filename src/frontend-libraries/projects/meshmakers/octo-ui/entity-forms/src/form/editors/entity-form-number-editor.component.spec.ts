import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { IntlService } from '@progress/kendo-angular-intl';
import { DEFAULT_ENTITY_FORMS_MESSAGES, EntityFormsMessages } from '../../entity-forms.messages';
import { firstErrorKey } from '../entity-form-controls';
import { EntityFormNumberEditorComponent, NUMBER_FORMAT_ERROR } from './entity-form-number-editor.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, EntityFormNumberEditorComponent],
  template: `<mm-entity-form-number-editor [formControl]="control" [integer]="integer()" [messages]="messages" />`,
})
class HostComponent {
  readonly control = new FormControl<number | null>(null, Validators.required);
  readonly integer = signal(false);
  messages: EntityFormsMessages = DEFAULT_ENTITY_FORMS_MESSAGES;
}

function setup(symbols: { decimal: string; group: string }): ComponentFixture<HostComponent> {
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [{ provide: IntlService, useValue: { numberSymbols: () => symbols } }],
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture;
}

function input(fixture: ComponentFixture<HostComponent>): HTMLInputElement {
  return fixture.nativeElement.querySelector('input') as HTMLInputElement;
}

function type(fixture: ComponentFixture<HostComponent>, text: string): void {
  const el = input(fixture);
  el.value = text;
  el.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function parsedLine(fixture: ComponentFixture<HostComponent>): string | null {
  return (fixture.nativeElement.querySelector('[data-number-parsed]') as HTMLElement | null)?.textContent?.trim() ?? null;
}

describe('EntityFormNumberEditorComponent (AB#8734)', () => {
  describe('German locale (decimal ",", group ".")', () => {
    let fixture: ComponentFixture<HostComponent>;
    beforeEach(() => (fixture = setup({ decimal: ',', group: '.' })));

    it('stores 77.5, not 775, when "77.5" is typed, and shows the parsed value in German', () => {
      type(fixture, '77.5');
      expect(fixture.componentInstance.control.value).toBe(77.5);
      expect(fixture.componentInstance.control.valid).toBe(true);
      expect(parsedLine(fixture)).toBe('Value: 77,5');
    });

    it('falls back to the default texts when a host passes messages without the number keys', () => {
      const { numberParsedValue: _omitted, ...older } = DEFAULT_ENTITY_FORMS_MESSAGES;
      fixture.componentInstance.messages = older;
      fixture.detectChanges();
      type(fixture, '77.5');
      expect(parsedLine(fixture)).toBe('Value: 77,5');
    });

    it('stores 77.5 for "77,5"', () => {
      type(fixture, '77,5');
      expect(fixture.componentInstance.control.value).toBe(77.5);
      expect(parsedLine(fixture)).toBe('Value: 77,5');
    });

    it('reads German grouping and shows it', () => {
      type(fixture, '1.234,5');
      expect(fixture.componentInstance.control.value).toBe(1234.5);
      expect(parsedLine(fixture)).toBe('Value: 1.234,5');
    });

    it('refuses a wrong grouping: no value, a number error before "required", no parsed line', () => {
      type(fixture, '1.23,4');
      const control = fixture.componentInstance.control;
      expect(control.value).toBeNull();
      expect(control.valid).toBe(false);
      expect(control.errors?.[NUMBER_FORMAT_ERROR]).toEqual({ reason: 'grouping' });
      expect(firstErrorKey(control.errors)).toBe(NUMBER_FORMAT_ERROR);
      expect(parsedLine(fixture)).toBeNull();
    });

    it('refuses "1.234" (German thousands or decimal?) and names both ways to type it', () => {
      type(fixture, '1.234');
      const control = fixture.componentInstance.control;
      expect(control.value).toBeNull();
      expect(control.errors?.[NUMBER_FORMAT_ERROR]).toEqual({ reason: 'ambiguous', whole: '1234', decimal: '1,234' });
      type(fixture, '1,234');
      expect(control.value).toBe(1.234);
      expect(parsedLine(fixture)).toBe('Value: 1,234');
    });

    it('reads "1.234" as 1234 in a whole-number field', () => {
      fixture.componentInstance.integer.set(true);
      fixture.detectChanges();
      type(fixture, '1.234');
      expect(fixture.componentInstance.control.value).toBe(1234);
      expect(parsedLine(fixture)).toBe('Value: 1.234');
    });

    it('shows a loaded value with the German decimal separator and no parsed line until edited', () => {
      fixture.componentInstance.control.setValue(77.5);
      fixture.detectChanges();
      expect(input(fixture).value).toBe('77,5');
      expect(parsedLine(fixture)).toBeNull();
    });

    it('refuses a fraction in a whole-number field', () => {
      fixture.componentInstance.integer.set(true);
      fixture.detectChanges();
      type(fixture, '7,5');
      expect(fixture.componentInstance.control.errors?.[NUMBER_FORMAT_ERROR]).toEqual({ reason: 'integer' });
    });

    it('clears to null and leaves the error to "required"', () => {
      type(fixture, '5');
      type(fixture, '');
      const control = fixture.componentInstance.control;
      expect(control.value).toBeNull();
      expect(firstErrorKey(control.errors)).toBe('required');
    });
  });

  describe('Austrian locale (decimal ",", group space)', () => {
    it('reads "1.234" as decimal and says so', () => {
      const fixture = setup({ decimal: ',', group: '\u00a0' });
      type(fixture, '1.234');
      expect(fixture.componentInstance.control.value).toBe(1.234);
      expect(parsedLine(fixture)).toContain('Value: 1,234 — the separator was read as a decimal separator');
    });
  });

  describe('English locale (decimal ".", group ",")', () => {
    let fixture: ComponentFixture<HostComponent>;
    beforeEach(() => (fixture = setup({ decimal: '.', group: ',' })));

    it('stores 77.5 for "77.5" and for "77,5", and shows it in English', () => {
      type(fixture, '77.5');
      expect(fixture.componentInstance.control.value).toBe(77.5);
      expect(parsedLine(fixture)).toBe('Value: 77.5');
      type(fixture, '77,5');
      expect(fixture.componentInstance.control.value).toBe(77.5);
      expect(parsedLine(fixture)).toBe('Value: 77.5');
    });

    it('refuses "1,234" (English thousands or decimal?) and names both ways to type it', () => {
      type(fixture, '1,234');
      expect(fixture.componentInstance.control.errors?.[NUMBER_FORMAT_ERROR]).toEqual({ reason: 'ambiguous', whole: '1234', decimal: '1.234' });
    });

    it('reads English grouping and shows it', () => {
      type(fixture, '1,234.5');
      expect(fixture.componentInstance.control.value).toBe(1234.5);
      expect(parsedLine(fixture)).toBe('Value: 1,234.5');
    });

    it('shows a loaded value with the English decimal separator', () => {
      fixture.componentInstance.control.setValue(1234.5);
      fixture.detectChanges();
      expect(input(fixture).value).toBe('1234.5');
    });
  });
});
