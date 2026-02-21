import '@angular/localize/init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogRef } from '@progress/kendo-angular-dialog';
import { ProgressWindowComponent } from './progress-window.component';

describe('ProgressWindowComponent', () => {
  let component: ProgressWindowComponent;
  let fixture: ComponentFixture<ProgressWindowComponent>;
  let mockDialogRef: jasmine.SpyObj<DialogRef>;

  beforeEach(async () => {
    mockDialogRef = jasmine.createSpyObj('DialogRef', ['close']);

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
    component.cancelOperation = jasmine.createSpy('cancelOperation');
    fixture.detectChanges();

    component.onCancelClick();

    expect(component.cancelOperation).toHaveBeenCalled();
    expect(mockDialogRef.close).toHaveBeenCalled();
  });
});
