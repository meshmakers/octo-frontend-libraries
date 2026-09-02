import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogRef } from '@progress/kendo-angular-dialog';
import { NotificationService } from '@progress/kendo-angular-notification';

import { UploadFileDialogComponent } from './upload-file-dialog.component';

describe('UploadFileDialogComponent', () => {
  let component: UploadFileDialogComponent;
  let fixture: ComponentFixture<UploadFileDialogComponent>;
  let mockDialogRef: MockedObject<DialogRef>;
  let mockNotificationService: MockedObject<NotificationService>;

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn().mockName('DialogRef.close')
    } as unknown as MockedObject<DialogRef>;
    mockNotificationService = {
      show: vi.fn().mockName('NotificationService.show')
    } as unknown as MockedObject<NotificationService>;

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
