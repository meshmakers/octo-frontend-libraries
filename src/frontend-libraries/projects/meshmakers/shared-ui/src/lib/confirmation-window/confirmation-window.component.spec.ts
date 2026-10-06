import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogRef } from '@progress/kendo-angular-dialog';

import { ConfirmationWindowComponent } from './confirmation-window.component';
import { DialogType } from '../models/confirmation';

describe('ConfirmationWindowComponent', () => {
  let component: ConfirmationWindowComponent;
  let fixture: ComponentFixture<ConfirmationWindowComponent>;
  let mockDialogRef: MockedObject<DialogRef>;

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn().mockName('DialogRef.close')
    } as unknown as MockedObject<DialogRef>;

    await TestBed.configureTestingModule({
      imports: [ConfirmationWindowComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DialogRef, useValue: mockDialogRef }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ConfirmationWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('styles the confirming button as danger for a destructive confirmation', () => {
    const danger = TestBed.createComponent(ConfirmationWindowComponent);
    danger.componentInstance.data = { title: 't', message: 'm', dialogType: DialogType.YesNo, buttonLabels: { yes: 'Rotate', no: 'Cancel' }, danger: true };
    danger.detectChanges();
    const buttons = Array.from((danger.nativeElement as HTMLElement).querySelectorAll('button'));
    expect(buttons.map(b => b.textContent?.trim())).toEqual(['Rotate', 'Cancel']);
    expect(buttons[0].getAttribute('data-danger')).toBe('true');
    expect(buttons[0].className).toMatch(/error/);
  });
});
