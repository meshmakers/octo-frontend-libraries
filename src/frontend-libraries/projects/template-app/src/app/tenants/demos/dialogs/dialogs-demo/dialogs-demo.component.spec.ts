import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DialogsDemoComponent } from './dialogs-demo.component';
import {
  FileUploadService,
  ConfirmationService,
  ProgressWindowService,
  SaveAsDialogService
} from '@meshmakers/shared-ui';
import { GetSdkCustomersDtoGQL } from '../../../../graphQL/getSdkCustomers';

describe('DialogsDemoComponent', () => {
  let component: DialogsDemoComponent;
  let fixture: ComponentFixture<DialogsDemoComponent>;

  beforeEach(async () => {
    const mockFileUploadService = jasmine.createSpyObj('FileUploadService', ['showUploadDialog']);
    mockFileUploadService.showUploadDialog.and.returnValue(Promise.resolve(null));

    const mockConfirmationService = jasmine.createSpyObj('ConfirmationService', [
      'showOkDialog',
      'showOkCancelConfirmationDialog',
      'showYesNoConfirmationDialog',
      'showYesNoCancelConfirmationDialog'
    ]);
    mockConfirmationService.showOkDialog.and.returnValue(Promise.resolve(true));
    mockConfirmationService.showOkCancelConfirmationDialog.and.returnValue(Promise.resolve(true));
    mockConfirmationService.showYesNoConfirmationDialog.and.returnValue(Promise.resolve(true));
    mockConfirmationService.showYesNoCancelConfirmationDialog.and.returnValue(Promise.resolve(true));

    const mockDialogRef = jasmine.createSpyObj('DialogRef', ['close']);
    const mockProgressWindowService = jasmine.createSpyObj('ProgressWindowService', [
      'showDeterminateProgress',
      'showIndeterminateProgress'
    ]);
    mockProgressWindowService.showDeterminateProgress.and.returnValue(mockDialogRef);
    mockProgressWindowService.showIndeterminateProgress.and.returnValue(mockDialogRef);

    const mockSaveAsDialogService = jasmine.createSpyObj('SaveAsDialogService', ['showSaveAsDialog']);
    mockSaveAsDialogService.showSaveAsDialog.and.returnValue(Promise.resolve({ confirmed: false }));

    const mockGetSdkCustomersGQL = jasmine.createSpyObj('GetSdkCustomersDtoGQL', ['fetch']);
    mockGetSdkCustomersGQL.fetch.and.returnValue(of({ data: { runtime: { octoSdkDemoCustomer: { items: [], totalCount: 0 } } } } as any));

    await TestBed.configureTestingModule({
      imports: [DialogsDemoComponent],
      providers: [
        { provide: FileUploadService, useValue: mockFileUploadService },
        { provide: ConfirmationService, useValue: mockConfirmationService },
        { provide: ProgressWindowService, useValue: mockProgressWindowService },
        { provide: SaveAsDialogService, useValue: mockSaveAsDialogService },
        { provide: GetSdkCustomersDtoGQL, useValue: mockGetSdkCustomersGQL }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DialogsDemoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
