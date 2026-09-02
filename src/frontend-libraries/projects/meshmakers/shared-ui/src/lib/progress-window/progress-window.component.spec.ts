import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogRef } from '@progress/kendo-angular-dialog';
import { ProgressWindowComponent } from './progress-window.component';

describe('ProgressWindowComponent', () => {
  let component: ProgressWindowComponent;
  let fixture: ComponentFixture<ProgressWindowComponent>;
  let mockDialogRef: MockedObject<DialogRef>;

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn().mockName('DialogRef.close')
    } as unknown as MockedObject<DialogRef>;

    await TestBed.configureTestingModule({
      imports: [ProgressWindowComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DialogRef, useValue: mockDialogRef }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ProgressWindowComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should call cancel operation and close dialog when cancel is clicked', () => {
    component.cancelOperation = vi.fn().mockName('cancelOperation');
    fixture.detectChanges();

    component.onCancelClick();

    expect(component.cancelOperation).toHaveBeenCalled();
    expect(mockDialogRef.close).toHaveBeenCalled();
  });
});
