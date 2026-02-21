import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogRef } from '@progress/kendo-angular-dialog';
import { NotificationService } from '@progress/kendo-angular-notification';

import { UploadFileDialogComponent } from './upload-file-dialog.component';

describe('UploadFileDialogComponent', () => {
  let component: UploadFileDialogComponent;
  let fixture: ComponentFixture<UploadFileDialogComponent>;
  let mockDialogRef: jasmine.SpyObj<DialogRef>;
  let mockNotificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(async () => {
    mockDialogRef = jasmine.createSpyObj('DialogRef', ['close']);
    mockNotificationService = jasmine.createSpyObj('NotificationService', ['show']);

    await TestBed.configureTestingModule({
      imports: [UploadFileDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: NotificationService, useValue: mockNotificationService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadFileDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
