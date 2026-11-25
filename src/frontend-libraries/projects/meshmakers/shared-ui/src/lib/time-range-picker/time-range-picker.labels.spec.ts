import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TimeRangePickerComponent } from './time-range-picker.component';
import { TimeRangePickerLabels } from './time-range-picker.models';

@Component({
  standalone: true,
  imports: [TimeRangePickerComponent],
  template: '<mm-time-range-picker [config]="{ availableTypes: [\'month\'] }" [labels]="labels()"></mm-time-range-picker>'
})
class HostComponent {
  readonly labels = signal<TimeRangePickerLabels>({ rangeType: 'Zeitraum' });
}

describe('TimeRangePickerComponent labels', () => {
  afterEach(() => TestBed.resetTestingModule());

  function render() {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the labels bound by the host', () => {
    const fixture = render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Zeitraum');
  });

  it('relabels when the host binds new labels (language change)', () => {
    const fixture = render();

    fixture.componentInstance.labels.set({ rangeType: 'Period' });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Period');
    expect(text).not.toContain('Zeitraum');
  });
});
