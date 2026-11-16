import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MeshBoardTimeShift } from '../../models/meshboard.models';
import { QueryFamily } from '../../utils/query-family';
import { SdTimeShiftEditorComponent } from './sd-time-shift-editor.component';

/** AB#9095: the "Compare with" control of the widget config dialogs, rendered and driven like a user. */
describe('SdTimeShiftEditorComponent (AB#9095)', () => {
  let fixture: ComponentFixture<SdTimeShiftEditorComponent>;
  let emitted: (MeshBoardTimeShift | undefined)[];

  function render(family: QueryFamily | null, timeShift?: MeshBoardTimeShift, ignoreTimeFilter = false): void {
    fixture = TestBed.createComponent(SdTimeShiftEditorComponent);
    fixture.componentRef.setInput('family', family);
    fixture.componentRef.setInput('ignoreTimeFilter', ignoreTimeFilter);
    fixture.componentRef.setInput('timeShift', timeShift);
    emitted = [];
    fixture.componentInstance.timeShift.subscribe(value => emitted.push(value));
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function radio(label: string): HTMLInputElement {
    const choice = Array.from(el().querySelectorAll('label.choice')).find(l => l.textContent?.trim() === label);
    if (!choice) {
      throw new Error(`no choice "${label}"`);
    }
    return choice.querySelector('input[type="radio"]') as HTMLInputElement;
  }

  function periodsInput(): HTMLInputElement | null {
    return el().querySelector('.periods input');
  }

  function typePeriods(value: string): void {
    const input = periodsInput()!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function pick(label: string): void {
    const input = radio(label);
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SdTimeShiftEditorComponent], providers: [provideNoopAnimations()] });
  });

  describe('criterion 2 Set', () => {
    it('offers "None", "Previous period" and "Same period last year" under "Compare with", "None" checked without a shift', () => {
      render('streamData');

      expect(el().querySelector('legend')?.textContent?.trim()).toBe('Compare with');
      expect(Array.from(el().querySelectorAll('label.choice')).map(l => l.textContent?.trim()))
        .toEqual(['None', 'Previous period', 'Same period last year']);
      expect(radio('None').checked).toBe(true);
      expect(periodsInput()).toBeNull();
      expect(el().querySelector('.field-hint')?.textContent?.trim())
        .toBe('Shows the selected board period moved back. Custom ranges move by their own length.');
    });

    it('"Previous period" emits { by: period, count: -1 } and shows "Periods back" 1', () => {
      render('streamData');

      pick('Previous period');

      expect(emitted.at(-1)).toEqual({ by: 'period', count: -1 });
      expect(el().querySelector('.periods kendo-label')?.textContent?.trim()).toBe('Periods back');
      expect(periodsInput()?.value).toBe('1');
    });

    it('"Periods back" 3 with "Same period last year" emits { by: year, count: -3 }', () => {
      render('streamData', { by: 'period', count: -1 });

      typePeriods('3');
      pick('Same period last year');

      expect(emitted).toContainEqual({ by: 'period', count: -3 });
      expect(emitted.at(-1)).toEqual({ by: 'year', count: -3 });
    });

    it('"Periods back" accepts 1 to 10 only', () => {
      render('streamData', { by: 'period', count: -1 });

      typePeriods('25');

      expect(emitted.at(-1)).toEqual({ by: 'period', count: -10 });
    });

    it('reopening shows the saved choice: "Same period last year", 2 periods back', () => {
      render('streamData', { by: 'year', count: -2 });

      expect(radio('Same period last year').checked).toBe(true);
      expect(radio('None').checked).toBe(false);
      expect(periodsInput()?.value).toBe('2');
    });
  });

  describe('criterion 3 Clear', () => {
    it('"None" emits no shift and hides "Periods back"', () => {
      render('streamData', { by: 'year', count: -1 });

      pick('None');

      expect(emitted.at(-1)).toBeUndefined();
      expect(periodsInput()).toBeNull();
    });
  });

  describe('criterion 4 Only where it applies', () => {
    it('is hidden for a runtime query and while no query is selected', () => {
      render('runtime', { by: 'year', count: -1 });
      expect(el().querySelector('fieldset')).toBeNull();

      render(null);
      expect(el().querySelector('fieldset')).toBeNull();
    });

    it('with "Ignore MeshBoard time filter" it is disabled, keeps the shift and its hint says the shift has no effect', () => {
      render('streamData', { by: 'year', count: -1 }, true);

      expect(radio('None').disabled).toBe(true);
      expect(radio('Previous period').disabled).toBe(true);
      expect(radio('Same period last year').disabled).toBe(true);
      expect(radio('Same period last year').checked).toBe(true);
      expect(periodsInput()?.disabled).toBe(true);
      expect(el().querySelector('.field-hint')?.textContent?.trim())
        .toBe('The shift has no effect while the MeshBoard time filter is ignored.');
      expect(emitted).toEqual([]);
    });
  });

  describe('criterion 7 Keyboard', () => {
    it('the three choices are one radio group of focusable inputs and "Periods back" is a labelled input', () => {
      render('streamData', { by: 'period', count: -1 });

      const radios = Array.from(el().querySelectorAll<HTMLInputElement>('input[type="radio"]'));
      expect(radios).toHaveLength(3);
      expect(new Set(radios.map(r => r.name)).size).toBe(1);
      expect(radios.every(r => r.tabIndex >= 0)).toBe(true);
      const input = periodsInput()!;
      expect(input.tabIndex).toBeGreaterThanOrEqual(0);
      expect(el().querySelector(`label[for="${input.id}"]`)?.textContent?.trim()).toBe('Periods back');
    });
  });
});
