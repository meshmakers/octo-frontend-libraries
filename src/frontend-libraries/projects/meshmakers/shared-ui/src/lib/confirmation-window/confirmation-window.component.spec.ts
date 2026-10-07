import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogRef } from '@progress/kendo-angular-dialog';

import { ConfirmationWindowComponent } from './confirmation-window.component';
import { ButtonTypes, DialogType } from '../models/confirmation';

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
    expect(buttons.map(b => b.textContent?.trim())).toEqual(['Cancel', 'Rotate']);
    expect(buttons[1].getAttribute('data-danger')).toBe('true');
    expect(buttons[1].className).toMatch(/error/);
    expect(buttons[0].className).not.toMatch(/error|primary/);
  });

  function render(dialogType: DialogType, danger = false): { texts: (string | undefined)[]; buttons: HTMLButtonElement[] } {
    const f = TestBed.createComponent(ConfirmationWindowComponent);
    f.componentInstance.data = { title: 't', message: 'm', dialogType, ...(danger ? { danger: true } : {}) };
    f.detectChanges();
    const buttons = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button'));
    return { texts: buttons.map(b => b.textContent?.trim()), buttons };
  }

  describe('button order (Cancel left, primary right)', () => {
    it('puts No left and the primary Yes right', () => {
      const { texts, buttons } = render(DialogType.YesNo);
      expect(texts).toEqual(['No', 'Yes']);
      expect(buttons[1].className).toMatch(/primary/);
      expect(buttons[1].getAttribute('data-action')).toBe('confirm');
    });

    it('puts Cancel left and OK right', () => {
      expect(render(DialogType.OkCancel).texts).toEqual(['Cancel', 'OK']);
    });

    it('orders Cancel, No, Yes for a three-button dialog', () => {
      expect(render(DialogType.YesNoCancel).texts).toEqual(['Cancel', 'No', 'Yes']);
    });

    it('keeps the danger confirming button on the right', () => {
      const { texts, buttons } = render(DialogType.YesNo, true);
      expect(texts).toEqual(['No', 'Yes']);
      expect(buttons[1].className).toMatch(/error/);
    });

    it('renders a single OK button', () => {
      expect(render(DialogType.Ok).texts).toEqual(['OK']);
    });

    it('still closes with the result of the clicked button', () => {
      const { buttons } = render(DialogType.YesNo);
      buttons[0].click();
      expect(mockDialogRef.close).toHaveBeenLastCalledWith(expect.objectContaining({ result: ButtonTypes.No }));
      buttons[1].click();
      expect(mockDialogRef.close).toHaveBeenLastCalledWith(expect.objectContaining({ result: ButtonTypes.Yes }));
    });
  });
});
