import type { MockedObject } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogRef } from '@progress/kendo-angular-dialog';

import { ConfirmationWindowComponent } from './confirmation-window.component';

describe('ConfirmationWindowComponent', () => {
    let component: ConfirmationWindowComponent;
    let fixture: ComponentFixture<ConfirmationWindowComponent>;
    let mockDialogRef: MockedObject<DialogRef>;

    beforeEach(async () => {
        mockDialogRef = {
            close: vi.fn().mockName("DialogRef.close")
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
});
