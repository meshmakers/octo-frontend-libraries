import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CronBuilderComponent } from './cron-builder.component';
import { CronBuilderConfig } from './cron-builder.models';

@Component({
  standalone: true,
  imports: [CronBuilderComponent, ReactiveFormsModule],
  template: `
    <form (submit)="onSubmit($event)">
      <mm-cron-builder [formControl]="cron" [config]="config"></mm-cron-builder>
      <button type="submit" class="host-submit">Save</button>
    </form>
  `
})
class HostComponent {
  readonly cron = new FormControl('0 */5 * * * *');
  config: CronBuilderConfig = {};
  submitted = 0;

  onSubmit(event: Event): void {
    event.preventDefault();
    this.submitted++;
  }
}

function render(config: CronBuilderConfig = {}) {
  const fixture = TestBed.configureTestingModule({ imports: [HostComponent] }).createComponent(HostComponent);
  fixture.componentInstance.config = config;
  fixture.detectChanges();
  return fixture;
}

describe('CronBuilderComponent', () => {
  it('never submits the form it is placed in, while the form itself still submits', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = [...element.querySelectorAll('mm-cron-builder button')] as HTMLButtonElement[];

    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.filter(button => button.type !== 'button')).toEqual([]);

    buttons.forEach(button => button.click());
    expect(fixture.componentInstance.submitted).toBe(0);

    (element.querySelector('.host-submit') as HTMLButtonElement).click();
    expect(fixture.componentInstance.submitted).toBe(1);
  });

  it('offers only the schedule types it is given', () => {
    const tabs = (fixture: ReturnType<typeof render>) =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('.k-tabstrip-item')].map(tab => tab.textContent?.trim());

    expect(tabs(render())).toEqual(['Seconds', 'Minutes', 'Hourly', 'Daily', 'Weekly', 'Monthly', 'Custom']);
    TestBed.resetTestingModule();
    expect(tabs(render({ scheduleTypes: ['daily', 'weekly', 'custom'] }))).toEqual(['Daily', 'Weekly', 'Custom']);
  });

  it('selects a tab it offers when the schedule type of its value is not offered', () => {
    const fixture = render({ scheduleTypes: ['weekly'] });
    const selected = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.k-tabstrip-item[aria-selected="true"]')]
      .map(tab => tab.textContent?.trim());

    expect(selected).toEqual(['Weekly']);
    expect(fixture.componentInstance.cron.value).toBe('0 */5 * * * *');
  });
});
