import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CldrIntlService, IntlService } from '@progress/kendo-angular-intl';
import '@progress/kendo-angular-intl/locales/de/all';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TimeRangePickerComponent } from './time-range-picker.component';

const GERMAN_MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];
const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface MonthOptionsReader { monthOptions: () => { value: number; label: string }[] }

function monthLabels(fixture: ComponentFixture<TimeRangePickerComponent>): string[] {
  return (fixture.componentInstance as unknown as MonthOptionsReader).monthOptions().map(option => option.label);
}

function createPicker(localeId: string): ComponentFixture<TimeRangePickerComponent> {
  TestBed.configureTestingModule({
    imports: [TimeRangePickerComponent],
    providers: [provideNoopAnimations(), { provide: LOCALE_ID, useValue: localeId }]
  });
  const fixture = TestBed.createComponent(TimeRangePickerComponent);
  fixture.componentInstance.config = { availableTypes: ['month'] };
  fixture.detectChanges();
  return fixture;
}

describe('TimeRangePickerComponent month names follow the UI language (AB#9742)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC1: German UI language shows German month names', () => {
    const fixture = createPicker('de');

    expect(monthLabels(fixture)).toEqual(GERMAN_MONTHS);
  });

  it('AC1: the month dropdown renders the German name of the selected month', () => {
    TestBed.configureTestingModule({
      imports: [TimeRangePickerComponent],
      providers: [provideNoopAnimations(), { provide: LOCALE_ID, useValue: 'de' }]
    });
    const fixture = TestBed.createComponent(TimeRangePickerComponent);
    fixture.componentInstance.config = { availableTypes: ['month'] };
    fixture.componentInstance.initialSelection = { type: 'month', year: 2026, month: 2 };
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).querySelector('.month-field .k-input-value-text')?.textContent?.trim();

    expect(text).toBe('März');
  });

  it('AC1: English UI language keeps the English month names', () => {
    const fixture = createPicker('en');

    expect(monthLabels(fixture)).toEqual(ENGLISH_MONTHS);
  });

  it('AC2: switching the language at runtime switches the month names without recreating the picker', () => {
    const fixture = createPicker('en');
    const intl = TestBed.inject(IntlService) as CldrIntlService;
    const instance = fixture.componentInstance;

    intl.localeId = 'de';
    fixture.detectChanges();

    expect(fixture.componentInstance).toBe(instance);
    expect(monthLabels(fixture)).toEqual(GERMAN_MONTHS);

    intl.localeId = 'en';
    fixture.detectChanges();

    expect(monthLabels(fixture)).toEqual(ENGLISH_MONTHS);
  });

  it('a locale without loaded Kendo data falls back to the English month names', () => {
    const fixture = createPicker('xx');

    expect(monthLabels(fixture)).toEqual(ENGLISH_MONTHS);
  });
});
