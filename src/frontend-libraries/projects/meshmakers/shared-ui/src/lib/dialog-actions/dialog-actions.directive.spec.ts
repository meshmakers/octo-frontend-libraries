import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ButtonComponent } from '@progress/kendo-angular-buttons';
import { DialogActionsComponent } from '@progress/kendo-angular-dialog';

import { MM_DIALOG_ACTIONS_CLASS, MmDialogActionsDirective } from './dialog-actions.directive';

@Component({
  selector: 'mm-test-host',
  imports: [DialogActionsComponent, MmDialogActionsDirective, ButtonComponent],
  template: `
    <kendo-dialog-actions id="default">
      <button kendoButton>Cancel</button>
      <button kendoButton themeColor="error">Delete adapter</button>
    </kendo-dialog-actions>
    <kendo-dialog-actions id="explicit" layout="stretched"><button kendoButton>Close</button></kendo-dialog-actions>
  `,
})
class HostComponent {}

describe('MmDialogActionsDirective (AB#6464)', () => {
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  });

  it('right-aligns every dialog action row instead of Kendo\'s stretched default', () => {
    const actions = root.querySelector('#default')!;
    expect(actions.classList).toContain('k-actions-end');
    expect(actions.classList).not.toContain('k-actions-stretched');
  });

  it('stamps the shared class that carries the 34 px / gap / danger look', () => {
    expect(root.querySelector('#default')!.classList).toContain(MM_DIALOG_ACTIONS_CLASS);
  });

  it('keeps the destructive confirm on the error theme colour', () => {
    const confirm = root.querySelector('#default button:last-child')!;
    expect(confirm.classList).toContain('k-button-error');
    expect(root.querySelector('#default button:first-child')!.classList).not.toContain('k-button-error');
  });

  it('fixes the layout: a layout attribute in the template does not bring the stretched look back', () => {
    const explicit = root.querySelector('#explicit')!;
    expect(explicit.classList).toContain('k-actions-end');
    expect(explicit.classList).not.toContain('k-actions-start');
  });
});
