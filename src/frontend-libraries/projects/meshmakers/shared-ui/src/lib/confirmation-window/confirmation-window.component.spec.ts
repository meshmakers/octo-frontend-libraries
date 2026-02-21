import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogRef } from '@progress/kendo-angular-dialog';

import { ConfirmationWindowComponent } from './confirmation-window.component';

describe('ConfirmationWindowComponent', () => {
  let component: ConfirmationWindowComponent;
  let fixture: ComponentFixture<ConfirmationWindowComponent>;
  let mockDialogRef: jasmine.SpyObj<DialogRef>;

  beforeEach(async () => {
    mockDialogRef = jasmine.createSpyObj('DialogRef', ['close']);

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
});
