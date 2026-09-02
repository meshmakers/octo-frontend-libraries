import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DialogsDemoComponent } from './dialogs-demo.component';
import { FileUploadService, ConfirmationService, ProgressWindowService, SaveAsDialogService } from '@meshmakers/shared-ui';
import { GetSdkCustomersDtoGQL, GetSdkCustomersQueryDto } from '../../../../graphQL/getSdkCustomers';
import { ApolloQueryResult } from '@apollo/client/core';

describe('DialogsDemoComponent', () => {
    let component: DialogsDemoComponent;
    let fixture: ComponentFixture<DialogsDemoComponent>;

    beforeEach(async () => {
        const mockFileUploadService = {
            showUploadDialog: vi.fn().mockName("FileUploadService.showUploadDialog")
        };
        mockFileUploadService.showUploadDialog.mockResolvedValue(null);

        const mockConfirmationService = {
            showOkDialog: vi.fn().mockName("ConfirmationService.showOkDialog"),
            showOkCancelConfirmationDialog: vi.fn().mockName("ConfirmationService.showOkCancelConfirmationDialog"),
            showYesNoConfirmationDialog: vi.fn().mockName("ConfirmationService.showYesNoConfirmationDialog"),
            showYesNoCancelConfirmationDialog: vi.fn().mockName("ConfirmationService.showYesNoCancelConfirmationDialog")
        };
        mockConfirmationService.showOkDialog.mockResolvedValue(true);
        mockConfirmationService.showOkCancelConfirmationDialog.mockResolvedValue(true);
        mockConfirmationService.showYesNoConfirmationDialog.mockResolvedValue(true);
        mockConfirmationService.showYesNoCancelConfirmationDialog.mockResolvedValue(true);

        const mockDialogRef = {
            close: vi.fn().mockName("DialogRef.close")
        };
        const mockProgressWindowService = {
            showDeterminateProgress: vi.fn().mockName("ProgressWindowService.showDeterminateProgress"),
            showIndeterminateProgress: vi.fn().mockName("ProgressWindowService.showIndeterminateProgress")
        };
        mockProgressWindowService.showDeterminateProgress.mockReturnValue(mockDialogRef);
        mockProgressWindowService.showIndeterminateProgress.mockReturnValue(mockDialogRef);

        const mockSaveAsDialogService = {
            showSaveAsDialog: vi.fn().mockName("SaveAsDialogService.showSaveAsDialog")
        };
        mockSaveAsDialogService.showSaveAsDialog.mockResolvedValue({ confirmed: false });

        const mockGetSdkCustomersGQL = {
            fetch: vi.fn().mockName("GetSdkCustomersDtoGQL.fetch")
        };
        mockGetSdkCustomersGQL.fetch.mockReturnValue(of({ data: { runtime: { octoSdkDemoCustomer: { items: [], totalCount: 0 } } } } as unknown as ApolloQueryResult<GetSdkCustomersQueryDto>));

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
