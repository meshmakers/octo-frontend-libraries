import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CronBuilderComponent } from './cron-builder.component';

@Component({
  standalone: true,
  imports: [CronBuilderComponent, ReactiveFormsModule],
  template: `
    <form (ngSubmit)="submitted = submitted + 1">
      <mm-cron-builder [formControl]="cron"></mm-cron-builder>
    </form>
  `
})
class HostComponent {
  readonly cron = new FormControl('0 */5 * * * *');
  submitted = 0;
}

describe('CronBuilderComponent inside a form', () => {
  it('never submits the form it is placed in', () => {
    const fixture = TestBed.configureTestingModule({ imports: [HostComponent] }).createComponent(HostComponent);
    fixture.detectChanges();
    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('mm-cron-builder button')] as HTMLButtonElement[];

    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.filter(button => button.type !== 'button')).toEqual([]);

    buttons.forEach(button => button.click());
    expect(fixture.componentInstance.submitted).toBe(0);
  });
});
